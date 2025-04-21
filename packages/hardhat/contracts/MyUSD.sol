// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

error MyUSD__InvalidAmount();
error MyUSD__InsufficientBalance();
error MyUSD__InsufficientAllowance();
error MyUSD__InvalidAddress();
error MyUSD__NotStakingEngine();
error MyUSD__NotAuthorized();

contract MyUSD is ERC20, Ownable {
    address public stakingContract;
    address public engineContract;
    bool private _virtualBalanceEnabled;

    constructor() ERC20("MyUSD", "MyUSD") Ownable(msg.sender) {}

    function setStakingContract(address _stakingContract) external onlyOwner {
        stakingContract = _stakingContract;
    }

    function setEngineContract(address _engineContract) external onlyOwner {
        engineContract = _engineContract;
    }

    function enableVirtualBalance() external onlyOwner {
        _virtualBalanceEnabled = true;
    }

    function burnFrom(address account, uint256 amount) external returns (bool) {
        if (msg.sender != engineContract && msg.sender != owner()) revert MyUSD__NotAuthorized();

        uint256 balance = balanceOf(account);
        if (amount == 0) {
            revert MyUSD__InvalidAmount();
        }
        if (balance < amount) {
            revert MyUSD__InsufficientBalance();
        }
        _burn(account, amount);
        return true;
    }

    function mintTo(address to, uint256 amount) external returns (bool) {
        if (msg.sender != engineContract && msg.sender != owner()) revert MyUSD__NotAuthorized();

        if (to == address(0)) {
            revert MyUSD__InvalidAddress();
        }
        if (amount == 0) {
            revert MyUSD__InvalidAmount();
        }
        _mint(to, amount);
        return true;
    }

    /**
     * @dev Overrides the standard balanceOf function to handle virtual balances for staking
     */
    function balanceOf(address account) public view override returns (uint256) {
        // For normal accounts, return standard balance
        if (account != stakingContract || !_virtualBalanceEnabled) {
            return super.balanceOf(account);
        }

        // For staking contract, return ∞ (max uint256) to represent unlimited minting ability
        // In practice, this means the staking contract can always withdraw tokens up to what
        // it needs based on the calculated interest from the Staking contract
        return type(uint256).max;
    }

    /**
     * @dev Overrides the transfer function to handle virtual balance for staking
     */
    function transfer(address to, uint256 amount) public override returns (bool) {
        if (msg.sender == stakingContract && _virtualBalanceEnabled) {
            // If staking contract is transferring to users (withdrawals), mint tokens on demand
            _mint(to, amount);
            return true;
        }

        return super.transfer(to, amount);
    }

    /**
     * @dev Overrides the transferFrom function to handle virtual balance for staking
     */
    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        if (from == stakingContract && _virtualBalanceEnabled) {
            // If transferring from staking contract (withdrawals), mint tokens on demand
            _mint(to, amount);
            return true;
        }

        // For deposits to staking, burn the tokens as they'll be virtually tracked
        if (to == stakingContract && _virtualBalanceEnabled) {
            if (allowance(from, msg.sender) < amount) {
                revert MyUSD__InsufficientAllowance();
            }

            // Burn the tokens from the sender and reduce allowance
            _spendAllowance(from, msg.sender, amount);
            _burn(from, amount);
            return true;
        }

        return super.transferFrom(from, to, amount);
    }
}
