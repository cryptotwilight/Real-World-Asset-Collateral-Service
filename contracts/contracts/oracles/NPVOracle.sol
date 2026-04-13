// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title NPVOracle
 * @notice Stub oracle reporting the Net Present Value (NPV) of the underlying RWA per LST.
 * @dev In production this would be driven by a verifiable off-chain valuation model or
 *      a credentialed third-party appraiser feed. Values are 18-decimal USD amounts.
 *
 *      NPV captures the discounted future cash-flow value of the physical/legal asset
 *      backing the LST (e.g. property appraisal, loan receivable book value).
 */
contract NPVOracle is Ownable {
    // token => NPV per single token (18 decimals USD)
    mapping(address => uint256) private _npvPerToken;

    // Authorised updaters
    mapping(address => bool) public isUpdater;

    event NPVUpdated(address indexed token, uint256 oldValue, uint256 newValue);
    event UpdaterSet(address indexed updater, bool enabled);

    modifier onlyUpdater() {
        require(msg.sender == owner() || isUpdater[msg.sender], "NPVOracle: not authorised");
        _;
    }

    constructor() Ownable(msg.sender) {}

    // ─── Configuration ───────────────────────────────────────────────────────

    function setUpdater(address updater, bool enabled) external onlyOwner {
        isUpdater[updater] = enabled;
        emit UpdaterSet(updater, enabled);
    }

    /**
     * @notice Set the NPV per token for an RWA LST.
     * @param token  RWA LST contract address
     * @param value  USD NPV per token in 18-decimal fixed point
     */
    function setNPVPerToken(address token, uint256 value) external onlyUpdater {
        emit NPVUpdated(token, _npvPerToken[token], value);
        _npvPerToken[token] = value;
    }

    /// @notice Batch update multiple tokens in one transaction
    function batchSetNPVPerToken(address[] calldata tokens, uint256[] calldata values) external onlyUpdater {
        require(tokens.length == values.length, "Length mismatch");
        for (uint256 i = 0; i < tokens.length; i++) {
            emit NPVUpdated(tokens[i], _npvPerToken[tokens[i]], values[i]);
            _npvPerToken[tokens[i]] = values[i];
        }
    }

    // ─── View ────────────────────────────────────────────────────────────────

    /// @notice NPV per single token (18 decimals USD)
    function getNPVPerToken(address token) external view returns (uint256) {
        return _npvPerToken[token];
    }

    /**
     * @notice Total NPV for a given token amount.
     * @param token  RWA LST address
     * @param amount Token amount (18 decimals)
     * @return USD NPV (18 decimals)
     */
    function getNPVValue(address token, uint256 amount) external view returns (uint256) {
        return (_npvPerToken[token] * amount) / 1e18;
    }
}
