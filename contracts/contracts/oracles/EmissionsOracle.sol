// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title EmissionsOracle
 * @notice Stub oracle reporting the USD value of RWA protocol emissions entitlement per LST.
 * @dev In production this would be replaced with a Chainlink feed or a custom push oracle
 *      updated by an authorised off-chain keeper. Values are 18-decimal USD amounts.
 *
 *      "Emissions entitlement" represents the present value of future yield/income streams
 *      attached to the underlying RWA (e.g. rental income, royalties, dividends).
 */
contract EmissionsOracle is Ownable {
    // token => USD emissions value per single token (18 decimals)
    mapping(address => uint256) private _emissionsPerToken;

    // Authorised updaters (keepers/admin) beyond the owner
    mapping(address => bool) public isUpdater;

    event EmissionsValueUpdated(address indexed token, uint256 oldValue, uint256 newValue);
    event UpdaterSet(address indexed updater, bool enabled);

    modifier onlyUpdater() {
        require(msg.sender == owner() || isUpdater[msg.sender], "EmissionsOracle: not authorised");
        _;
    }

    constructor() Ownable(msg.sender) {}

    // ─── Configuration ───────────────────────────────────────────────────────

    function setUpdater(address updater, bool enabled) external onlyOwner {
        isUpdater[updater] = enabled;
        emit UpdaterSet(updater, enabled);
    }

    /**
     * @notice Set the emissions value per token for an RWA LST.
     * @param token  RWA LST contract address
     * @param value  USD value per token in 18-decimal fixed point
     */
    function setEmissionsPerToken(address token, uint256 value) external onlyUpdater {
        emit EmissionsValueUpdated(token, _emissionsPerToken[token], value);
        _emissionsPerToken[token] = value;
    }

    /// @notice Batch update multiple tokens in one transaction
    function batchSetEmissionsPerToken(address[] calldata tokens, uint256[] calldata values) external onlyUpdater {
        require(tokens.length == values.length, "Length mismatch");
        for (uint256 i = 0; i < tokens.length; i++) {
            emit EmissionsValueUpdated(tokens[i], _emissionsPerToken[tokens[i]], values[i]);
            _emissionsPerToken[tokens[i]] = values[i];
        }
    }

    // ─── View ────────────────────────────────────────────────────────────────

    /// @notice USD emissions value per single token (18 decimals)
    function getEmissionsPerToken(address token) external view returns (uint256) {
        return _emissionsPerToken[token];
    }

    /**
     * @notice Total USD emissions value for a given token amount.
     * @param token  RWA LST address
     * @param amount Token amount (18 decimals)
     * @return USD value (18 decimals)
     */
    function getEmissionsValue(address token, uint256 amount) external view returns (uint256) {
        return (_emissionsPerToken[token] * amount) / 1e18;
    }
}
