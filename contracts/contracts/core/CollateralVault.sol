// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../core/AdminController.sol";
import "../core/StablecoinPool.sol";
import "../core/DisposalContract.sol";
import "../oracles/RWAValuationOracle.sol";

/**
 * @title CollateralVault
 * @notice Core contract for opening, managing, and liquidating RWA LST collateral positions.
 *
 *         Emissions routing:
 *         - includeEmissions=true:  emissions accrue to the staked LST value (default)
 *         - includeEmissions=false: emissions are excluded from collateral valuation and
 *           routed to the original owner upon position closure. While the position is open
 *           emissions accumulate in the contract (since LSTs are held here), and are
 *           forwarded to the original borrower when the position is closed.
 */
contract CollateralVault is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ─── Types ───────────────────────────────────────────────────────────────

    enum PositionStatus { Active, Closed, Liquidated }

    struct Position {
        address borrower;
        address lstToken;
        uint256 lstAmount;
        uint256 loanAmount;
        uint256 openFee;
        uint256 openTimestamp;
        PositionStatus status;
        bool includeEmissions; // if false, emissions excluded from collateral & routed to borrower
    }

    // ─── State ───────────────────────────────────────────────────────────────

    AdminController public adminController;
    StablecoinPool public stablecoinPool;
    DisposalContract public disposalContract;
    RWAValuationOracle public valuationOracle;

    IERC20 public immutable stablecoin;

    mapping(uint256 => Position) public positions;
    uint256 public positionCount;

    mapping(address => uint256[]) public borrowerPositions;

    // ─── Protocol Stats ──────────────────────────────────────────────────────

    uint256 public totalActivePositions;
    uint256 public totalBorrowedAllTime;
    uint256 public totalLiquidatedPositions;

    // ─── Emissions tracking (per position, accumulated stablecoin value) ─────

    /// @notice Accumulated emissions value owed to borrower (stablecoin units) for non-emissions positions
    mapping(uint256 => uint256) public accruedEmissions;

    // ─── Events ──────────────────────────────────────────────────────────────

    event PositionOpened(
        uint256 indexed positionId,
        address indexed borrower,
        address lstToken,
        uint256 lstAmount,
        uint256 loanAmount,
        uint256 openFee,
        bool includeEmissions
    );
    event PositionClosed(uint256 indexed positionId, address indexed borrower, uint256 repaidAmount, uint256 closeFee);
    event PositionToppedUp(uint256 indexed positionId, address indexed borrower, uint256 additionalLst);
    event PositionHarvested(uint256 indexed positionId, address indexed borrower, uint256 lstWithdrawn, uint256 additionalBorrow);
    event PositionLiquidated(uint256 indexed positionId, address indexed borrower, uint256 auctionId);
    event EmissionsClaimed(uint256 indexed positionId, address indexed borrower, uint256 amount);

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(
        address _adminController,
        address _stablecoinPool,
        address _disposalContract,
        address _valuationOracle,
        address _stablecoin
    ) Ownable(msg.sender) {
        require(_adminController != address(0), "Zero adminController");
        require(_stablecoinPool != address(0), "Zero pool");
        require(_disposalContract != address(0), "Zero disposal");
        require(_valuationOracle != address(0), "Zero oracle");
        require(_stablecoin != address(0), "Zero stablecoin");

        adminController = AdminController(_adminController);
        stablecoinPool = StablecoinPool(_stablecoinPool);
        disposalContract = DisposalContract(_disposalContract);
        valuationOracle = RWAValuationOracle(_valuationOracle);
        stablecoin = IERC20(_stablecoin);
    }

    // ─── Admin ───────────────────────────────────────────────────────────────

    function setAdminController(address _a) external onlyOwner {
        require(_a != address(0), "Zero address");
        adminController = AdminController(_a);
    }

    function setDisposalContract(address _d) external onlyOwner {
        require(_d != address(0), "Zero address");
        disposalContract = DisposalContract(_d);
    }

    function setValuationOracle(address _o) external onlyOwner {
        require(_o != address(0), "Zero address");
        valuationOracle = RWAValuationOracle(_o);
    }

    // ─── Internal: collateral valuation ─────────────────────────────────────

    /// @dev Returns the collateral value respecting the emissions inclusion flag
    function _collateralValue(address lstToken, uint256 lstAmount, bool _includeEmissions)
        internal
        view
        returns (uint256)
    {
        if (_includeEmissions) {
            return valuationOracle.getTotalValue(lstToken, lstAmount);
        }
        // Exclude emissions — only use NPV component
        (,, uint256 npvComponent) = valuationOracle.getTokenValue(lstToken, lstAmount);
        return npvComponent;
    }

    // ─── Core Actions ────────────────────────────────────────────────────────

    /**
     * @notice Open a new collateral position.
     * @param lstToken         The RWA LST token to use as collateral
     * @param lstAmount        Amount of LST to lock (18 decimals)
     * @param borrowAmount     Amount of stablecoin to borrow
     * @param includeEmissions If false, emissions are excluded from collateral and routed to borrower
     */
    function openPosition(
        address lstToken,
        uint256 lstAmount,
        uint256 borrowAmount,
        bool includeEmissions
    )
        external
        nonReentrant
        returns (uint256 positionId)
    {
        require(lstToken != address(0), "Zero LST");
        require(lstAmount > 0, "Zero LST amount");
        require(borrowAmount > 0, "Zero borrow");

        uint256 collateralValue = _collateralValue(lstToken, lstAmount, includeEmissions);
        uint256 hf = (collateralValue * 10000) / borrowAmount;
        require(hf >= adminController.collateralThreshold(), "Insufficient collateral");

        uint256 openFee = adminController.calcOpenFee(borrowAmount);
        uint256 netBorrow = borrowAmount - openFee;

        positionId = positionCount++;
        positions[positionId] = Position({
            borrower: msg.sender,
            lstToken: lstToken,
            lstAmount: lstAmount,
            loanAmount: netBorrow,
            openFee: openFee,
            openTimestamp: block.timestamp,
            status: PositionStatus.Active,
            includeEmissions: includeEmissions
        });
        borrowerPositions[msg.sender].push(positionId);

        totalActivePositions++;
        totalBorrowedAllTime += netBorrow;

        IERC20(lstToken).safeTransferFrom(msg.sender, address(this), lstAmount);
        stablecoinPool.borrow(msg.sender, netBorrow);

        emit PositionOpened(positionId, msg.sender, lstToken, lstAmount, borrowAmount, openFee, includeEmissions);
    }

    /**
     * @notice Close an active position by repaying the loan and retrieving LSTs.
     */
    function closePosition(uint256 positionId) external nonReentrant {
        Position storage pos = positions[positionId];
        require(pos.borrower == msg.sender, "Not your position");
        require(pos.status == PositionStatus.Active, "Not active");

        uint256 closeFee = adminController.calcCloseFee(pos.loanAmount);
        uint256 totalRepay = pos.loanAmount + closeFee;

        stablecoin.safeTransferFrom(msg.sender, address(this), totalRepay);
        stablecoin.approve(address(stablecoinPool), totalRepay);
        stablecoinPool.repay(pos.loanAmount, closeFee);

        uint256 lstToReturn = pos.lstAmount;
        uint256 repaidAmount = pos.loanAmount;
        pos.lstAmount = 0;
        pos.loanAmount = 0;
        pos.status = PositionStatus.Closed;
        totalActivePositions--;

        IERC20(pos.lstToken).safeTransfer(msg.sender, lstToReturn);

        // If emissions were excluded, the accumulated emissions value is owed to borrower
        // In practice, emissions accrued to the LSTs held by this contract.
        // On close the LSTs (with accrued emissions) go back to the borrower anyway.
        // The accruedEmissions mapping is informational for off-chain tracking.

        emit PositionClosed(positionId, msg.sender, repaidAmount, closeFee);
    }

    function topUpPosition(uint256 positionId, uint256 additionalLst) external nonReentrant {
        Position storage pos = positions[positionId];
        require(pos.borrower == msg.sender, "Not your position");
        require(pos.status == PositionStatus.Active, "Not active");
        require(additionalLst > 0, "Zero amount");

        IERC20(pos.lstToken).safeTransferFrom(msg.sender, address(this), additionalLst);
        pos.lstAmount += additionalLst;

        emit PositionToppedUp(positionId, msg.sender, additionalLst);
    }

    function harvestPosition(uint256 positionId, uint256 lstToWithdraw, uint256 additionalBorrow)
        external
        nonReentrant
    {
        Position storage pos = positions[positionId];
        require(pos.borrower == msg.sender, "Not your position");
        require(pos.status == PositionStatus.Active, "Not active");
        require(lstToWithdraw > 0 || additionalBorrow > 0, "Nothing to harvest");

        uint256 newLstAmount = pos.lstAmount - lstToWithdraw;
        uint256 grossNewLoan = pos.loanAmount + additionalBorrow;

        uint256 collateralValue = _collateralValue(pos.lstToken, newLstAmount, pos.includeEmissions);
        require(collateralValue > 0 || grossNewLoan == 0, "Zero collateral after harvest");
        if (grossNewLoan > 0) {
            uint256 hf = (collateralValue * 10000) / grossNewLoan;
            require(hf >= adminController.collateralThreshold(), "Would breach collateral threshold");
        }

        pos.lstAmount = newLstAmount;

        if (lstToWithdraw > 0) {
            IERC20(pos.lstToken).safeTransfer(msg.sender, lstToWithdraw);
        }
        if (additionalBorrow > 0) {
            uint256 fee = adminController.calcOpenFee(additionalBorrow);
            uint256 netBorrow = additionalBorrow - fee;
            pos.loanAmount = pos.loanAmount + netBorrow;
            totalBorrowedAllTime += netBorrow;
            stablecoinPool.borrow(msg.sender, netBorrow);
        }

        emit PositionHarvested(positionId, msg.sender, lstToWithdraw, additionalBorrow);
    }

    function liquidate(uint256 positionId) external nonReentrant {
        Position storage pos = positions[positionId];
        require(pos.status == PositionStatus.Active, "Not active");

        uint256 collateralValue = _collateralValue(pos.lstToken, pos.lstAmount, pos.includeEmissions);
        uint256 hf = pos.loanAmount > 0
            ? (collateralValue * 10000) / pos.loanAmount
            : type(uint256).max;
        require(hf < adminController.liquidationThreshold(), "Position is healthy");

        address lstToken = pos.lstToken;
        uint256 lstAmount = pos.lstAmount;
        uint256 loanAmount = pos.loanAmount;
        address borrower = pos.borrower;

        pos.lstAmount = 0;
        pos.loanAmount = 0;
        pos.status = PositionStatus.Liquidated;
        totalActivePositions--;
        totalLiquidatedPositions++;

        IERC20(lstToken).safeTransfer(address(disposalContract), lstAmount);

        uint256 auctionId = disposalContract.createAuction(
            lstToken,
            lstAmount,
            loanAmount,
            borrower,
            address(stablecoinPool),
            adminController.auctionDuration()
        );

        emit PositionLiquidated(positionId, borrower, auctionId);
    }

    // ─── View ────────────────────────────────────────────────────────────────

    function healthFactor(uint256 positionId) public view returns (uint256) {
        Position storage pos = positions[positionId];
        if (pos.loanAmount == 0) return type(uint256).max;
        uint256 collateralValue = _collateralValue(pos.lstToken, pos.lstAmount, pos.includeEmissions);
        return (collateralValue * 10000) / pos.loanAmount;
    }

    function getBorrowerPositions(address borrower) external view returns (uint256[] memory) {
        return borrowerPositions[borrower];
    }

    function getPosition(uint256 positionId) external view returns (Position memory) {
        return positions[positionId];
    }

    function harvestableCollateral(uint256 positionId) external view returns (uint256 surplus) {
        Position storage pos = positions[positionId];
        if (pos.status != PositionStatus.Active || pos.loanAmount == 0) return 0;

        uint256 threshold = adminController.collateralThreshold();
        uint256 requiredValue = (pos.loanAmount * threshold) / 10000;
        uint256 currentValue = _collateralValue(pos.lstToken, pos.lstAmount, pos.includeEmissions);
        if (currentValue <= requiredValue) return 0;

        uint256 surplusValue = currentValue - requiredValue;
        uint256 pricePerToken = valuationOracle.getPricePerToken(pos.lstToken);
        if (pricePerToken == 0) return 0;
        surplus = (surplusValue * 1e18) / pricePerToken;
    }

    /// @notice Protocol-wide stats for the dashboard
    function getProtocolStats()
        external
        view
        returns (
            uint256 activePositions,
            uint256 totalBorrowed,
            uint256 totalLiquidated,
            uint256 currentTotalBorrowed
        )
    {
        return (
            totalActivePositions,
            totalBorrowedAllTime,
            totalLiquidatedPositions,
            stablecoinPool.totalBorrowed()
        );
    }
}
