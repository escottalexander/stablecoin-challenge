// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./MyUSD.sol";
import "./CoinDEX.sol";
import "./Staking.sol";

error Engine__InvalidAmount();
error Engine__TransferFailed();
error Engine__UnsafePositionRatio();
error Engine__MintingFailed();
error Engine__BurningFailed();
error Engine__PositionSafe();
error Engine__NotLiquidatable();
error Engine__InvalidInterestRate();

contract MyUSDEngine is Ownable {
    uint256 private constant COLLATERAL_RATIO = 150; // 150% collateralization required
    uint256 private constant LIQUIDATOR_REWARD = 10; // 10% reward for liquidators
    uint256 private constant SECONDS_PER_YEAR = 365 days; // adjust later
    uint256 private constant PRECISION = 1e18;

    MyUSD private i_myUSD;
    CoinDEX private i_coinDEX;
    Staking private i_staking;

    uint256 public interestRate; // Annual interest rate in basis points (1% = 100)
    uint256 public lastUpdateTime;
    uint256 public totalDebt;

    mapping(address => uint256) public s_userCollateral;
    mapping(address => uint256) public s_userMinted;
    mapping(address => uint256) public s_userLastUpdateTime;

    event CollateralAdded(address indexed user, uint256 indexed amount, uint256 price);
    event CollateralWithdrawn(address indexed from, address indexed to, uint256 indexed amount, uint256 price);
    event InterestRateUpdated(uint256 newRate);
    event InterestAccrued(uint256 amount);

    constructor(address _coinDEX) Ownable(msg.sender) {
        i_coinDEX = CoinDEX(_coinDEX);
        lastUpdateTime = block.timestamp;
    }

    function setMyUSD(address myUSDAddress) external onlyOwner {
        i_myUSD = MyUSD(myUSDAddress);
    }

    function setStaking(address stakingAddress) external onlyOwner {
        i_staking = Staking(stakingAddress);
    }

    function setInterestRate(uint256 newRate) external onlyOwner {
        if (newRate > 2000) revert Engine__InvalidInterestRate(); // Max 20%
        _accrueInterest();
        interestRate = newRate;
        emit InterestRateUpdated(newRate);
    }

    function _accrueInterest() internal {
        if (totalDebt == 0) {
            lastUpdateTime = block.timestamp;
            return;
        }

        uint256 timeElapsed = block.timestamp - lastUpdateTime;
        if (timeElapsed == 0) return;

        uint256 interest = (totalDebt * interestRate * timeElapsed) / (SECONDS_PER_YEAR * 10000);
        if (interest > 0) {
            totalDebt += interest;

            // Mint interest to the staking contract
            i_myUSD.mintTo(address(i_staking), interest);

            // Update the staking contract's exchange rate to reflect the new interest
            i_staking.setInterestRate(interestRate);

            emit InterestAccrued(interest);
        }
        lastUpdateTime = block.timestamp;
    }

    function _updateUserDebt(address user) internal {
        if (s_userMinted[user] == 0) {
            s_userLastUpdateTime[user] = block.timestamp;
            return;
        }

        uint256 timeElapsed = block.timestamp - s_userLastUpdateTime[user];
        if (timeElapsed == 0) return;

        uint256 userInterest = (s_userMinted[user] * interestRate * timeElapsed) / (SECONDS_PER_YEAR * 10000);
        if (userInterest > 0) {
            s_userMinted[user] += userInterest;
            totalDebt += userInterest;
        }
        s_userLastUpdateTime[user] = block.timestamp;
    }

    // Allows users to add collateral to their account
    function addCollateral() public payable {
        if (msg.value == 0) {
            revert Engine__InvalidAmount(); // Revert if no collateral is sent
        }
        s_userCollateral[msg.sender] += msg.value; // Update user's collateral balance
        emit CollateralAdded(msg.sender, msg.value, i_coinDEX.currentPrice()); // Emit event for collateral addition
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
        if (s_userMinted[msg.sender] > 0) {
            _validatePosition(msg.sender);
        }

        // Transfer the collateral to the user
        payable(msg.sender).transfer(amount);

        emit CollateralWithdrawn(msg.sender, msg.sender, amount, i_coinDEX.currentPrice()); // Emit event for collateral withdrawal
    }

    // Allows users to mint stablecoins based on their collateral
    function mintStableCoin(uint256 mintAmount) public {
        if (mintAmount == 0) {
            revert Engine__InvalidAmount(); // Revert if mint amount is zero
        }
        _accrueInterest();
        _updateUserDebt(msg.sender);
        s_userMinted[msg.sender] += mintAmount;
        totalDebt += mintAmount;
        _validatePosition(msg.sender);
        bool success = i_myUSD.mintTo(msg.sender, mintAmount);
        if (!success) {
            revert Engine__MintingFailed(); // Revert if minting fails
        }
    }

    // Allows users to burn stablecoins and reduce their debt
    function burnStableCoin(uint256 burnAmount) public {
        if (burnAmount == 0 || burnAmount > s_userMinted[msg.sender]) {
            revert Engine__InvalidAmount(); // Revert if burn amount is invalid
        }
        _accrueInterest();
        _updateUserDebt(msg.sender);
        s_userMinted[msg.sender] -= burnAmount;
        totalDebt -= burnAmount;
        bool success = i_myUSD.burnFrom(msg.sender, burnAmount);
        if (!success) {
            revert Engine__BurningFailed(); // Revert if burning fails
        }
    }

    // Retrieves the user's position, including minted amount and collateral value
    function _getUserPosition(address user) private view returns (uint256 mintedAmount, uint256 collateralValue) {
        mintedAmount = s_userMinted[user]; // Get user's minted amount

        // Calculate accrued interest since last update
        if (mintedAmount > 0) {
            uint256 timeElapsed = block.timestamp - s_userLastUpdateTime[user];
            if (timeElapsed > 0) {
                uint256 userInterest = (mintedAmount * interestRate * timeElapsed) / (SECONDS_PER_YEAR * 10000);
                mintedAmount += userInterest;
            }
        }

        collateralValue = calculateCollateralValue(user); // Calculate user's collateral value
        return (mintedAmount, collateralValue); // Return user's position
    }

    // Calculates the total collateral value for a user based on their collateral balance and price point
    function calculateCollateralValue(address user) public view returns (uint256) {
        uint256 collateralAmount = s_userCollateral[user]; // Get user's collateral amount
        return (collateralAmount * i_coinDEX.currentPrice()) / 1e18; // Calculate collateral value in terms of ETH price
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

        uint256 userDebt = s_userMinted[user]; // Get user's minted amount
        uint256 userCollateral = s_userCollateral[user]; // Get user's collateral balance
        uint256 collateralValue = calculateCollateralValue(user); // Calculate user's collateral value

        // check that liquidator has enough funds to pay back the debt
        if (i_myUSD.balanceOf(msg.sender) < userDebt) {
            revert MyUSD__InsufficientBalance();
        }

        // check that liquidator has approved the engine to transfer the debt
        if (i_myUSD.allowance(msg.sender, address(this)) < userDebt) {
            revert MyUSD__InsufficientAllowance();
        }

        // tranfer value of debt to the contract
        i_myUSD.transferFrom(msg.sender, address(this), userDebt);

        // burn the transfered stablecoins
        i_myUSD.burnFrom(address(this), userDebt);

        // Clear user's debt
        s_userMinted[user] = 0;

        // calculate collateral to purchase (maintain the ratio of debt to collateral value)
        uint256 collateralPurchased = (userDebt * userCollateral) / collateralValue;
        uint256 liquidatorReward = (collateralPurchased * LIQUIDATOR_REWARD) / 100;
        uint256 amountForLiquidator = collateralPurchased + liquidatorReward;

        // transfer 110% of the debt to the liquidator
        (bool sent, bytes memory data) = payable(msg.sender).call{value: amountForLiquidator}("");
        require(sent, "Failed to send Ether");

        s_userCollateral[user] = userCollateral - amountForLiquidator;

        emit CollateralWithdrawn(user, msg.sender, amountForLiquidator, i_coinDEX.currentPrice()); // Emit event for collateral withdrawal
    }
}
