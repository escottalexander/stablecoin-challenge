// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./StablecoinDEX.sol";

/**
 * @notice This contract acts as a whale account that moves the price of MyUSD up and down whenever anyone calls it
 */
contract MovePrice {
    StablecoinDEX stablecoinDex;

    constructor(address _stablecoinDex, address _stablecoinToken) {
        stablecoinDex = StablecoinDEX(_stablecoinDex);
        // Approve the stablecoinDEX to use the stablecoinToken
        IERC20(_stablecoinToken).approve(address(stablecoinDex), type(uint256).max);
    }

    function movePrice(int256 size) public {
        if (size > 0) {
            stablecoinDex.swap{ value: uint256(size) }(uint256(size));
        } else {
            stablecoinDex.swap(uint256(-size));
        }
    }

    receive() external payable {}

    fallback() external payable {}
}
