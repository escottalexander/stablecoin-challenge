// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

error Stablecoin__InvalidAmount();
error Stablecoin__InsufficientBalance();
error Stablecoin__InsufficientAllowance();
error Stablecoin__InvalidAddress();

contract Stablecoin is ERC20, Ownable {
    constructor() ERC20("MyUSD", "MyUSD") Ownable(msg.sender) {}

    function burnFrom(address account, uint256 amount) external onlyOwner returns (bool) {
        uint256 balance = balanceOf(account);
        if (amount == 0) {
            revert Stablecoin__InvalidAmount();
        }
        if (balance < amount) {
            revert Stablecoin__InsufficientBalance();
        }
        _burn(account, amount);
        return true;
    }

    function mintTo(address to, uint256 amount) external onlyOwner returns (bool) {
        if (to == address(0)) {
            revert Stablecoin__InvalidAddress();
        }
        if (amount == 0) {
            revert Stablecoin__InvalidAmount();
        }
        _mint(to, amount);
        return true;
    }
}
