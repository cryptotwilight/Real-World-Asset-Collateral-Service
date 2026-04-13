const { ethers } = require("hardhat");

/**
 * Deployment script for the RWA Collateral Service on HashKey Chain.
 *
 * Deploys all core contracts, 5 RWA tokens (CRE, Gold, Silver, Oil, Coal),
 * the RWATokenFactory, and a testnet Faucet.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "HSK\n");

  // ── 1. MockStablecoin ────────────────────────────────────────────────────
  console.log("1. Deploying MockStablecoin (USDC mock, 6 decimals)...");
  const MockStablecoin = await ethers.getContractFactory("MockStablecoin");
  const stablecoin = await MockStablecoin.deploy("Mock USDC", "mUSDC", 6);
  await stablecoin.waitForDeployment();
  console.log("   MockStablecoin:", await stablecoin.getAddress());

  // ── 2. EmissionsOracle ───────────────────────────────────────────────────
  console.log("2. Deploying EmissionsOracle...");
  const EmissionsOracle = await ethers.getContractFactory("EmissionsOracle");
  const emissionsOracle = await EmissionsOracle.deploy();
  await emissionsOracle.waitForDeployment();
  console.log("   EmissionsOracle:", await emissionsOracle.getAddress());

  // ── 3. NPVOracle ─────────────────────────────────────────────────────────
  console.log("3. Deploying NPVOracle...");
  const NPVOracle = await ethers.getContractFactory("NPVOracle");
  const npvOracle = await NPVOracle.deploy();
  await npvOracle.waitForDeployment();
  console.log("   NPVOracle:", await npvOracle.getAddress());

  // ── 4. RWAValuationOracle ────────────────────────────────────────────────
  console.log("4. Deploying RWAValuationOracle...");
  const RWAValuationOracle = await ethers.getContractFactory("RWAValuationOracle");
  const valuationOracle = await RWAValuationOracle.deploy(
    await emissionsOracle.getAddress(),
    await npvOracle.getAddress()
  );
  await valuationOracle.waitForDeployment();
  console.log("   RWAValuationOracle:", await valuationOracle.getAddress());

  // ── 5. AdminController ───────────────────────────────────────────────────
  console.log("5. Deploying AdminController...");
  const AdminController = await ethers.getContractFactory("AdminController");
  const adminController = await AdminController.deploy(50, 50, 15000, 11000, 24 * 3600);
  await adminController.waitForDeployment();
  console.log("   AdminController:", await adminController.getAddress());

  // ── 6. StablecoinPool ────────────────────────────────────────────────────
  console.log("6. Deploying StablecoinPool...");
  const StablecoinPool = await ethers.getContractFactory("StablecoinPool");
  const stablecoinPool = await StablecoinPool.deploy(await stablecoin.getAddress());
  await stablecoinPool.waitForDeployment();
  console.log("   StablecoinPool:", await stablecoinPool.getAddress());

  // ── 7. DisposalContract ──────────────────────────────────────────────────
  console.log("7. Deploying DisposalContract...");
  const DisposalContract = await ethers.getContractFactory("DisposalContract");
  const disposalContract = await DisposalContract.deploy(await stablecoin.getAddress(), 24 * 3600);
  await disposalContract.waitForDeployment();
  console.log("   DisposalContract:", await disposalContract.getAddress());

  // ── 8. CollateralVault ───────────────────────────────────────────────────
  console.log("8. Deploying CollateralVault...");
  const CollateralVault = await ethers.getContractFactory("CollateralVault");
  const collateralVault = await CollateralVault.deploy(
    await adminController.getAddress(),
    await stablecoinPool.getAddress(),
    await disposalContract.getAddress(),
    await valuationOracle.getAddress(),
    await stablecoin.getAddress()
  );
  await collateralVault.waitForDeployment();
  console.log("   CollateralVault:", await collateralVault.getAddress());

  // ── 9. RWA Tokens ────────────────────────────────────────────────────────
  const RWAToken = await ethers.getContractFactory("RWAToken");

  const rwaTokens = [
    { name: "HashKey CRE LST",    symbol: "hkCRE",    desc: "Commercial Real Estate Portfolio",    emissionsUsd: "0.10", npvUsd: "1.00"   },
    { name: "HashKey Gold LST",   symbol: "hkGOLD",   desc: "Gold Bullion Reserve",                emissionsUsd: "0.00", npvUsd: "2350.00" },
    { name: "HashKey Silver LST", symbol: "hkSILVER", desc: "Silver Bullion Reserve",              emissionsUsd: "0.00", npvUsd: "30.00"   },
    { name: "HashKey Oil LST",    symbol: "hkOIL",    desc: "Crude Oil (WTI) Futures Backed",      emissionsUsd: "0.02", npvUsd: "60.00"   },
    { name: "HashKey Coal LST",   symbol: "hkCOAL",   desc: "Thermal Coal Forward Contracts",      emissionsUsd: "0.01", npvUsd: "130.00"  },
  ];

  const deployedTokens = {};
  for (let i = 0; i < rwaTokens.length; i++) {
    const t = rwaTokens[i];
    console.log(`9.${i + 1}. Deploying ${t.symbol}...`);
    const token = await RWAToken.deploy(t.name, t.symbol, t.desc, "ipfs://QmPlaceholder", deployer.address);
    await token.waitForDeployment();
    const addr = await token.getAddress();
    console.log(`   ${t.symbol}: ${addr}`);
    deployedTokens[t.symbol] = { address: addr, contract: token, ...t };
  }

  // ── 10. RWATokenFactory ──────────────────────────────────────────────────
  console.log("10. Deploying RWATokenFactory...");
  const RWATokenFactory = await ethers.getContractFactory("RWATokenFactory");
  const tokenFactory = await RWATokenFactory.deploy();
  await tokenFactory.waitForDeployment();
  console.log("   RWATokenFactory:", await tokenFactory.getAddress());

  // Register existing tokens in the factory
  for (const sym of Object.keys(deployedTokens)) {
    const t = deployedTokens[sym];
    await tokenFactory.registerToken(t.address, t.name, t.symbol, t.desc);
    console.log(`   Registered ${sym} in factory`);
  }

  // ── 11. Faucet ───────────────────────────────────────────────────────────
  console.log("11. Deploying Faucet...");
  const Faucet = await ethers.getContractFactory("Faucet");
  const faucet = await Faucet.deploy();
  await faucet.waitForDeployment();
  console.log("   Faucet:", await faucet.getAddress());

  // Add stablecoin + all RWA tokens to faucet, and grant faucet MINTER_ROLE
  await faucet.addToken(await stablecoin.getAddress());
  console.log("   Faucet: mUSDC added");

  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
  for (const sym of Object.keys(deployedTokens)) {
    const t = deployedTokens[sym];
    await faucet.addToken(t.address);
    // Grant faucet the MINTER_ROLE on the RWA token
    await t.contract.grantRole(MINTER_ROLE, await faucet.getAddress());
    console.log(`   Faucet: ${sym} added + MINTER_ROLE granted`);
  }

  // ── Post-deploy Wiring ───────────────────────────────────────────────────
  console.log("\nWiring contracts...");
  await stablecoinPool.setCollateralVault(await collateralVault.getAddress());
  console.log("   StablecoinPool → CollateralVault wired");
  await disposalContract.setCollateralVault(await collateralVault.getAddress());
  console.log("   DisposalContract → CollateralVault wired");

  // ── Seed Oracle Values ───────────────────────────────────────────────────
  console.log("\nSeeding oracle values...");
  for (const sym of Object.keys(deployedTokens)) {
    const t = deployedTokens[sym];
    await emissionsOracle.setEmissionsPerToken(t.address, ethers.parseEther(t.emissionsUsd));
    await npvOracle.setNPVPerToken(t.address, ethers.parseEther(t.npvUsd));
    console.log(`   ${sym}: emissions=$${t.emissionsUsd}, NPV=$${t.npvUsd}`);
  }

  // ── Seed Stablecoin Pool ─────────────────────────────────────────────────
  const poolSeed = ethers.parseUnits("1000000", 6);
  await stablecoin.mint(deployer.address, poolSeed);
  await stablecoin.approve(await stablecoinPool.getAddress(), poolSeed);
  await stablecoinPool.deposit(poolSeed);
  console.log("   StablecoinPool seeded with 1,000,000 mUSDC");

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log("\n════════════════════════════════════════════════════");
  console.log("Deployment complete. Contract addresses:");
  console.log("════════════════════════════════════════════════════");

  const tokenAddresses = {};
  for (const sym of Object.keys(deployedTokens)) {
    tokenAddresses[`RWAToken_${sym}`] = deployedTokens[sym].address;
  }

  const addresses = {
    MockStablecoin:      await stablecoin.getAddress(),
    EmissionsOracle:     await emissionsOracle.getAddress(),
    NPVOracle:           await npvOracle.getAddress(),
    RWAValuationOracle:  await valuationOracle.getAddress(),
    AdminController:     await adminController.getAddress(),
    StablecoinPool:      await stablecoinPool.getAddress(),
    DisposalContract:    await disposalContract.getAddress(),
    CollateralVault:     await collateralVault.getAddress(),
    RWATokenFactory:     await tokenFactory.getAddress(),
    Faucet:              await faucet.getAddress(),
    ...tokenAddresses,
  };
  console.log(JSON.stringify(addresses, null, 2));

  const fs = require("fs");
  const path = require("path");
  const outPath = path.join(__dirname, "..", "deployments", `${(await ethers.provider.getNetwork()).chainId}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ ...addresses, deployedAt: new Date().toISOString() }, null, 2));
  console.log(`\nAddresses saved to ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
