// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./EmissionsOracle.sol";
import "./NPVOracle.sol";

/**
 * @title RWAValuationOracle
 * @notice Aggregates the EmissionsOracle and NPVOracle to produce a single USD valuation
 *         for any amount of RWA LSTs.
 *
 *         Total value = Emissions Value + Net Present Value
 *
 *         Both components are independently sourced so that changes in either the income
 *         stream or the underlying asset value are reflected in the collateral price.
 */
contract RWAValuationOracle is Ownable {
    EmissionsOracle public emissionsOracle;
    NPVOracle public npvOracle;

    // Optional per-token weight overrides (basis points, 10000 = use full oracle value)
    // Allows governance to apply a haircut on either component for risk management
    mapping(address => uint256) public emissionsWeight; // default 10000
    mapping(address => uint256) public npvWeight;       // default 10000

    event EmissionsOracleUpdated(address oldOracle, address newOracle);
    event NPVOracleUpdated(address oldOracle, address newOracle);
    event WeightsUpdated(address indexed token, uint256 emissionsWeight, uint256 npvWeight);

    constructor(address _emissionsOracle, address _npvOracle) Ownable(msg.sender) {
        require(_emissionsOracle != address(0), "Zero emissions oracle");
        require(_npvOracle != address(0), "Zero NPV oracle");
        emissionsOracle = EmissionsOracle(_emissionsOracle);
        npvOracle = NPVOracle(_npvOracle);
    }

    // ─── Admin ───────────────────────────────────────────────────────────────

    function setEmissionsOracle(address _oracle) external onlyOwner {
        require(_oracle != address(0), "Zero address");
        emit EmissionsOracleUpdated(address(emissionsOracle), _oracle);
        emissionsOracle = EmissionsOracle(_oracle);
    }

    function setNPVOracle(address _oracle) external onlyOwner {
        require(_oracle != address(0), "Zero address");
        emit NPVOracleUpdated(address(npvOracle), _oracle);
        npvOracle = NPVOracle(_oracle);
    }

    /**
     * @notice Apply risk haircuts to oracle components for a specific token.
     * @param token          RWA LST address
     * @param _emissionsWeight  Basis points of emissions value to include (0–10000)
     * @param _npvWeight     Basis points of NPV to include (0–10000)
     */
    function setWeights(address token, uint256 _emissionsWeight, uint256 _npvWeight) external onlyOwner {
        require(_emissionsWeight <= 10000, "Emissions weight > 100%");
        require(_npvWeight <= 10000, "NPV weight > 100%");
        emissionsWeight[token] = _emissionsWeight;
        npvWeight[token] = _npvWeight;
        emit WeightsUpdated(token, _emissionsWeight, _npvWeight);
    }

    // ─── View ────────────────────────────────────────────────────────────────

    /**
     * @notice Returns the combined USD valuation for `amount` of `token`.
     * @param token  RWA LST address
     * @param amount Token amount (18 decimals)
     * @return total  Total USD value (18 decimals)
     * @return emissionsComponent  Emissions share (18 decimals)
     * @return npvComponent        NPV share (18 decimals)
     */
    function getTokenValue(address token, uint256 amount)
        public
        view
        returns (uint256 total, uint256 emissionsComponent, uint256 npvComponent)
    {
        uint256 eWeight = emissionsWeight[token] == 0 ? 10000 : emissionsWeight[token];
        uint256 nWeight = npvWeight[token] == 0 ? 10000 : npvWeight[token];

        emissionsComponent = (emissionsOracle.getEmissionsValue(token, amount) * eWeight) / 10000;
        npvComponent = (npvOracle.getNPVValue(token, amount) * nWeight) / 10000;
        total = emissionsComponent + npvComponent;
    }

    /// @notice Convenience: total USD value only
    function getTotalValue(address token, uint256 amount) external view returns (uint256) {
        (uint256 total,,) = getTokenValue(token, amount);
        return total;
    }

    /// @notice USD value per single token (18 decimals)
    function getPricePerToken(address token) external view returns (uint256) {
        (uint256 total,,) = getTokenValue(token, 1e18);
        return total;
    }
}
