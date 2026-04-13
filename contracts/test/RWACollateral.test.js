const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

/**
 * RWA Collateral Service – integration test suite
 *
 * Tests cover the full lifecycle:
 *  - Position open / close
 *  - Top-up and harvest
 *  - Liquidation + disposal auction
 *  - Stablecoin pool deposits / withdrawals / fee accrual
 *  - Admin fee configuration
 */
describe("RWA Collateral Service", function () {
  // ── Fixture ──────────────────────────────────────────────────────────────

  async function deployFixture() {
    const [owner, borrower, investor1, investor2, liquidator] = await ethers.getSigners();

    // Stablecoin (6 decimals like USDC)
    const MockStablecoin = await ethers.getContractFactory("MockStablecoin");
    const stablecoin = await MockStablecoin.deploy("Mock USDC", "mUSDC", 6);

    // Oracles
    const EmissionsOracle = await ethers.getContractFactory("EmissionsOracle");
    const emissionsOracle = await EmissionsOracle.deploy();

    const NPVOracle = await ethers.getContractFactory("NPVOracle");
    const npvOracle = await NPVOracle.deploy();

    const RWAValuationOracle = await ethers.getContractFactory("RWAValuationOracle");
    const valuationOracle = await RWAValuationOracle.deploy(
      await emissionsOracle.getAddress(),
      await npvOracle.getAddress()
    );

    // AdminController: 0.5% open fee, 0.5% close fee, 150% collateral, 110% liquidation, 24h auction
    const AdminController = await ethers.getContractFactory("AdminController");
    const adminController = await AdminController.deploy(50, 50, 15000, 11000, 24 * 3600);

    // Pool
    const StablecoinPool = await ethers.getContractFactory("StablecoinPool");
    const stablecoinPool = await StablecoinPool.deploy(await stablecoin.getAddress());

    // Disposal
    const DisposalContract = await ethers.getContractFactory("DisposalContract");
    const disposalContract = await DisposalContract.deploy(
      await stablecoin.getAddress(),
      24 * 3600
    );

    // Vault
    const CollateralVault = await ethers.getContractFactory("CollateralVault");
    const vault = await CollateralVault.deploy(
      await adminController.getAddress(),
      await stablecoinPool.getAddress(),
      await disposalContract.getAddress(),
      await valuationOracle.getAddress(),
      await stablecoin.getAddress()
    );

    // Wire contracts
    await stablecoinPool.setCollateralVault(await vault.getAddress());
    await disposalContract.setCollateralVault(await vault.getAddress());

    // RWA Token
    const RWAToken = await ethers.getContractFactory("RWAToken");
    const rwaToken = await RWAToken.deploy(
      "HashKey CRE LST", "hkCRE",
      "Commercial Real Estate", "ipfs://test",
      owner.address
    );

    // Oracle values: $0.10 emissions + $1.00 NPV = $1.10 per token
    const rwaAddress = await rwaToken.getAddress();
    await emissionsOracle.setEmissionsPerToken(rwaAddress, ethers.parseEther("0.10"));
    await npvOracle.setNPVPerToken(rwaAddress, ethers.parseEther("1.00"));

    // Mint stablecoins: seed pool with 1M; give borrower 10k; give investors 500k each
    const ONE_M = ethers.parseUnits("1000000", 6);
    const TEN_K = ethers.parseUnits("10000", 6);
    const FIVE_HK = ethers.parseUnits("500000", 6);

    await stablecoin.mint(owner.address, ONE_M);
    await stablecoin.mint(borrower.address, TEN_K);
    await stablecoin.mint(investor1.address, FIVE_HK);
    await stablecoin.mint(investor2.address, FIVE_HK);

    // Seed pool
    await stablecoin.approve(await stablecoinPool.getAddress(), ONE_M);
    await stablecoinPool.deposit(ONE_M);

    // Mint RWA tokens to borrower (1000 LST)
    const LST_AMOUNT = ethers.parseEther("1000");
    await rwaToken.mint(borrower.address, LST_AMOUNT);

    return {
      owner, borrower, investor1, investor2, liquidator,
      stablecoin, emissionsOracle, npvOracle, valuationOracle,
      adminController, stablecoinPool, disposalContract, vault, rwaToken,
    };
  }

  // ── AdminController ───────────────────────────────────────────────────────

  describe("AdminController", function () {
    it("should deploy with correct defaults", async function () {
      const { adminController } = await loadFixture(deployFixture);
      expect(await adminController.openFeePercent()).to.equal(50);
      expect(await adminController.closeFeePercent()).to.equal(50);
      expect(await adminController.collateralThreshold()).to.equal(15000);
      expect(await adminController.liquidationThreshold()).to.equal(11000);
    });

    it("owner can update fees", async function () {
      const { adminController } = await loadFixture(deployFixture);
      await adminController.setOpenFeePercent(100);
      expect(await adminController.openFeePercent()).to.equal(100);
    });

    it("reverts if fee exceeds 10%", async function () {
      const { adminController } = await loadFixture(deployFixture);
      await expect(adminController.setOpenFeePercent(1001)).to.be.revertedWith("Fee cannot exceed 10%");
    });

    it("non-owner cannot update fees", async function () {
      const { adminController, borrower } = await loadFixture(deployFixture);
      await expect(adminController.connect(borrower).setOpenFeePercent(100))
        .to.be.revertedWithCustomError(adminController, "OwnableUnauthorizedAccount");
    });
  });

  // ── Oracles ───────────────────────────────────────────────────────────────

  describe("Oracles", function () {
    it("EmissionsOracle returns correct value for amount", async function () {
      const { emissionsOracle, rwaToken } = await loadFixture(deployFixture);
      const val = await emissionsOracle.getEmissionsValue(
        await rwaToken.getAddress(),
        ethers.parseEther("100")
      );
      // 0.10 USD * 100 tokens = 10 USD (18 dec)
      expect(val).to.equal(ethers.parseEther("10"));
    });

    it("NPVOracle returns correct value for amount", async function () {
      const { npvOracle, rwaToken } = await loadFixture(deployFixture);
      const val = await npvOracle.getNPVValue(await rwaToken.getAddress(), ethers.parseEther("100"));
      expect(val).to.equal(ethers.parseEther("100"));
    });

    it("ValuationOracle aggregates correctly", async function () {
      const { valuationOracle, rwaToken } = await loadFixture(deployFixture);
      const total = await valuationOracle.getTotalValue(
        await rwaToken.getAddress(),
        ethers.parseEther("100")
      );
      // 0.10 + 1.00 = $1.10 per token → $110 for 100 tokens
      expect(total).to.equal(ethers.parseEther("110"));
    });
  });

  // ── StablecoinPool ────────────────────────────────────────────────────────

  describe("StablecoinPool", function () {
    it("investor can deposit and receive shares", async function () {
      const { stablecoinPool, stablecoin, investor1 } = await loadFixture(deployFixture);
      const depositAmount = ethers.parseUnits("10000", 6);
      await stablecoin.connect(investor1).approve(await stablecoinPool.getAddress(), depositAmount);
      await stablecoinPool.connect(investor1).deposit(depositAmount);
      expect(await stablecoinPool.shares(investor1.address)).to.be.gt(0);
    });

    it("investor can withdraw stablecoins", async function () {
      const { stablecoinPool, stablecoin, investor1 } = await loadFixture(deployFixture);
      const depositAmount = ethers.parseUnits("10000", 6);
      await stablecoin.connect(investor1).approve(await stablecoinPool.getAddress(), depositAmount);
      await stablecoinPool.connect(investor1).deposit(depositAmount);

      const sharesBefore = await stablecoinPool.shares(investor1.address);
      const balBefore = await stablecoin.balanceOf(investor1.address);
      await stablecoinPool.connect(investor1).withdraw(sharesBefore);
      const balAfter = await stablecoin.balanceOf(investor1.address);
      expect(balAfter - balBefore).to.be.closeTo(depositAmount, ethers.parseUnits("1", 6));
    });

    it("only vault can call borrow", async function () {
      const { stablecoinPool, borrower } = await loadFixture(deployFixture);
      await expect(
        stablecoinPool.connect(borrower).borrow(borrower.address, ethers.parseUnits("100", 6))
      ).to.be.revertedWith("StablecoinPool: caller not vault");
    });
  });

  // ── CollateralVault – open & close ────────────────────────────────────────

  describe("CollateralVault – open / close position", function () {
    it("borrower can open a position", async function () {
      const { vault, rwaToken, stablecoin, borrower } = await loadFixture(deployFixture);
      const lstAmount = ethers.parseEther("100");
      // Value: $110 → at 150% threshold max borrow ≈ $73.33
      const borrowAmount = ethers.parseUnits("70", 6);

      await rwaToken.connect(borrower).approve(await vault.getAddress(), lstAmount);
      await vault.connect(borrower).openPosition(await rwaToken.getAddress(), lstAmount, borrowAmount);

      const pos = await vault.getPosition(0);
      expect(pos.borrower).to.equal(borrower.address);
      expect(pos.lstAmount).to.equal(lstAmount);
      expect(pos.loanAmount).to.equal(borrowAmount);
      expect(pos.status).to.equal(0); // Active
    });

    it("reverts if collateral insufficient", async function () {
      const { vault, rwaToken, borrower } = await loadFixture(deployFixture);
      const lstAmount = ethers.parseEther("100");
      // Value $110 – trying to borrow $100 → health = 110% < 150% threshold
      const borrowAmount = ethers.parseUnits("100", 6);

      await rwaToken.connect(borrower).approve(await vault.getAddress(), lstAmount);
      await expect(
        vault.connect(borrower).openPosition(await rwaToken.getAddress(), lstAmount, borrowAmount)
      ).to.be.revertedWith("Insufficient collateral");
    });

    it("borrower can close their position", async function () {
      const { vault, rwaToken, stablecoin, borrower } = await loadFixture(deployFixture);
      const lstAmount = ethers.parseEther("100");
      const borrowAmount = ethers.parseUnits("70", 6);

      await rwaToken.connect(borrower).approve(await vault.getAddress(), lstAmount);
      await vault.connect(borrower).openPosition(await rwaToken.getAddress(), lstAmount, borrowAmount);

      // Borrower needs to repay loan + close fee
      const closeFee = (borrowAmount * 50n) / 10000n;
      const totalRepay = borrowAmount + closeFee;
      await stablecoin.connect(borrower).approve(await vault.getAddress(), totalRepay);

      const lstBefore = await rwaToken.balanceOf(borrower.address);
      await vault.connect(borrower).closePosition(0);
      const lstAfter = await rwaToken.balanceOf(borrower.address);
      expect(lstAfter - lstBefore).to.equal(lstAmount);

      const pos = await vault.getPosition(0);
      expect(pos.status).to.equal(1); // Closed
    });
  });

  // ── CollateralVault – top-up & harvest ───────────────────────────────────

  describe("CollateralVault – top-up and harvest", function () {
    it("borrower can top up their position", async function () {
      const { vault, rwaToken, borrower } = await loadFixture(deployFixture);
      const lstAmount = ethers.parseEther("100");
      const borrowAmount = ethers.parseUnits("70", 6);
      await rwaToken.connect(borrower).approve(await vault.getAddress(), lstAmount + ethers.parseEther("50"));
      await vault.connect(borrower).openPosition(await rwaToken.getAddress(), lstAmount, borrowAmount);

      await vault.connect(borrower).topUpPosition(0, ethers.parseEther("50"));
      const pos = await vault.getPosition(0);
      expect(pos.lstAmount).to.equal(lstAmount + ethers.parseEther("50"));
    });

    it("borrower can harvest excess collateral", async function () {
      const { vault, rwaToken, borrower } = await loadFixture(deployFixture);
      // Borrow very little so there's surplus to harvest
      const lstAmount = ethers.parseEther("100"); // $110 value
      const borrowAmount = ethers.parseUnits("10", 6); // $10 → very overcollateralized

      await rwaToken.connect(borrower).approve(await vault.getAddress(), lstAmount);
      await vault.connect(borrower).openPosition(await rwaToken.getAddress(), lstAmount, borrowAmount);

      const harvestable = await vault.harvestableCollateral(0);
      expect(harvestable).to.be.gt(0);

      const lstBefore = await rwaToken.balanceOf(borrower.address);
      // Withdraw a small amount
      await vault.connect(borrower).harvestPosition(0, ethers.parseEther("10"), 0);
      const lstAfter = await rwaToken.balanceOf(borrower.address);
      expect(lstAfter - lstBefore).to.equal(ethers.parseEther("10"));
    });
  });

  // ── Liquidation ───────────────────────────────────────────────────────────

  describe("Liquidation and Disposal Auction", function () {
    it("position cannot be liquidated when healthy", async function () {
      const { vault, rwaToken, borrower, liquidator } = await loadFixture(deployFixture);
      const lstAmount = ethers.parseEther("100");
      const borrowAmount = ethers.parseUnits("70", 6);
      await rwaToken.connect(borrower).approve(await vault.getAddress(), lstAmount);
      await vault.connect(borrower).openPosition(await rwaToken.getAddress(), lstAmount, borrowAmount);

      await expect(vault.connect(liquidator).liquidate(0)).to.be.revertedWith("Position is healthy");
    });

    it("position can be liquidated after oracle price drops", async function () {
      const { vault, rwaToken, borrower, liquidator, npvOracle, emissionsOracle } = await loadFixture(deployFixture);
      const lstAmount = ethers.parseEther("100");
      const borrowAmount = ethers.parseUnits("70", 6);
      await rwaToken.connect(borrower).approve(await vault.getAddress(), lstAmount);
      await vault.connect(borrower).openPosition(await rwaToken.getAddress(), lstAmount, borrowAmount);

      // Drop NPV to $0.50 and emissions to $0.02 → $0.52 per token → $52 for 100 tokens
      // Health = 52/70 * 10000 = 7428 < 11000 (liquidation threshold)
      await npvOracle.setNPVPerToken(await rwaToken.getAddress(), ethers.parseEther("0.50"));
      await emissionsOracle.setEmissionsPerToken(await rwaToken.getAddress(), ethers.parseEther("0.02"));

      await expect(vault.connect(liquidator).liquidate(0)).to.emit(vault, "PositionLiquidated");

      const pos = await vault.getPosition(0);
      expect(pos.status).to.equal(2); // Liquidated
    });

    it("investor can bid on disposal auction and win LSTs", async function () {
      const {
        vault, rwaToken, borrower, investor1, liquidator,
        npvOracle, emissionsOracle, stablecoin, disposalContract
      } = await loadFixture(deployFixture);

      // Open and liquidate a position
      const lstAmount = ethers.parseEther("100");
      const borrowAmount = ethers.parseUnits("70", 6);
      await rwaToken.connect(borrower).approve(await vault.getAddress(), lstAmount);
      await vault.connect(borrower).openPosition(await rwaToken.getAddress(), lstAmount, borrowAmount);
      await npvOracle.setNPVPerToken(await rwaToken.getAddress(), ethers.parseEther("0.50"));
      await emissionsOracle.setEmissionsPerToken(await rwaToken.getAddress(), ethers.parseEther("0.02"));
      await vault.connect(liquidator).liquidate(0);

      // Investor credits funds and bids
      const bidAmount = ethers.parseUnits("75", 6);
      await stablecoin.connect(investor1).approve(await disposalContract.getAddress(), bidAmount);
      await disposalContract.connect(investor1).creditFunds(bidAmount);
      await disposalContract.connect(investor1).placeBid(0, bidAmount);

      // Fast-forward past auction end
      await time.increase(25 * 3600);
      await disposalContract.connect(liquidator).finalizeAuction(0);

      // Investor should now hold the LSTs
      const lstBalance = await rwaToken.balanceOf(investor1.address);
      expect(lstBalance).to.equal(lstAmount);
    });
  });

  // ── Disposal Contract ─────────────────────────────────────────────────────

  describe("DisposalContract fund management", function () {
    it("investor can credit and withdraw funds when no auctions", async function () {
      const { disposalContract, stablecoin, investor1 } = await loadFixture(deployFixture);
      const amount = ethers.parseUnits("1000", 6);
      await stablecoin.connect(investor1).approve(await disposalContract.getAddress(), amount);
      await disposalContract.connect(investor1).creditFunds(amount);
      expect(await disposalContract.creditedBalance(investor1.address)).to.equal(amount);

      await disposalContract.connect(investor1).withdrawFunds(amount);
      expect(await disposalContract.creditedBalance(investor1.address)).to.equal(0);
    });
  });
});
