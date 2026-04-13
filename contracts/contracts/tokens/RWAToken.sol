// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title RWAToken
 * @notice Controlled ERC20 representing a Real-World Asset Liquid Staked Token (LST).
 *
 *         Each token represents a proportional stake in an underlying real-world asset
 *         (e.g. real estate, trade receivable, infrastructure project). Holding the
 *         token entitles the owner to a share of the asset's income stream (emissions)
 *         and its net present value (NPV), both reported through the oracle layer.
 *
 *         Minting and burning are restricted to MINTER_ROLE to ensure controlled supply.
 */
contract RWAToken is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /// @notice Human-readable description of the underlying RWA
    string public assetDescription;

    /// @notice IPFS CID or URL pointing to the legal/compliance documentation
    string public documentationURI;

    event AssetDescriptionUpdated(string newDescription);
    event DocumentationURIUpdated(string newURI);

    constructor(
        string memory name_,
        string memory symbol_,
        string memory _assetDescription,
        string memory _documentationURI,
        address admin
    ) ERC20(name_, symbol_) {
        require(admin != address(0), "Zero admin");
        assetDescription = _assetDescription;
        documentationURI = _documentationURI;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
    }

    // ─── Minting / Burning ───────────────────────────────────────────────────

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyRole(MINTER_ROLE) {
        _burn(from, amount);
    }

    // ─── Metadata ────────────────────────────────────────────────────────────

    function setAssetDescription(string calldata _description) external onlyRole(DEFAULT_ADMIN_ROLE) {
        assetDescription = _description;
        emit AssetDescriptionUpdated(_description);
    }

    function setDocumentationURI(string calldata _uri) external onlyRole(DEFAULT_ADMIN_ROLE) {
        documentationURI = _uri;
        emit DocumentationURIUpdated(_uri);
    }
}
