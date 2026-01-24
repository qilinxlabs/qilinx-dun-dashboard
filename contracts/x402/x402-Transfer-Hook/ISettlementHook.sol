// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

interface ISettlementHook {
    function execute(
        bytes32 contextKey,
        address payer,
        address token,
        uint256 amount,
        bytes32 salt,
        address payTo,
        address facilitator,
        bytes calldata data
    ) external returns (bytes memory result);
}