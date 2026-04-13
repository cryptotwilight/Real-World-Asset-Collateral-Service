// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DisposalContract
 * @notice Manages the auctioning of RWA LSTs from liquidated collateral positions.
 *
 *         Flow:
 *         1. Investors pre-credit stablecoins into this contract.
 *         2. When a collateral position is liquidated, the CollateralVault transfers LSTs
 *            here and calls `createAuction()`.
 *         3. Investors place ascending bids using their credited balances.
 *         4. After the auction duration expires, anyone may call `finalizeAuction()`.
 *         5. The winning bid is sent to the StablecoinPool as debt repayment;
 *            any surplus over the outstanding debt is returned to the original borrower.
 *         6. The winning investor receives the LSTs.
 *
 *         Credit withdrawal rules:
 *         - An investor may only withdraw un-locked credited funds when they have no
 *           active bid OR no auctions are currently running.
 *         - A winning investor receives LSTs in lieu of their stablecoins (purchase).
 */
contract DisposalContract is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ─── Types ───────────────────────────────────────────────────────────────

    struct Auction {
        address lstToken;        // RWA LST being auctioned
        uint256 lstAmount;       // Quantity of LST tokens
        uint256 minBid;          // Minimum bid (= outstanding debt)
        uint256 debtToRepay;     // Debt amount owed to StablecoinPool
        address debtor;          // Original borrower (receives surplus)
        address stablecoinPool;  // Address to send debt repayment
        uint256 endTime;         // Auction end timestamp
        address highestBidder;   // Current highest bidder
        uint256 highestBid;      // Current highest bid
        bool finalized;          // Whether the auction has been settled
    }

    // ─── State ───────────────────────────────────────────────────────────────

    IERC20 public immutable stablecoin;

    /// @notice Authorised vault that can create auctions
    address public collateralVault;

    /// @notice Auction duration set by AdminController (passed at creation time)
    uint256 public defaultAuctionDuration;

    /// @notice Total credited stablecoins per investor
    mapping(address => uint256) public creditedBalance;

    /// @notice Stablecoins locked in active bids per investor
    mapping(address => uint256) public lockedBid;

    /// @notice All auctions by ID
    mapping(uint256 => Auction) public auctions;
    uint256 public auctionCount;

    /// @notice Number of currently active (non-finalized) auctions
    uint256 public activeAuctionCount;

    // ─── Events ──────────────────────────────────────────────────────────────

    event FundsCredited(address indexed investor, uint256 amount);
    event FundsWithdrawn(address indexed investor, uint256 amount);
    event AuctionCreated(uint256 indexed auctionId, address lstToken, uint256 lstAmount, uint256 minBid, uint256 endTime);
    event BidPlaced(uint256 indexed auctionId, address indexed bidder, uint256 amount);
    event AuctionFinalized(uint256 indexed auctionId, address winner, uint256 winningBid);
    event AuctionExpiredNoBids(uint256 indexed auctionId);
    event CollateralVaultSet(address vault);

    // ─── Modifiers ───────────────────────────────────────────────────────────

    modifier onlyVault() {
        require(msg.sender == collateralVault, "DisposalContract: caller not vault");
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(address _stablecoin, uint256 _defaultAuctionDuration) Ownable(msg.sender) {
        require(_stablecoin != address(0), "Zero stablecoin");
        require(_defaultAuctionDuration >= 1 hours, "Duration too short");
        stablecoin = IERC20(_stablecoin);
        defaultAuctionDuration = _defaultAuctionDuration;
    }

    // ─── Admin ───────────────────────────────────────────────────────────────

    function setCollateralVault(address _vault) external onlyOwner {
        require(_vault != address(0), "Zero vault");
        collateralVault = _vault;
        emit CollateralVaultSet(_vault);
    }

    function setDefaultAuctionDuration(uint256 _duration) external onlyOwner {
        require(_duration >= 1 hours, "Too short");
        defaultAuctionDuration = _duration;
    }

    // ─── Investor: Credit / Withdraw ─────────────────────────────────────────

    /**
     * @notice Pre-credit stablecoins into this contract to enable bidding.
     *         Funds can only be retrieved when no LSTs remain to bid on, or via winning an auction.
     */
    function creditFunds(uint256 amount) external nonReentrant {
        require(amount > 0, "Zero amount");
        creditedBalance[msg.sender] += amount;
        stablecoin.safeTransferFrom(msg.sender, address(this), amount);
        emit FundsCredited(msg.sender, amount);
    }

    /**
     * @notice Withdraw un-locked credited stablecoins.
     *         Only permitted when there are no active auctions OR when the investor
     *         has no active bids.
     */
    function withdrawFunds(uint256 amount) external nonReentrant {
        require(amount > 0, "Zero amount");

        uint256 available = creditedBalance[msg.sender] - lockedBid[msg.sender];
        require(available >= amount, "Insufficient free balance");

        // Enforce withdrawal restriction: if there are active auctions, investor
        // cannot withdraw ANY free balance (not just bid-locked amounts).
        require(
            activeAuctionCount == 0 || lockedBid[msg.sender] == 0,
            "Cannot withdraw while auctions active and you have a bid"
        );
        // If no active auctions, full withdrawal is permitted.
        if (activeAuctionCount > 0) {
            // Must have no bids at all to withdraw
            require(lockedBid[msg.sender] == 0, "Unlock bids first");
        }

        creditedBalance[msg.sender] -= amount;
        stablecoin.safeTransfer(msg.sender, amount);
        emit FundsWithdrawn(msg.sender, amount);
    }

    // ─── Vault-Only: Auction Management ─────────────────────────────────────

    /**
     * @notice Create a new disposal auction for liquidated LSTs.
     * @param lstToken        The RWA LST contract
     * @param lstAmount       Quantity of LST tokens transferred to this contract
     * @param debtToRepay     Outstanding loan principal that must be covered by winning bid
     * @param debtor          Original borrower – receives any surplus over debt
     * @param _stablecoinPool Pool to receive the debt repayment
     * @param duration        Auction duration in seconds (pass 0 to use default)
     */
    function createAuction(
        address lstToken,
        uint256 lstAmount,
        uint256 debtToRepay,
        address debtor,
        address _stablecoinPool,
        uint256 duration
    ) external onlyVault returns (uint256 auctionId) {
        require(lstToken != address(0), "Zero LST");
        require(lstAmount > 0, "Zero LST amount");
        require(debtToRepay > 0, "Zero debt");

        uint256 auctionDuration = duration > 0 ? duration : defaultAuctionDuration;
        auctionId = auctionCount++;

        auctions[auctionId] = Auction({
            lstToken: lstToken,
            lstAmount: lstAmount,
            minBid: debtToRepay,
            debtToRepay: debtToRepay,
            debtor: debtor,
            stablecoinPool: _stablecoinPool,
            endTime: block.timestamp + auctionDuration,
            highestBidder: address(0),
            highestBid: 0,
            finalized: false
        });

        activeAuctionCount++;
        emit AuctionCreated(auctionId, lstToken, lstAmount, debtToRepay, block.timestamp + auctionDuration);
    }

    // ─── Investor: Bidding ───────────────────────────────────────────────────

    /**
     * @notice Place or raise a bid on an active auction using credited balance.
     * @param auctionId  The target auction
     * @param bidAmount  Total bid amount (must exceed current highest bid and minBid)
     */
    function placeBid(uint256 auctionId, uint256 bidAmount) external nonReentrant {
        Auction storage auction = auctions[auctionId];
        require(!auction.finalized, "Auction finalized");
        require(block.timestamp < auction.endTime, "Auction ended");
        require(bidAmount >= auction.minBid, "Below minimum bid");
        require(bidAmount > auction.highestBid, "Bid not high enough");

        uint256 available = creditedBalance[msg.sender] - lockedBid[msg.sender];

        // If already the highest bidder, only need to top up the difference
        uint256 extra;
        if (auction.highestBidder == msg.sender) {
            extra = bidAmount - auction.highestBid;
        } else {
            extra = bidAmount;
        }
        require(available >= extra, "Insufficient credited balance");

        // Unlock previous highest bidder's funds
        if (auction.highestBidder != address(0) && auction.highestBidder != msg.sender) {
            lockedBid[auction.highestBidder] -= auction.highestBid;
        }

        lockedBid[msg.sender] += extra;
        auction.highestBidder = msg.sender;
        auction.highestBid = bidAmount;

        emit BidPlaced(auctionId, msg.sender, bidAmount);
    }

    /**
     * @notice Settle an auction after its end time.
     *         Anyone may call this once the auction has expired.
     */
    function finalizeAuction(uint256 auctionId) external nonReentrant {
        Auction storage auction = auctions[auctionId];
        require(!auction.finalized, "Already finalized");
        require(block.timestamp >= auction.endTime, "Auction still active");

        auction.finalized = true;
        activeAuctionCount--;

        if (auction.highestBidder == address(0)) {
            // No bids – LSTs stay in contract, auction expires
            emit AuctionExpiredNoBids(auctionId);
            return;
        }

        address winner = auction.highestBidder;
        uint256 winBid = auction.highestBid;

        // Unlock winner's bid
        lockedBid[winner] -= winBid;
        creditedBalance[winner] -= winBid;

        // Send debt repayment to StablecoinPool
        uint256 debt = auction.debtToRepay;
        stablecoin.safeTransfer(auction.stablecoinPool, debt);

        // Return any surplus to original borrower
        if (winBid > debt) {
            stablecoin.safeTransfer(auction.debtor, winBid - debt);
        }

        // Transfer LSTs to winner
        IERC20(auction.lstToken).safeTransfer(winner, auction.lstAmount);

        emit AuctionFinalized(auctionId, winner, winBid);
    }

    // ─── View ────────────────────────────────────────────────────────────────

    function getAuction(uint256 auctionId) external view returns (Auction memory) {
        return auctions[auctionId];
    }

    /// @notice Free (unlocked) credited balance for an investor
    function freeBalance(address investor) external view returns (uint256) {
        return creditedBalance[investor] - lockedBid[investor];
    }

    /// @notice All auction IDs where `investor` is the current highest bidder
    function getActiveBidAuctions(address investor) external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < auctionCount; i++) {
            if (!auctions[i].finalized && auctions[i].highestBidder == investor) count++;
        }
        uint256[] memory result = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < auctionCount; i++) {
            if (!auctions[i].finalized && auctions[i].highestBidder == investor) {
                result[idx++] = i;
            }
        }
        return result;
    }

    /// @notice Returns all active (non-finalized) auction IDs
    function getActiveAuctions() external view returns (uint256[] memory) {
        uint256[] memory result = new uint256[](activeAuctionCount);
        uint256 idx = 0;
        for (uint256 i = 0; i < auctionCount; i++) {
            if (!auctions[i].finalized) result[idx++] = i;
        }
        return result;
    }
}
