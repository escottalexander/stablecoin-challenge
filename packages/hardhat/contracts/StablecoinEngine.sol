// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./Stablecoin.sol";
import "./StablecoinDEX.sol";

error StablecoinEngine__InvalidAmount();
error StablecoinEngine__TransferFailed();
error StablecoinEngine__UnsafePositionRatio();
error StablecoinEngine__BorrowingFailed();
error StablecoinEngine__RepayingFailed();
error StablecoinEngine__PositionSafe();
error StablecoinEngine__NotLiquidatable();

contract StablecoinEngine is Ownable {
    uint256 private constant COLLATERAL_RATIO = 120; // 120% collateralization required
    uint256 private constant LIQUIDATOR_REWARD = 10; // 10% reward for liquidators

    Stablecoin private i_stablecoin;
    StablecoinDEX private i_stablecoinDEX;

    mapping(address => uint256) public s_userCollateral; // User's collateral balance
    mapping(address => uint256) public s_userBorrowed; // User's borrowed stablecoin balance

    event CollateralAdded(address indexed user, uint256 indexed amount, uint256 price);
    event CollateralWithdrawn(address indexed user, uint256 indexed amount, uint256 price);
    event AssetBorrowed(address indexed user, uint256 indexed amount, uint256 price);
    event AssetRepaid(address indexed user, uint256 indexed amount, uint256 price);
    event Liquidation(
        address indexed user,
        address indexed liquidator,
        uint256 amountForLiquidator,
        uint256 liquidatedUserDebt,
        uint256 price
    );

    constructor(address _stablecoinDEX, address _stablecoin) Ownable(msg.sender) {
        i_stablecoinDEX = StablecoinDEX(_stablecoinDEX);
        i_stablecoin = Stablecoin(_stablecoin);
    }

    /**
     * @notice Allows users to add collateral to their account
     */
    function addCollateral() public payable {
        if (msg.value == 0) {
            revert StablecoinEngine__InvalidAmount(); // Revert if no collateral is sent
        }
        s_userCollateral[msg.sender] += msg.value; // Update user's collateral balance
        emit CollateralAdded(msg.sender, msg.value, i_stablecoinDEX.currentPrice()); // Emit event for collateral addition
    }

    /**
     * @notice Allows users to withdraw collateral as long as it doesn't make them liquidatable
     * @param amount The amount of collateral to withdraw
     */
    function withdrawCollateral(uint256 amount) public {
        if (amount == 0 || s_userCollateral[msg.sender] < amount) {
            revert StablecoinEngine__InvalidAmount(); // Revert if the amount is invalid
        }

        // Temporarily reduce the user's collateral to check if they remain safe
        uint256 newCollateral = s_userCollateral[msg.sender] - amount;
        s_userCollateral[msg.sender] = newCollateral;

        // Validate the user's position after withdrawal
        if (s_userBorrowed[msg.sender] > 0) {
            _validatePosition(msg.sender);
        }

        // Transfer the collateral to the user
        payable(msg.sender).transfer(amount);

        emit CollateralWithdrawn(msg.sender, amount, i_stablecoinDEX.currentPrice()); // Emit event for collateral withdrawal
    }

    /**
     * @notice Calculates the total collateral value for a user based on their collateral balance
     * @param user The address of the user to calculate the collateral value for
     * @return uint256 The collateral value
     */
    function calculateCollateralValue(address user) public view returns (uint256) {
        uint256 collateralAmount = s_userCollateral[user]; // Get user's collateral amount
        return (collateralAmount * i_stablecoinDEX.currentPrice()) / 1e18; // Calculate collateral value in MyUSD
    }

    /**
     * @notice Calculates the position ratio for a user to ensure they are within safe limits
     * @param user The address of the user to calculate the position ratio for
     * @return uint256 The position ratio
     */
    function _calculatePositionRatio(address user) internal view returns (uint256) {
        uint borrowedAmount = s_userBorrowed[user]; // Get user's borrowed amount
        uint collateralValue = calculateCollateralValue(user); // Calculate user's collateral value
        if (borrowedAmount == 0) return type(uint256).max; // Return max if no stablecoin is borrowed
        return (collateralValue * 1e18) / borrowedAmount; // Calculate position ratio
    }

    /**
     * @notice Checks if a user's position can be liquidated
     * @param user The address of the user to check
     * @return bool True if the position is liquidatable, false otherwise
     */
    function isLiquidatable(address user) public view returns (bool) {
        uint256 positionRatio = _calculatePositionRatio(user); // Calculate user's position ratio
        return (positionRatio * 100) < COLLATERAL_RATIO * 1e18; // Check if position is unsafe
    }

    /**
     * @notice Internal view method that reverts if a user's position is unsafe
     * @param user The address of the user to validate
     */
    function _validatePosition(address user) internal view {
        if (isLiquidatable(user)) {
            revert StablecoinEngine__UnsafePositionRatio(); // Revert if position is unsafe
        }
    }

    /**
     * @notice Allows users to borrow stablecoin based on their collateral
     * @param borrowAmount The amount of stablecoin to borrow
     */
    function borrowStablecoin(uint256 borrowAmount) public {
        if (borrowAmount == 0) {
            revert StablecoinEngine__InvalidAmount(); // Revert if borrow amount is zero
        }
        s_userBorrowed[msg.sender] += borrowAmount; // Update user's borrowed stablecoin balance
        _validatePosition(msg.sender); // Validate user's position before borrowing
        bool success = i_stablecoin.mintTo(msg.sender, borrowAmount); // Borrow stablecoin to user
        if (!success) {
            revert StablecoinEngine__BorrowingFailed(); // Revert if borrowing fails
        }
        emit AssetBorrowed(msg.sender, borrowAmount, i_stablecoinDEX.currentPrice()); // Emit event for borrowing
    }

    /**
     * @notice Allows users to repay stablecoin and reduce their debt
     * @param repayAmount The amount of stablecoin to repay
     */
    function repayStablecoin(uint256 repayAmount) public {
        if (repayAmount == 0 || repayAmount > s_userBorrowed[msg.sender]) {
            revert StablecoinEngine__InvalidAmount(); // Revert if repay amount is invalid
        }
        s_userBorrowed[msg.sender] -= repayAmount; // Reduce user's borrowed balance
        bool success = i_stablecoin.burnFrom(msg.sender, repayAmount); // Burn stablecoins from user
        if (!success) {
            revert StablecoinEngine__RepayingFailed(); // Revert if burning fails
        }
        emit AssetRepaid(msg.sender, repayAmount, i_stablecoinDEX.currentPrice()); // Emit event for repaying
    }

    /**
     * @notice Allows liquidators to liquidate unsafe positions
     * @param user The address of the user to liquidate
     * @dev The caller must have enough MyUSD to pay back user's debt
     * @dev The caller must have approved this contract to transfer the debt
     */
    function liquidate(address user) public {
        if (!isLiquidatable(user)) {
            revert StablecoinEngine__NotLiquidatable(); // Revert if position is not liquidatable
        }

        uint256 userDebt = s_userBorrowed[user]; // Get user's borrowed amount
        uint256 userCollateral = s_userCollateral[user]; // Get user's collateral balance
        uint256 collateralValue = calculateCollateralValue(user); // Calculate user's collateral value

        // transfer value of debt to the contract
        i_stablecoin.transferFrom(msg.sender, address(this), userDebt);

        // burn the transferred stablecoin
        i_stablecoin.burnFrom(address(this), userDebt);

        // Clear user's debt
        s_userBorrowed[user] = 0;

        // calculate collateral to purchase (maintain the ratio of debt to collateral value)
        uint256 collateralPurchased = (userDebt * userCollateral) / collateralValue;
        uint256 liquidatorReward = (collateralPurchased * LIQUIDATOR_REWARD) / 100;
        uint256 amountForLiquidator = collateralPurchased + liquidatorReward;
        amountForLiquidator = amountForLiquidator > userCollateral ? userCollateral : amountForLiquidator; // Ensure we don't exceed user's collateral

        s_userCollateral[user] = userCollateral - amountForLiquidator;

        // transfer 110% of the collateral needed to cover the debt to the liquidator
        (bool sent, ) = payable(msg.sender).call{ value: amountForLiquidator }("");
        require(sent, "Failed to send Ether");

        emit Liquidation(user, msg.sender, amountForLiquidator, userDebt, i_stablecoinDEX.currentPrice());
    }
}
