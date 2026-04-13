// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./RWAToken.sol";

/**
 * @title RWATokenFactory
 * @notice Deploys new RWAToken instances and maintains a registry of all deployed tokens.
 */
contract RWATokenFactory is Ownable {
    struct TokenInfo {
        address tokenAddress;
        string name;
        string symbol;
        string assetDescription;
    }

    TokenInfo[] public tokens;
    mapping(address => bool) public isRegistered;

    event TokenCreated(address indexed tokenAddress, string name, string symbol, string assetDescription);

    constructor() Ownable(msg.sender) {}

    function createToken(
        string calldata name_,
        string calldata symbol_,
        string calldata assetDescription_,
        string calldata documentationURI_
    ) external onlyOwner returns (address) {
        RWAToken token = new RWAToken(name_, symbol_, assetDescription_, documentationURI_, msg.sender);
        address addr = address(token);

        tokens.push(TokenInfo({
            tokenAddress: addr,
            name: name_,
            symbol: symbol_,
            assetDescription: assetDescription_
        }));
        isRegistered[addr] = true;

        emit TokenCreated(addr, name_, symbol_, assetDescription_);
        return addr;
    }

    function getTokenCount() external view returns (uint256) {
        return tokens.length;
    }

    function getAllTokens() external view returns (TokenInfo[] memory) {
        return tokens;
    }

    /// @notice Register an externally deployed RWA token
    function registerToken(address tokenAddress, string calldata name_, string calldata symbol_, string calldata assetDescription_) external onlyOwner {
        require(!isRegistered[tokenAddress], "Already registered");
        tokens.push(TokenInfo({
            tokenAddress: tokenAddress,
            name: name_,
            symbol: symbol_,
            assetDescription: assetDescription_
        }));
        isRegistered[tokenAddress] = true;
        emit TokenCreated(tokenAddress, name_, symbol_, assetDescription_);
    }
}
