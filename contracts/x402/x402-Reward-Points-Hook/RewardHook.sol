// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ISettlementHook} from "./ISettlementHook.sol";

interface IRewardToken { function distribute(address to, uint256 amount) external; }

contract RewardHook is ISettlementHook {
    using SafeERC20 for IERC20;
    address public immutable settlementRouter;
    uint256 public constant REWARD_RATE = 1000;
    uint256 public constant MAX_REWARD_AMOUNT = 100_000;
    struct RewardConfig { address rewardToken; }
    event RewardDistributed(bytes32 indexed contextKey, address indexed payer, address indexed payTo, address rewardToken, uint256 paymentAmount, uint256 rewardPoints);
    error OnlyRouter();
    error InvalidAddress();
    error RewardDistributionFailed();
    modifier onlyRouter() { if (msg.sender != settlementRouter) revert OnlyRouter(); _; }
    constructor(address _settlementRouter) { require(_settlementRouter != address(0), "Invalid router address"); settlementRouter = _settlementRouter; }
    function execute(bytes32 contextKey, address payer, address token, uint256 amount, bytes32 salt, address payTo, address facilitator, bytes calldata data) external onlyRouter returns (bytes memory) {
        RewardConfig memory config = abi.decode(data, (RewardConfig));
        if (config.rewardToken == address(0)) revert InvalidAddress();
        if (payTo == address(0)) revert InvalidAddress();
        IERC20(token).safeTransferFrom(settlementRouter, payTo, amount);
        uint256 rewardableAmount = amount > MAX_REWARD_AMOUNT ? MAX_REWARD_AMOUNT : amount;
        uint256 rewardPoints;
        unchecked { rewardPoints = (rewardableAmount * REWARD_RATE * 10**18) / 100_000; }
        try IRewardToken(config.rewardToken).distribute(payer, rewardPoints) {
            emit RewardDistributed(contextKey, payer, payTo, config.rewardToken, amount, rewardPoints);
        } catch { revert RewardDistributionFailed(); }
        return abi.encode(rewardPoints);
    }
}