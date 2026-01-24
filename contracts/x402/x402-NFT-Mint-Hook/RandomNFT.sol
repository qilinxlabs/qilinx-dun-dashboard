// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract RandomNFT is ERC721 {
    uint256 public constant MAX_SUPPLY = 10000;
    address public minter;
    uint256 private _nextTokenId;
    event MinterSet(address indexed minter);
    error OnlyMinter();
    error MaxSupplyReached();
    constructor(address _minter) ERC721("X402 Random NFT", "X402RNFT") { require(_minter != address(0), "Invalid minter"); minter = _minter; emit MinterSet(_minter); }
    function mint(address to) external { if (msg.sender != minter) revert OnlyMinter(); if (_nextTokenId >= MAX_SUPPLY) revert MaxSupplyReached(); uint256 tokenId = _nextTokenId++; _safeMint(to, tokenId); }
    function totalSupply() external view returns (uint256) { return _nextTokenId; }
    function remainingSupply() external view returns (uint256) { return MAX_SUPPLY - _nextTokenId; }
}