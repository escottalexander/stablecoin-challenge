// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./CornDEX.sol";

contract MovePrice {
    CornDEX cornDex;

    constructor (address _cornDex, address _cornToken) {
        cornDex = CornDEX(_cornDex);
        // Approve the cornDEX to use the cornToken
        IERC20(_cornToken).approve(address(cornDex), type(uint256).max);
    }

    function movePrice(int256 newPrice) public {
        if (newPrice > 0) {
            cornDex.swap{value: uint256(newPrice)}(uint256(newPrice));
        } else {
            cornDex.swap(uint256(-newPrice));
        }
    }

    receive() external payable {}

    fallback() external payable {}
}
