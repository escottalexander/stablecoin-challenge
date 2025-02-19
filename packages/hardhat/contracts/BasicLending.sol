// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./Corn.sol";
import "./CornDEX.sol";

error Lending__InvalidAmount();
error Lending__TransferFailed();
error Lending__UnsafePositionRatio();
error Lending__BorrowingFailed();
error Lending__RepayingFailed();
error Lending__PositionSafe();
error Lending__NotLiquidatable();

contract BasicLending is Ownable {
    uint256 private constant COLLATERAL_RATIO = 120; // 120% collateralization required
    uint256 private constant LIQUIDATOR_REWARD = 10; // 10% reward for liquidators

    Corn private i_corn;
    CornDEX private i_cornDEX;

    mapping(address => uint256) public s_userCollateral; // User's collateral balance
    mapping(address => uint256) public s_userBorrowed; // User's borrowed corn balance

    event CollateralAdded(address indexed user, uint256 indexed amount, uint256 price);
    event CollateralWithdrawn(address indexed from, address indexed to, uint256 indexed amount, uint256 price);
    event AssetBorrowed(address indexed user, uint256 indexed amount, uint256 price);
    event AssetRepaid(address indexed user, uint256 indexed amount, uint256 price);

    constructor(address _cornDEX, address _corn) Ownable(msg.sender) {
        i_cornDEX = CornDEX(_cornDEX);
        i_corn = Corn(_corn);
    }

    // Allows users to add collateral to their account
    function addCollateral() public payable {
        if (msg.value == 0) {
            revert Lending__InvalidAmount(); // Revert if no collateral is sent
        }
        s_userCollateral[msg.sender] += msg.value; // Update user's collateral balance
        emit CollateralAdded(msg.sender, msg.value, i_cornDEX.currentPrice()); // Emit event for collateral addition
    }

    // Allows users to withdraw collateral as long as it doesn't make them liquidatable
    function withdrawCollateral(uint256 amount) external {
        if (amount == 0 || s_userCollateral[msg.sender] < amount) {
            revert Lending__InvalidAmount(); // Revert if the amount is invalid
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

        emit CollateralWithdrawn(msg.sender, msg.sender, amount, i_cornDEX.currentPrice()); // Emit event for collateral withdrawal
    }

    // Allows users to borrow corn based on their collateral
    function borrowCorn(uint256 borrowAmount) public {
        if (borrowAmount == 0) {
            revert Lending__InvalidAmount(); // Revert if borrow amount is zero
        }
        s_userBorrowed[msg.sender] += borrowAmount; // Update user's borrowed corn balance
        _validatePosition(msg.sender); // Validate user's position before borrowing
        bool success = i_corn.mintTo(msg.sender, borrowAmount); // Borrow corn to user
        if (!success) {
            revert Lending__BorrowingFailed(); // Revert if borrowing fails
        }
        emit AssetBorrowed(msg.sender, borrowAmount, i_cornDEX.currentPrice()); // Emit event for borrowing
    }

    // Allows users to repay corn and reduce their debt
    function repayCorn(uint256 repayAmount) public {
        if (repayAmount == 0 || repayAmount > s_userBorrowed[msg.sender]) {
            revert Lending__InvalidAmount(); // Revert if repay amount is invalid
        }
        s_userBorrowed[msg.sender] -= repayAmount; // Reduce user's borrowed balance
        bool success = i_corn.burnFrom(msg.sender, repayAmount); // Burn corns from user
        if (!success) {
            revert Lending__RepayingFailed(); // Revert if burning fails
        }
        emit AssetRepaid(msg.sender, repayAmount, i_cornDEX.currentPrice()); // Emit event for repaying
    }

    // Retrieves the user's position, including borrowed amount and collateral value
    function _getUserPosition(address user) private view returns (uint256 borrowedAmount, uint256 collateralValue) {
        borrowedAmount = s_userBorrowed[user]; // Get user's borrowed amount
        collateralValue = calculateCollateralValue(user); // Calculate user's collateral value
        return (borrowedAmount, collateralValue); // Return user's position
    }

    // Calculates the total collateral value for a user based on their collateral balance and price point
    function calculateCollateralValue(address user) public view returns (uint256) {
        uint256 collateralAmount = s_userCollateral[user]; // Get user's collateral amount
        return (collateralAmount * i_cornDEX.currentPrice()) / 1e18; // Calculate collateral value in terms of ETH price
    }

    // Calculates the position ratio for a user to ensure they are within safe limits
    function _calculatePositionRatio(address user) private view returns (uint256) {
        (uint256 borrowedAmount, uint256 collateralValue) = _getUserPosition(user); // Get user's position
        if (borrowedAmount == 0) return type(uint256).max; // Return max if no corn is borrowed
        return (collateralValue * 1e18) / borrowedAmount; // Calculate position ratio
    }

    // Validates the user's position to ensure it meets safety requirements
    function _validatePosition(address user) internal view {
        uint256 positionRatio = _calculatePositionRatio(user); // Calculate user's position ratio
        if ((positionRatio * 100) < COLLATERAL_RATIO * 1e18) {
            revert Lending__UnsafePositionRatio(); // Revert if position is unsafe
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
            revert Lending__NotLiquidatable(); // Revert if position is not liquidatable
        }

        uint256 userDebt = s_userBorrowed[user]; // Get user's borrowed amount
        uint256 userCollateral = s_userCollateral[user]; // Get user's collateral balance
        uint256 collateralValue = calculateCollateralValue(user); // Calculate user's collateral value

        // check that liquidator has enough funds to pay back the debt
        if (i_corn.balanceOf(msg.sender) < userDebt) {
            revert Corn__InsufficientBalance();
        }

        // check that liquidator has approved the engine to transfer the debt
        if (i_corn.allowance(msg.sender, address(this)) < userDebt) {
            revert Corn__InsufficientAllowance();
        }

        // tranfer value of debt to the contract
        i_corn.transferFrom(msg.sender, address(this), userDebt);

        // burn the transfered corn
        i_corn.burnFrom(address(this), userDebt);

        // Clear user's debt
        s_userBorrowed[user] = 0;

        // calculate collateral to purchase (maintain the ratio of debt to collateral value)
        uint256 collateralPurchased = (userDebt * userCollateral) / collateralValue;
        uint256 liquidatorReward = (collateralPurchased * LIQUIDATOR_REWARD) / 100;
        uint256 amountForLiquidator = collateralPurchased + liquidatorReward;
        amountForLiquidator = amountForLiquidator > userCollateral ? userCollateral : amountForLiquidator; // Ensure we don't exceed user's collateral

        // transfer 110% of the debt to the liquidator
        (bool sent,) = payable(msg.sender).call{ value: amountForLiquidator }("");
        require(sent, "Failed to send Ether");

        s_userCollateral[user] = userCollateral - amountForLiquidator;

        emit CollateralWithdrawn(user, msg.sender, amountForLiquidator, i_cornDEX.currentPrice()); // Emit event for collateral withdrawal
        emit AssetRepaid(msg.sender, userDebt, i_cornDEX.currentPrice()); // Emit event for repaying
    }
}
