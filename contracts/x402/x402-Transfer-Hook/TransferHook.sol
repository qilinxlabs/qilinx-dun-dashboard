// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ISettlementHook} from "./ISettlementHook.sol";

contract TransferHook is ISettlementHook {
    using SafeERC20 for IERC20;
    struct Split { address recipient; uint16 bips; }
    address public immutable settlementRouter;
    event Transfer(bytes32 indexed contextKey, address indexed recipient, uint256 amount);
    event DistributedTransfer(bytes32 indexed contextKey, uint256 totalAmount, uint256 recipientCount);
    error OnlyRouter();
    error InvalidRouterAddress();
    error EmptySplits();
    error InvalidTotalBips(uint256 totalBips);
    error InvalidRecipient(address recipient);
    error InvalidBips(uint16 bips);
    modifier onlyRouter() { if (msg.sender != settlementRouter) revert OnlyRouter(); _; }
    constructor(address _settlementRouter) { if (_settlementRouter == address(0)) revert InvalidRouterAddress(); settlementRouter = _settlementRouter; }
    function execute(bytes32 contextKey, address, address token, uint256 amount, bytes32, address payTo, address, bytes calldata data) external onlyRouter returns (bytes memory) {
        if (payTo == address(0)) revert InvalidRecipient(address(0));
        if (data.length == 0) { return _executeSimpleTransfer(contextKey, token, amount, payTo); }
        return _executeDistributedTransfer(contextKey, token, amount, payTo, data);
    }
    function _executeSimpleTransfer(bytes32 contextKey, address token, uint256 amount, address recipient) private returns (bytes memory) {
        IERC20(token).safeTransferFrom(settlementRouter, recipient, amount);
        emit Transfer(contextKey, recipient, amount);
        return abi.encode(recipient, amount);
    }
    function _executeDistributedTransfer(bytes32 contextKey, address token, uint256 amount, address payTo, bytes calldata data) private returns (bytes memory) {
        Split[] memory splits = abi.decode(data, (Split[]));
        if (splits.length == 0) revert EmptySplits();
        uint256 totalBips = 0;
        for (uint256 i = 0; i < splits.length; i++) {
            if (splits[i].recipient == address(0)) revert InvalidRecipient(address(0));
            if (splits[i].bips == 0) revert InvalidBips(0);
            totalBips += splits[i].bips;
        }
        if (totalBips > 10000) revert InvalidTotalBips(totalBips);
        uint256 remaining = amount;
        for (uint256 i = 0; i < splits.length; i++) {
            uint256 splitAmount = (amount * splits[i].bips) / 10000;
            IERC20(token).safeTransferFrom(settlementRouter, splits[i].recipient, splitAmount);
            remaining -= splitAmount;
            emit Transfer(contextKey, splits[i].recipient, splitAmount);
        }
        uint256 recipientCount = splits.length;
        if (remaining > 0) {
            IERC20(token).safeTransferFrom(settlementRouter, payTo, remaining);
            emit Transfer(contextKey, payTo, remaining);
            recipientCount += 1;
        }
        emit DistributedTransfer(contextKey, amount, recipientCount);
        return abi.encode(recipientCount, amount);
    }
}