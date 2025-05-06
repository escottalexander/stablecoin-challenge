// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./MyUSD.sol";
import "./DEX.sol";
import "./MyUSDStaking.sol";

error Engine__InvalidAmount();
error Engine__TransferFailed();
error Engine__UnsafePositionRatio();
error Engine__MintingFailed();
error Engine__BurningFailed();
error Engine__PositionSafe();
error Engine__NotLiquidatable();
error Engine__InvalidBorrowRate();

contract MyUSDEngine is Ownable {
    uint256 private constant COLLATERAL_RATIO = 150; // 150% collateralization required
    uint256 private constant LIQUIDATOR_REWARD = 10; // 10% reward for liquidators
    uint256 private constant SECONDS_PER_YEAR = 365 days; // adjust later
    uint256 private constant PRECISION = 1e18;

    MyUSD private i_myUSD;
    DEX private i_DEX;
    MyUSDStaking private i_staking;

    uint256 public borrowRate; // Annual interest rate for borrowers in basis points (1% = 100)
    uint256 public lastUpdateTime;

    // Total debt shares in the pool
    uint256 public totalDebtShares;

    // Exchange rate between debt shares and MyUSD (1e18 precision)
    uint256 public debtExchangeRate;

    mapping(address => uint256) public s_userCollateral;
    mapping(address => uint256) public s_userDebtShares;

    event CollateralAdded(address indexed user, uint256 indexed amount, uint256 price);
    event CollateralWithdrawn(address indexed from, address indexed to, uint256 indexed amount, uint256 price);
    event BorrowRateUpdated(uint256 newRate);
    event DebtSharesMinted(address indexed user, uint256 amount, uint256 shares);
    event DebtSharesBurned(address indexed user, uint256 amount, uint256 shares);

    constructor(address _DEX, address _myUSDAddress, address _stakingAddress) Ownable(msg.sender) {
        i_DEX = DEX(_DEX);
        i_myUSD = MyUSD(_myUSDAddress);
        i_staking = MyUSDStaking(_stakingAddress);
        lastUpdateTime = block.timestamp;
        debtExchangeRate = PRECISION; // 1:1 initially
    }

    /**
     * @notice Set the borrow rate for the engine - intentionally not onlyOwner so we can call from any address
     * @param newRate The new borrow rate to set
     */
    function setBorrowRate(uint256 newRate) external {
        if (newRate > i_staking.savingsRate()) revert Engine__InvalidBorrowRate();
        _accrueInterest();
        borrowRate = newRate;
        emit BorrowRateUpdated(newRate);
    }

    /**
     * @notice Accrues interest on the total debt value so that we only need to track existing debt + new interest
     * @dev This function is called when the borrow rate is updated - before the rate is applied
     */
    function _accrueInterest() internal {
        if (totalDebtShares == 0) {
            lastUpdateTime = block.timestamp;
            return;
        }

        // No way to accrue interest if no debt or no borrow rate
        uint256 timeElapsed = block.timestamp - lastUpdateTime;
        if (timeElapsed == 0 || borrowRate == 0) return;

        // Calculate total debt value
        uint256 totalDebtValue = (totalDebtShares * debtExchangeRate) / PRECISION;

        // Calculate interest based on total debt value
        uint256 interest = (totalDebtValue * borrowRate * timeElapsed) / (SECONDS_PER_YEAR * 10000);

        if (interest > 0) {
            // Update exchange rate to reflect new value
            debtExchangeRate += (interest * PRECISION) / totalDebtShares;
        }
        lastUpdateTime = block.timestamp;
    }

    // Calculate the current debt value for a user, including accrued interest
    function _getCurrentDebtValue(address user) internal view returns (uint256) {
        if (s_userDebtShares[user] == 0) return 0;

        // Calculate base debt value from shares and exchange rate
        uint256 baseDebtValue = (s_userDebtShares[user] * debtExchangeRate) / PRECISION;

        // Calculate accrued interest since last update
        uint256 timeElapsed = block.timestamp - lastUpdateTime;
        if (timeElapsed == 0 || borrowRate == 0) return baseDebtValue;

        // Calculate interest since last update
        uint256 interest = (baseDebtValue * borrowRate * timeElapsed) / (SECONDS_PER_YEAR * 10000);

        return baseDebtValue + interest;
    }

    // Allows users to add collateral to their account
    function addCollateral() public payable {
        if (msg.value == 0) {
            revert Engine__InvalidAmount(); // Revert if no collateral is sent
        }

        s_userCollateral[msg.sender] += msg.value; // Update user's collateral balance
        emit CollateralAdded(msg.sender, msg.value, i_DEX.currentPrice()); // Emit event for collateral addition
    }

    // Allows users to withdraw collateral as long as it doesn't make them liquidatable
    function withdrawCollateral(uint256 amount) external {
        if (amount == 0 || s_userCollateral[msg.sender] < amount) {
            revert Engine__InvalidAmount(); // Revert if the amount is invalid
        }

        // Temporarily reduce the user's collateral to check if they remain safe
        uint256 newCollateral = s_userCollateral[msg.sender] - amount;
        s_userCollateral[msg.sender] = newCollateral;

        // Validate the user's position after withdrawal
        if (s_userDebtShares[msg.sender] > 0) {
            _validatePosition(msg.sender);
        }

        // Transfer the collateral to the user
        payable(msg.sender).transfer(amount);

        emit CollateralWithdrawn(msg.sender, msg.sender, amount, i_DEX.currentPrice()); // Emit event for collateral withdrawal
    }

    // Allows users to mint stablecoins based on their collateral
    function mintStableCoin(uint256 mintAmount) public {
        if (mintAmount == 0) {
            revert Engine__InvalidAmount(); // Revert if mint amount is zero
        }

        // Calculate debt shares based on current exchange rate
        uint256 debtShares = (mintAmount * PRECISION) / debtExchangeRate;

        // Update user's debt shares and total debt shares
        s_userDebtShares[msg.sender] += debtShares;
        totalDebtShares += debtShares;

        _validatePosition(msg.sender);
        bool success = i_myUSD.mintTo(msg.sender, mintAmount);
        if (!success) {
            revert Engine__MintingFailed(); // Revert if minting fails
        }

        emit DebtSharesMinted(msg.sender, mintAmount, debtShares);
    }

    // Allows users to burn stablecoins and reduce their debt
    function burnStableCoin(uint256 burnAmount) public {
        if (burnAmount == 0) {
            revert Engine__InvalidAmount(); // Revert if burn amount is zero
        }

        // Calculate current debt value including accrued interest
        uint256 currentDebtValue = _getCurrentDebtValue(msg.sender);

        // Check if user has enough debt
        if (burnAmount > currentDebtValue) {
            revert Engine__InvalidAmount(); // Revert if burn amount is too large
        }

        // Calculate debt shares to burn based on current exchange rate
        uint256 debtSharesToBurn = (burnAmount * PRECISION) / debtExchangeRate;

        // Update user's debt shares and total debt shares
        s_userDebtShares[msg.sender] -= debtSharesToBurn;
        totalDebtShares -= debtSharesToBurn;

        bool success = i_myUSD.burnFrom(msg.sender, burnAmount);
        if (!success) {
            revert Engine__BurningFailed(); // Revert if burning fails
        }

        emit DebtSharesBurned(msg.sender, burnAmount, debtSharesToBurn);
    }

    // Retrieves the user's position, including minted amount and collateral value
    function _getUserPosition(address user) private view returns (uint256 mintedAmount, uint256 collateralValue) {
        // Calculate current debt value including accrued interest
        mintedAmount = _getCurrentDebtValue(user);
        collateralValue = calculateCollateralValue(user); // Calculate user's collateral value
        return (mintedAmount, collateralValue); // Return user's position
    }

    // Calculates the total collateral value for a user based on their collateral balance and price point
    function calculateCollateralValue(address user) public view returns (uint256) {
        uint256 collateralAmount = s_userCollateral[user]; // Get user's collateral amount
        return (collateralAmount * i_DEX.currentPrice()) / 1e18; // Calculate collateral value in terms of ETH price
    }

    // Calculates the position ratio for a user to ensure they are within safe limits
    function _calculatePositionRatio(address user) private view returns (uint256) {
        (uint256 mintedAmount, uint256 collateralValue) = _getUserPosition(user); // Get user's position
        if (mintedAmount == 0) return type(uint256).max; // Return max if no stablecoins are minted
        return (collateralValue * 1e18) / mintedAmount; // Calculate position ratio
    }

    // Validates the user's position to ensure it meets safety requirements
    function _validatePosition(address user) internal view {
        uint256 positionRatio = _calculatePositionRatio(user); // Calculate user's position ratio
        if ((positionRatio * 100) < COLLATERAL_RATIO * 1e18) {
            revert Engine__UnsafePositionRatio(); // Revert if position is unsafe
        }
    }

    // Checks if a user's position can be liquidated
    function isLiquidatable(address user) public view returns (bool) {
        uint256 positionRatio = _calculatePositionRatio(user); // Calculate user's position ratio
        return (positionRatio * 100) < COLLATERAL_RATIO * 1e18; // Check if position is unsafe
    }

    // Allows liquidators to liquidate unsafe positions
    function liquidate(address user) external {
        if (!isLiquidatable(user)) {
            revert Engine__NotLiquidatable(); // Revert if position is not liquidatable
        }

        // Calculate current debt value including accrued interest
        uint256 userDebtValue = _getCurrentDebtValue(user);
        uint256 userCollateral = s_userCollateral[user]; // Get user's collateral balance
        uint256 collateralValue = calculateCollateralValue(user); // Calculate user's collateral value

        // check that liquidator has enough funds to pay back the debt
        if (i_myUSD.balanceOf(msg.sender) < userDebtValue) {
            revert MyUSD__InsufficientBalance();
        }

        // check that liquidator has approved the engine to transfer the debt
        if (i_myUSD.allowance(msg.sender, address(this)) < userDebtValue) {
            revert MyUSD__InsufficientAllowance();
        }

        // transfer value of debt to the contract
        i_myUSD.transferFrom(msg.sender, address(this), userDebtValue);

        // burn the transferred stablecoins
        i_myUSD.burnFrom(address(this), userDebtValue);

        // Clear user's debt shares - more gas efficient order
        totalDebtShares -= s_userDebtShares[user];
        s_userDebtShares[user] = 0;

        // calculate collateral to purchase (maintain the ratio of debt to collateral value)
        uint256 collateralPurchased = (userDebtValue * userCollateral) / collateralValue;
        uint256 liquidatorReward = (collateralPurchased * LIQUIDATOR_REWARD) / 100;
        uint256 amountForLiquidator = collateralPurchased + liquidatorReward;

        // transfer 110% of the debt to the liquidator
        (bool sent,) = payable(msg.sender).call{value: amountForLiquidator}("");
        require(sent, "Failed to send Ether");

        s_userCollateral[user] = userCollateral - amountForLiquidator;

        emit CollateralWithdrawn(user, msg.sender, amountForLiquidator, i_DEX.currentPrice()); // Emit event for collateral withdrawal
    }
}
