// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract RewardToken is ERC20 {
    uint256 public constant MAX_SUPPLY = 100_000_000 * 10**18;
    address public immutable rewardHook;
    event RewardsDistributed(address indexed to, uint256 amount);
    error OnlyRewardHook();
    error InsufficientRewards();
    constructor(address _hook) ERC20("X402 Reward Points", "X402RP") { require(_hook != address(0), "Invalid hook address"); rewardHook = _hook; _mint(address(this), MAX_SUPPLY); }
    function distribute(address to, uint256 amount) external { if (msg.sender != rewardHook) revert OnlyRewardHook(); if (balanceOf(address(this)) < amount) revert InsufficientRewards(); _transfer(address(this), to, amount); emit RewardsDistributed(to, amount); }
    function remainingRewards() external view returns (uint256) { return balanceOf(address(this)); }
}