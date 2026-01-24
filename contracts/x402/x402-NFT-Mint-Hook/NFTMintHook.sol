// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ISettlementHook} from "./ISettlementHook.sol";

contract NFTMintHook is ISettlementHook {
    using SafeERC20 for IERC20;
    address public immutable settlementRouter;
    struct MintConfig { address nftContract; }
    event NFTMinted(bytes32 indexed contextKey, address indexed nftContract, address indexed recipient);
    event PaymentTransferred(bytes32 indexed contextKey, address indexed payTo, uint256 amount);
    error OnlyRouter();
    error InvalidAddress();
    modifier onlyRouter() { if (msg.sender != settlementRouter) revert OnlyRouter(); _; }
    constructor(address _settlementRouter) { require(_settlementRouter != address(0), "Invalid router"); settlementRouter = _settlementRouter; }
    function execute(bytes32 contextKey, address payer, address token, uint256 amount, bytes32 salt, address payTo, address facilitator, bytes calldata data) external onlyRouter returns (bytes memory) {
        MintConfig memory config = abi.decode(data, (MintConfig));
        if (config.nftContract == address(0)) revert InvalidAddress();
        if (payTo == address(0)) revert InvalidAddress();
        IERC20(token).safeTransferFrom(settlementRouter, payTo, amount);
        emit PaymentTransferred(contextKey, payTo, amount);
        _safeMint(config.nftContract, payer);
        emit NFTMinted(contextKey, config.nftContract, payer);
        return abi.encode(config.nftContract);
    }
    function _safeMint(address nftContract, address to) internal {
        (bool success, bytes memory returnData) = nftContract.call(abi.encodeWithSignature("mint(address)", to));
        if (!success) { if (returnData.length > 0) { assembly { let s := mload(returnData) revert(add(32, returnData), s) } } else { revert("NFT mint failed"); } }
    }
}