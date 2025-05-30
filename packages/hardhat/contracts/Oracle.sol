// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./DEX.sol";

contract Oracle {
    /* ========== STATE VARIABLES ========== */

    DEX public dexAddress;

    /* ========== CONSTRUCTOR ========== */

    constructor(address _dexAddress) {
        dexAddress = DEX(_dexAddress);
    }

    /* ========== PUBLIC FUNCTIONS ========== */

    function getPrice() public view returns (uint256) {
        // Oracle just returns price from DEX unless no liquidity is available
        uint256 _price = dexAddress.currentPrice();
        if (_price == 0) {
            _price = 1800 ether; // Default price of 1 ETH in MyUSD
        }
        return _price;
    }
}
