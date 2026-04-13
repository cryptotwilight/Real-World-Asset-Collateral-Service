// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IMintable {
    function mint(address to, uint256 amount) external;
    function decimals() external view returns (uint8);
}

/**
 * @title Faucet
 * @notice Testnet faucet that mints 100 tokens of any registered token per call.
 *         Cooldown of 1 hour per token per address.
 */
contract Faucet is Ownable {
    uint256 public constant MINT_AMOUNT_STANDARD = 100; // 100 tokens (scaled by decimals)
    uint256 public cooldownPeriod = 1 hours;

    address[] public supportedTokens;
    mapping(address => bool) public isSupported;
    mapping(address => mapping(address => uint256)) public lastMint; // token => user => timestamp

    event TokensMinted(address indexed user, address indexed token, uint256 amount);
    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);

    constructor() Ownable(msg.sender) {}

    function addToken(address token) external onlyOwner {
        require(!isSupported[token], "Already supported");
        supportedTokens.push(token);
        isSupported[token] = true;
        emit TokenAdded(token);
    }

    function removeToken(address token) external onlyOwner {
        require(isSupported[token], "Not supported");
        isSupported[token] = false;
        emit TokenRemoved(token);
    }

    function setCooldown(uint256 _period) external onlyOwner {
        cooldownPeriod = _period;
    }

    /**
     * @notice Mint 100 tokens of `token` to caller.
     */
    function mint(address token) external {
        require(isSupported[token], "Token not supported");
        require(
            block.timestamp >= lastMint[token][msg.sender] + cooldownPeriod,
            "Cooldown active"
        );

        lastMint[token][msg.sender] = block.timestamp;

        uint8 decimals = IMintable(token).decimals();
        uint256 amount = MINT_AMOUNT_STANDARD * (10 ** decimals);

        IMintable(token).mint(msg.sender, amount);

        emit TokensMinted(msg.sender, token, amount);
    }

    /**
     * @notice Mint all supported tokens at once.
     */
    function mintAll() external {
        for (uint256 i = 0; i < supportedTokens.length; i++) {
            address token = supportedTokens[i];
            if (!isSupported[token]) continue;
            if (block.timestamp < lastMint[token][msg.sender] + cooldownPeriod) continue;

            lastMint[token][msg.sender] = block.timestamp;
            uint8 decimals = IMintable(token).decimals();
            uint256 amount = MINT_AMOUNT_STANDARD * (10 ** decimals);
            IMintable(token).mint(msg.sender, amount);
            emit TokensMinted(msg.sender, token, amount);
        }
    }

    function getSupportedTokens() external view returns (address[] memory) {
        return supportedTokens;
    }

    function canMint(address token, address user) external view returns (bool) {
        if (!isSupported[token]) return false;
        return block.timestamp >= lastMint[token][user] + cooldownPeriod;
    }
}
