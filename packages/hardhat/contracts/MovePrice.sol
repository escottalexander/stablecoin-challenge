// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./CoinDEX.sol";

/**
 * @notice This contract acts as a whale account that moves the price of MyUSD up and down whenever anyone calls it
 */
contract MovePrice {
    CoinDEX coinDex;

    constructor (address _coinDex, address _MyUSDToken) {
        coinDex = CoinDEX(_coinDex);
        // Approve the MyUSDDEX to use the MyUSDToken
        IERC20(_MyUSDToken).approve(address(coinDex), type(uint256).max);
    }

    function movePrice(int256 size) public {
        if (size > 0) {
            coinDex.swap{value: uint256(size)}(uint256(size));
        } else {
            coinDex.swap(uint256(-size));
        }
    }

    receive() external payable {}

    fallback() external payable {}
}
