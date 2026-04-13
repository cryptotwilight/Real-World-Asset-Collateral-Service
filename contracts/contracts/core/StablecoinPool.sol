// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title StablecoinPool
 * @notice Liquidity pool that allows investors to deposit stablecoins and earn fees from
 *         collateral positions opened and closed against this pool.
 *
 *         Shares model (ERC-4626-inspired but simplified):
 *         - On first deposit: shares = amount
 *         - Subsequent deposits: shares = amount * totalShares / totalAssets
 *         - On withdraw: stablecoins = shares * totalAssets / totalShares
 *
 *         Fees accrue into the pool automatically: totalAssets grows while totalShares stays
 *         the same, increasing the redemption price of each share.
 *
 *         Only the authorised CollateralVault may borrow from / repay to the pool.
 */
contract StablecoinPool is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ─── State ───────────────────────────────────────────────────────────────

    IERC20 public immutable stablecoin;

    /// @notice Total stablecoin assets held + outstanding loans
    uint256 public totalAssets;

    /// @notice Total LP shares outstanding
    uint256 public totalShares;

    /// @notice LP shares per investor
    mapping(address => uint256) public shares;

    /// @notice Currently borrowed amount (owed by CollateralVault)
    uint256 public totalBorrowed;

    /// @notice Total fees collected all-time (informational)
    uint256 public totalFeesCollected;

    /// @notice The CollateralVault contract authorised to borrow/repay
    address public collateralVault;

    // ─── Events ──────────────────────────────────────────────────────────────

    event Deposited(address indexed investor, uint256 amount, uint256 sharesIssued);
    event Withdrawn(address indexed investor, uint256 sharesRedeemed, uint256 amountReturned);
    event Borrowed(address indexed vault, uint256 amount);
    event Repaid(address indexed vault, uint256 principal, uint256 fee);
    event CollateralVaultSet(address vault);

    // ─── Modifiers ───────────────────────────────────────────────────────────

    modifier onlyVault() {
        require(msg.sender == collateralVault, "StablecoinPool: caller not vault");
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(address _stablecoin) Ownable(msg.sender) {
        require(_stablecoin != address(0), "Zero stablecoin");
        stablecoin = IERC20(_stablecoin);
    }

    // ─── Admin ───────────────────────────────────────────────────────────────

    function setCollateralVault(address _vault) external onlyOwner {
        require(_vault != address(0), "Zero vault");
        collateralVault = _vault;
        emit CollateralVaultSet(_vault);
    }

    // ─── Investor Functions ──────────────────────────────────────────────────

    /**
     * @notice Deposit stablecoins and receive pool shares.
     * @param amount Amount of stablecoins to deposit (stablecoin decimals)
     */
    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "Zero amount");

        uint256 sharesIssued;
        if (totalShares == 0 || totalAssets == 0) {
            sharesIssued = amount;
        } else {
            sharesIssued = (amount * totalShares) / totalAssets;
        }
        require(sharesIssued > 0, "Zero shares");

        shares[msg.sender] += sharesIssued;
        totalShares += sharesIssued;
        totalAssets += amount;

        stablecoin.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount, sharesIssued);
    }

    /**
     * @notice Redeem pool shares for stablecoins (pro-rata including accrued fees).
     * @param sharesToRedeem Number of shares to burn
     */
    function withdraw(uint256 sharesToRedeem) external nonReentrant {
        require(sharesToRedeem > 0, "Zero shares");
        require(shares[msg.sender] >= sharesToRedeem, "Insufficient shares");

        uint256 amountOut = (sharesToRedeem * totalAssets) / totalShares;
        require(amountOut > 0, "Zero out");

        // Ensure enough liquid stablecoin (not lent out)
        uint256 liquid = totalAssets - totalBorrowed;
        require(amountOut <= liquid, "Insufficient liquidity");

        shares[msg.sender] -= sharesToRedeem;
        totalShares -= sharesToRedeem;
        totalAssets -= amountOut;

        stablecoin.safeTransfer(msg.sender, amountOut);
        emit Withdrawn(msg.sender, sharesToRedeem, amountOut);
    }

    // ─── Vault-Only Functions ────────────────────────────────────────────────

    /**
     * @notice Lend stablecoins to a borrower via the CollateralVault.
     * @param to     Recipient (the borrower)
     * @param amount Amount to transfer
     */
    function borrow(address to, uint256 amount) external onlyVault nonReentrant {
        require(amount > 0, "Zero amount");
        uint256 liquid = totalAssets - totalBorrowed;
        require(amount <= liquid, "Insufficient liquidity");

        totalBorrowed += amount;
        stablecoin.safeTransfer(to, amount);
        emit Borrowed(collateralVault, amount);
    }

    /**
     * @notice Receive repayment from a closed/liquidated position.
     * @param principal  Original loan principal
     * @param fee        Protocol fee collected on this repayment
     */
    function repay(uint256 principal, uint256 fee) external onlyVault nonReentrant {
        require(principal <= totalBorrowed, "Repay exceeds outstanding");

        uint256 total = principal + fee;
        stablecoin.safeTransferFrom(collateralVault, address(this), total);

        totalBorrowed -= principal;
        totalAssets += fee; // Fee grows the pool, benefiting all LPs
        totalFeesCollected += fee;

        emit Repaid(collateralVault, principal, fee);
    }

    // ─── View ────────────────────────────────────────────────────────────────

    /// @notice Current stablecoin value of `investor`'s position
    function investorBalance(address investor) external view returns (uint256) {
        if (totalShares == 0) return 0;
        return (shares[investor] * totalAssets) / totalShares;
    }

    /// @notice Pool utilisation: borrowed / totalAssets (basis points)
    function utilisation() external view returns (uint256) {
        if (totalAssets == 0) return 0;
        return (totalBorrowed * 10000) / totalAssets;
    }

    /// @notice Available liquidity for borrowing
    function availableLiquidity() external view returns (uint256) {
        return totalAssets - totalBorrowed;
    }

    /// @notice Share price in stablecoin terms (18 decimals)
    function sharePrice() external view returns (uint256) {
        if (totalShares == 0) return 1e18;
        return (totalAssets * 1e18) / totalShares;
    }
}
