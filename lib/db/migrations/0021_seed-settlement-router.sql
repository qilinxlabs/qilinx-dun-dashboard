-- Migration: Seed x402 SettlementRouter contract template
-- This is the core protocol contract that must be deployed ONCE per network
-- All x402 Hook contracts (NFT, Reward, Transfer) share this single router

INSERT INTO "Contract_Template" (
    "id", "name", "description", "category", "soliditySourceCode",
    "sourceFiles", "deploymentConfig", "constructorParamsSchema", "createdAt"
) VALUES (
    gen_random_uuid(),
    'x402 Settlement Router',
    'Core x402 protocol contract for payment settlement. Deploy ONCE per network - all Hook contracts (NFT Mint, Reward Points, Transfer) share this single router. No constructor arguments required. Permissionless and ownerless.',
    'x402-settlement',
    $SOURCE$// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title IERC3009
 * @notice EIP-3009: Transfer With Authorization Interface
 */
interface IERC3009 {
    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes calldata signature
    ) external;
    
    function authorizationState(
        address authorizer,
        bytes32 nonce
    ) external view returns (bool);
}

/**
 * @title ISettlementHook
 * @notice Interface for settlement hooks that execute business logic after payment
 */
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

/**
 * @title SettlementRouter
 * @notice x402 Extended Settlement Router - Core protocol contract
 * @dev Deploy ONCE per network. All Hook contracts share this router.
 *      Permissionless - no owner, no admin, anyone can use it.
 */
contract SettlementRouter is ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    mapping(bytes32 => bool) public settled;
    mapping(address => mapping(address => uint256)) public pendingFees;
    mapping(address => mapping(address => bool)) public feeOperators;
    
    event Settled(
        bytes32 indexed contextKey,
        address indexed payer,
        address indexed token,
        uint256 amount,
        address hook,
        bytes32 salt,
        address payTo,
        uint256 facilitatorFee
    );
    
    event HookExecuted(bytes32 indexed contextKey, address indexed hook, bytes returnData);
    event FeeAccumulated(address indexed facilitator, address indexed token, uint256 amount);
    event FeesClaimed(address indexed facilitator, address indexed token, uint256 amount);
    event FeeOperatorSet(address indexed facilitator, address indexed operator, bool approved);
    
    error AlreadySettled(bytes32 contextKey);
    error InvalidCommitment(bytes32 expected, bytes32 actual);
    error TransferFailed(address token, uint256 expected, uint256 actual);
    error RouterShouldNotHoldFunds(address token, uint256 balance);
    error HookExecutionFailed(address hook, bytes reason);
    error InvalidOperator();
    error Unauthorized();
    error InsufficientBalanceForRecovery(address token, uint256 required, uint256 available);
    
    function settleAndExecute(
        address token,
        address from,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes calldata signature,
        bytes32 salt,
        address payTo,
        uint256 facilitatorFee,
        address hook,
        bytes calldata hookData
    ) external nonReentrant {
        bytes32 commitment = calculateCommitment(
            token, from, value, validAfter, validBefore,
            salt, payTo, facilitatorFee, hook, hookData
        );
        
        if (nonce != commitment) revert InvalidCommitment(commitment, nonce);
        
        bytes32 contextKey = calculateContextKey(from, token, nonce);
        if (settled[contextKey]) revert AlreadySettled(contextKey);
        settled[contextKey] = true;
        
        uint256 balanceBefore = IERC20(token).balanceOf(address(this));
        bool nonceAlreadyUsed = IERC3009(token).authorizationState(from, nonce);
        
        if (!nonceAlreadyUsed) {
            IERC3009(token).transferWithAuthorization(
                from, address(this), value, validAfter, validBefore, nonce, signature
            );
            uint256 balanceAfter = IERC20(token).balanceOf(address(this));
            if (balanceAfter - balanceBefore < value) {
                revert TransferFailed(token, value, balanceAfter - balanceBefore);
            }
        } else {
            if (balanceBefore < value) {
                revert InsufficientBalanceForRecovery(token, value, balanceBefore);
            }
        }
        
        if (facilitatorFee > 0) {
            pendingFees[msg.sender][token] += facilitatorFee;
            emit FeeAccumulated(msg.sender, token, facilitatorFee);
        }
        
        uint256 hookAmount = value - facilitatorFee;
        if (hook != address(0)) {
            IERC20(token).forceApprove(hook, hookAmount);
            try ISettlementHook(hook).execute(
                contextKey, from, token, hookAmount, salt, payTo, msg.sender, hookData
            ) returns (bytes memory result) {
                emit HookExecuted(contextKey, hook, result);
            } catch (bytes memory reason) {
                revert HookExecutionFailed(hook, reason);
            }
        }
        
        uint256 balanceFinal = IERC20(token).balanceOf(address(this));
        uint256 expectedBalance = nonceAlreadyUsed 
            ? balanceBefore - value + facilitatorFee 
            : balanceBefore + facilitatorFee;
        
        if (balanceFinal != expectedBalance) {
            revert RouterShouldNotHoldFunds(token, balanceFinal > expectedBalance ? balanceFinal - expectedBalance : expectedBalance - balanceFinal);
        }
        
        emit Settled(contextKey, from, token, value, hook, salt, payTo, facilitatorFee);
    }
    
    function isSettled(bytes32 contextKey) external view returns (bool) {
        return settled[contextKey];
    }
    
    function calculateContextKey(address from, address token, bytes32 nonce) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(from, token, nonce));
    }
    
    function calculateCommitment(
        address token, address from, uint256 value, uint256 validAfter, uint256 validBefore,
        bytes32 salt, address payTo, uint256 facilitatorFee, address hook, bytes calldata hookData
    ) public view returns (bytes32) {
        return keccak256(abi.encodePacked(
            "X402/settle/v1", block.chainid, address(this),
            token, from, value, validAfter, validBefore,
            salt, payTo, facilitatorFee, hook, keccak256(hookData)
        ));
    }
    
    function getPendingFees(address facilitator, address token) external view returns (uint256) {
        return pendingFees[facilitator][token];
    }
    
    function claimFees(address[] calldata tokens) external nonReentrant {
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 amount = pendingFees[msg.sender][tokens[i]];
            if (amount > 0) {
                pendingFees[msg.sender][tokens[i]] = 0;
                IERC20(tokens[i]).safeTransfer(msg.sender, amount);
                emit FeesClaimed(msg.sender, tokens[i], amount);
            }
        }
    }
    
    function setFeeOperator(address operator, bool approved) external {
        if (operator == address(0)) revert InvalidOperator();
        feeOperators[msg.sender][operator] = approved;
        emit FeeOperatorSet(msg.sender, operator, approved);
    }
    
    function isFeeOperator(address facilitator, address operator) external view returns (bool) {
        return feeOperators[facilitator][operator];
    }
    
    function claimFeesFor(address facilitator, address[] calldata tokens, address recipient) external nonReentrant {
        if (msg.sender != facilitator && !feeOperators[facilitator][msg.sender]) revert Unauthorized();
        address to = recipient == address(0) ? facilitator : recipient;
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 amount = pendingFees[facilitator][tokens[i]];
            if (amount > 0) {
                pendingFees[facilitator][tokens[i]] = 0;
                IERC20(tokens[i]).safeTransfer(to, amount);
                emit FeesClaimed(facilitator, tokens[i], amount);
            }
        }
    }
}$SOURCE$,
    '[{"filename": "SettlementRouter.sol", "content": "// SPDX-License-Identifier: Apache-2.0\npragma solidity ^0.8.20;\n\nimport {ReentrancyGuard} from \"@openzeppelin/contracts/utils/ReentrancyGuard.sol\";\nimport {IERC20} from \"@openzeppelin/contracts/token/ERC20/IERC20.sol\";\nimport {SafeERC20} from \"@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol\";\n\ninterface IERC3009 {\n    function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, bytes calldata signature) external;\n    function authorizationState(address authorizer, bytes32 nonce) external view returns (bool);\n}\n\ninterface ISettlementHook {\n    function execute(bytes32 contextKey, address payer, address token, uint256 amount, bytes32 salt, address payTo, address facilitator, bytes calldata data) external returns (bytes memory result);\n}\n\ncontract SettlementRouter is ReentrancyGuard {\n    using SafeERC20 for IERC20;\n    mapping(bytes32 => bool) public settled;\n    mapping(address => mapping(address => uint256)) public pendingFees;\n    mapping(address => mapping(address => bool)) public feeOperators;\n    event Settled(bytes32 indexed contextKey, address indexed payer, address indexed token, uint256 amount, address hook, bytes32 salt, address payTo, uint256 facilitatorFee);\n    event HookExecuted(bytes32 indexed contextKey, address indexed hook, bytes returnData);\n    event FeeAccumulated(address indexed facilitator, address indexed token, uint256 amount);\n    event FeesClaimed(address indexed facilitator, address indexed token, uint256 amount);\n    event FeeOperatorSet(address indexed facilitator, address indexed operator, bool approved);\n    error AlreadySettled(bytes32 contextKey);\n    error InvalidCommitment(bytes32 expected, bytes32 actual);\n    error TransferFailed(address token, uint256 expected, uint256 actual);\n    error RouterShouldNotHoldFunds(address token, uint256 balance);\n    error HookExecutionFailed(address hook, bytes reason);\n    error InvalidOperator();\n    error Unauthorized();\n    error InsufficientBalanceForRecovery(address token, uint256 required, uint256 available);\n    function settleAndExecute(address token, address from, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, bytes calldata signature, bytes32 salt, address payTo, uint256 facilitatorFee, address hook, bytes calldata hookData) external nonReentrant {\n        bytes32 commitment = calculateCommitment(token, from, value, validAfter, validBefore, salt, payTo, facilitatorFee, hook, hookData);\n        if (nonce != commitment) revert InvalidCommitment(commitment, nonce);\n        bytes32 contextKey = calculateContextKey(from, token, nonce);\n        if (settled[contextKey]) revert AlreadySettled(contextKey);\n        settled[contextKey] = true;\n        uint256 balanceBefore = IERC20(token).balanceOf(address(this));\n        bool nonceAlreadyUsed = IERC3009(token).authorizationState(from, nonce);\n        if (!nonceAlreadyUsed) {\n            IERC3009(token).transferWithAuthorization(from, address(this), value, validAfter, validBefore, nonce, signature);\n            uint256 balanceAfter = IERC20(token).balanceOf(address(this));\n            if (balanceAfter - balanceBefore < value) { revert TransferFailed(token, value, balanceAfter - balanceBefore); }\n        } else {\n            if (balanceBefore < value) { revert InsufficientBalanceForRecovery(token, value, balanceBefore); }\n        }\n        if (facilitatorFee > 0) { pendingFees[msg.sender][token] += facilitatorFee; emit FeeAccumulated(msg.sender, token, facilitatorFee); }\n        uint256 hookAmount = value - facilitatorFee;\n        if (hook != address(0)) {\n            IERC20(token).forceApprove(hook, hookAmount);\n            try ISettlementHook(hook).execute(contextKey, from, token, hookAmount, salt, payTo, msg.sender, hookData) returns (bytes memory result) { emit HookExecuted(contextKey, hook, result); } catch (bytes memory reason) { revert HookExecutionFailed(hook, reason); }\n        }\n        uint256 balanceFinal = IERC20(token).balanceOf(address(this));\n        uint256 expectedBalance = nonceAlreadyUsed ? balanceBefore - value + facilitatorFee : balanceBefore + facilitatorFee;\n        if (balanceFinal != expectedBalance) { revert RouterShouldNotHoldFunds(token, balanceFinal > expectedBalance ? balanceFinal - expectedBalance : expectedBalance - balanceFinal); }\n        emit Settled(contextKey, from, token, value, hook, salt, payTo, facilitatorFee);\n    }\n    function isSettled(bytes32 contextKey) external view returns (bool) { return settled[contextKey]; }\n    function calculateContextKey(address from, address token, bytes32 nonce) public pure returns (bytes32) { return keccak256(abi.encodePacked(from, token, nonce)); }\n    function calculateCommitment(address token, address from, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 salt, address payTo, uint256 facilitatorFee, address hook, bytes calldata hookData) public view returns (bytes32) { return keccak256(abi.encodePacked(\"X402/settle/v1\", block.chainid, address(this), token, from, value, validAfter, validBefore, salt, payTo, facilitatorFee, hook, keccak256(hookData))); }\n    function getPendingFees(address facilitator, address token) external view returns (uint256) { return pendingFees[facilitator][token]; }\n    function claimFees(address[] calldata tokens) external nonReentrant { for (uint256 i = 0; i < tokens.length; i++) { uint256 amount = pendingFees[msg.sender][tokens[i]]; if (amount > 0) { pendingFees[msg.sender][tokens[i]] = 0; IERC20(tokens[i]).safeTransfer(msg.sender, amount); emit FeesClaimed(msg.sender, tokens[i], amount); } } }\n    function setFeeOperator(address operator, bool approved) external { if (operator == address(0)) revert InvalidOperator(); feeOperators[msg.sender][operator] = approved; emit FeeOperatorSet(msg.sender, operator, approved); }\n    function isFeeOperator(address facilitator, address operator) external view returns (bool) { return feeOperators[facilitator][operator]; }\n    function claimFeesFor(address facilitator, address[] calldata tokens, address recipient) external nonReentrant { if (msg.sender != facilitator && !feeOperators[facilitator][msg.sender]) revert Unauthorized(); address to = recipient == address(0) ? facilitator : recipient; for (uint256 i = 0; i < tokens.length; i++) { uint256 amount = pendingFees[facilitator][tokens[i]]; if (amount > 0) { pendingFees[facilitator][tokens[i]] = 0; IERC20(tokens[i]).safeTransfer(to, amount); emit FeesClaimed(facilitator, tokens[i], amount); } } }\n}", "isMain": true, "contractName": "SettlementRouter"}]'::jsonb,
    '{"deploymentOrder": ["SettlementRouter.sol"], "dependencies": {"SettlementRouter.sol": {"constructorParams": []}}}'::jsonb,
    '[]'::jsonb,
    NOW()
);
