// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

error MemeCoin__InvalidAmount();
error MemeCoin__InsufficientBalance();
error MemeCoin__InsufficientAllowance();
error MemeCoin__InvalidAddress();

contract MemeCoin is ERC20, Ownable {
    constructor(address _owner) ERC20("Meme", "Meme") Ownable(_owner) {}

    function burnFrom(address account, uint256 amount) external onlyOwner returns (bool) {
        uint256 balance = balanceOf(account);
        if (amount == 0) {
            revert MemeCoin__InvalidAmount();
        }
        if (balance < amount) {
            revert MemeCoin__InsufficientBalance();
        }
        _burn(account, amount);
        return true;
    }

    function mintTo(address to, uint256 amount) external onlyOwner returns (bool) {
        if (to == address(0)) {
            revert MemeCoin__InvalidAddress();
        }
        if (amount == 0) {
            revert MemeCoin__InvalidAmount();
        }
        _mint(to, amount);
        return true;
    }
}
