// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AdminController
 * @notice Manages protocol-wide configuration: fees, collateral thresholds, and auction settings.
 * @dev All percentages are in basis points (1 bp = 0.01%). 10000 bp = 100%.
 */
contract AdminController is Ownable {
    // ─── Fee Configuration ───────────────────────────────────────────────────

    /// @notice Fee charged on the borrow amount when a position is opened (basis points)
    uint256 public openFeePercent;

    /// @notice Fee charged on the repayment amount when a position is closed (basis points)
    uint256 public closeFeePercent;

    // ─── Collateral Configuration ────────────────────────────────────────────

    /// @notice Minimum collateral ratio required to open a position (basis points, e.g. 15000 = 150%)
    uint256 public collateralThreshold;

    /// @notice Collateral ratio below which a position can be liquidated (basis points, e.g. 11000 = 110%)
    uint256 public liquidationThreshold;

    // ─── Auction Configuration ───────────────────────────────────────────────

    /// @notice Duration of disposal auctions in seconds
    uint256 public auctionDuration;

    // ─── Events ──────────────────────────────────────────────────────────────

    event OpenFeeUpdated(uint256 oldFee, uint256 newFee);
    event CloseFeeUpdated(uint256 oldFee, uint256 newFee);
    event CollateralThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
    event LiquidationThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
    event AuctionDurationUpdated(uint256 oldDuration, uint256 newDuration);

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(
        uint256 _openFeePercent,
        uint256 _closeFeePercent,
        uint256 _collateralThreshold,
        uint256 _liquidationThreshold,
        uint256 _auctionDuration
    ) Ownable(msg.sender) {
        require(_openFeePercent <= 1000, "Open fee exceeds 10%");
        require(_closeFeePercent <= 1000, "Close fee exceeds 10%");
        require(_liquidationThreshold >= 10000, "Liquidation threshold below 100%");
        require(_collateralThreshold > _liquidationThreshold, "Collateral threshold must exceed liquidation");
        require(_auctionDuration >= 1 hours, "Auction duration too short");

        openFeePercent = _openFeePercent;
        closeFeePercent = _closeFeePercent;
        collateralThreshold = _collateralThreshold;
        liquidationThreshold = _liquidationThreshold;
        auctionDuration = _auctionDuration;
    }

    // ─── Admin Functions ─────────────────────────────────────────────────────

    function setOpenFeePercent(uint256 _fee) external onlyOwner {
        require(_fee <= 1000, "Fee cannot exceed 10%");
        emit OpenFeeUpdated(openFeePercent, _fee);
        openFeePercent = _fee;
    }

    function setCloseFeePercent(uint256 _fee) external onlyOwner {
        require(_fee <= 1000, "Fee cannot exceed 10%");
        emit CloseFeeUpdated(closeFeePercent, _fee);
        closeFeePercent = _fee;
    }

    function setCollateralThreshold(uint256 _threshold) external onlyOwner {
        require(_threshold > liquidationThreshold, "Must exceed liquidation threshold");
        emit CollateralThresholdUpdated(collateralThreshold, _threshold);
        collateralThreshold = _threshold;
    }

    function setLiquidationThreshold(uint256 _threshold) external onlyOwner {
        require(_threshold >= 10000, "Must be at least 100%");
        require(collateralThreshold > _threshold, "Must be below collateral threshold");
        emit LiquidationThresholdUpdated(liquidationThreshold, _threshold);
        liquidationThreshold = _threshold;
    }

    function setAuctionDuration(uint256 _duration) external onlyOwner {
        require(_duration >= 1 hours, "Duration must be at least 1 hour");
        emit AuctionDurationUpdated(auctionDuration, _duration);
        auctionDuration = _duration;
    }

    // ─── View Helpers ────────────────────────────────────────────────────────

    /// @notice Returns all configuration in a single call
    function getConfig()
        external
        view
        returns (
            uint256 _openFeePercent,
            uint256 _closeFeePercent,
            uint256 _collateralThreshold,
            uint256 _liquidationThreshold,
            uint256 _auctionDuration
        )
    {
        return (openFeePercent, closeFeePercent, collateralThreshold, liquidationThreshold, auctionDuration);
    }

    /// @notice Calculate the open fee for a given borrow amount
    function calcOpenFee(uint256 borrowAmount) external view returns (uint256) {
        return (borrowAmount * openFeePercent) / 10000;
    }

    /// @notice Calculate the close fee for a given repay amount
    function calcCloseFee(uint256 repayAmount) external view returns (uint256) {
        return (repayAmount * closeFeePercent) / 10000;
    }
}
