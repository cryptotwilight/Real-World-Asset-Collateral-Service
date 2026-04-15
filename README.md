# RWA Collateral Service — HashKey Chain

A decentralised protocol that lets holders of **Real-World Asset Liquid Staked Tokens (RWA LSTs)** use those tokens as collateral to borrow stablecoins. Built on [HashKey Chain](https://www.hashfans.io/) — an EVM-compatible Layer-2 optimised for regulated digital assets and institutional DeFi.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Smart Contracts](#smart-contracts)
4. [Oracle Design](#oracle-design)
5. [Position Lifecycle](#position-lifecycle)
6. [Liquidation & Disposal](#liquidation--disposal)
7. [Investor Pools](#investor-pools)
8. [Project Structure](#project-structure)
9. [Prerequisites](#prerequisites)
10. [Quick Start — Local](#quick-start--local)
11. [Deploy to HashKey Testnet](#deploy-to-hashkey-testnet)
12. [Run the Frontend](#run-the-frontend)
13. [Running Tests](#running-tests)
14. [Environment Variables Reference](#environment-variables-reference)
15. [Contract Addresses (Testnet)](#contract-addresses-testnet)
16. [Security Notes](#security-notes)

---

## Overview

RWA LSTs derive their value from two independent sources:

| Component | Description |
|---|---|
| **Emissions Entitlement** | Present value of the underlying asset's income stream (rent, royalties, dividends) |
| **Net Present Value (NPV)** | Discounted fair value of the physical/legal asset itself |

Both values are reported by on-chain oracle contracts (stubbed for testnet, designed to be replaced with Chainlink feeds or credentialled keeper oracles on mainnet).

A borrower locks their LSTs in the `CollateralVault`, receives stablecoins from the `StablecoinPool`, and must maintain a **health factor ≥ 150%** to keep their position open. If the health factor falls below **110%** (the liquidation threshold), anyone can liquidate the position — the LSTs are transferred to the `DisposalContract` and auctioned to investors.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                    │
│   /borrower     /investor     /admin                         │
│   RainbowKit · Wagmi · viem                                  │
└─────────────────────────────┬────────────────────────────────┘
                              │ RPC / events
┌─────────────────────────────▼────────────────────────────────┐
│                     HashKey Chain (EVM)                      │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐   │
│  │               AdminController                        │   │
│  │  fees · collateral threshold · liquidation thresh.   │   │
│  └──────────────────────────┬────────────────────────────┘   │
│                             │                                │
│  ┌──────────────────────────▼────────────────────────────┐   │
│  │               CollateralVault                        │   │
│  │  open · close · topUp · harvest · liquidate          │   │
│  └──────┬──────────────────┬──────────────────┬──────────┘   │
│         │                  │                  │              │
│  ┌──────▼──────┐  ┌────────▼───────┐  ┌──────▼──────────┐   │
│  │ Stablecoin  │  │   Disposal     │  │  RWAValuation   │   │
│  │    Pool     │  │   Contract     │  │    Oracle       │   │
│  │  LP shares  │  │   Auctions     │  │  Emissions+NPV  │   │
│  └─────────────┘  └────────────────┘  └─────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

---

## Smart Contracts

| Contract | Purpose |
|---|---|
| `AdminController` | Governance of all protocol parameters: open/close fees (basis points), collateral threshold, liquidation threshold, auction duration. Owner-only. |
| `EmissionsOracle` | Stub oracle: USD value of the income stream entitlement per LST token. Updated by owner / authorised keepers. |
| `NPVOracle` | Stub oracle: Net Present Value (USD) of the underlying RWA per LST token. |
| `RWAValuationOracle` | Aggregates the two oracles into a single USD price per token. Supports per-token risk haircuts (basis-point weights). |
| `RWAToken` | Controlled ERC-20 representing an RWA LST. Minting/burning restricted to `MINTER_ROLE`. |
| `RWATokenFactory` | Deploys and registers new `RWAToken` instances. Owner-gated. Used by admins to onboard new RWA classes. |
| `MockStablecoin` | Development/testnet stablecoin (USDC-like, 6 decimals). Replace with real USDC on mainnet. |
| `Faucet` | Testnet faucet. Mints 100 tokens of any registered asset (mUSDC + all RWA LSTs) with a 1-hour per-token per-address cooldown. |
| `StablecoinPool` | LP pool where investors deposit stablecoins. Earns pro-rata fees from every position open and close. Share-based accounting (ERC-4626 inspired). |
| `DisposalContract` | Handles liquidation auctions. Investors pre-credit funds; winning bidder receives LSTs, debt is repaid to the pool. |
| `CollateralVault` | Core contract: open/close/topUp/harvest/liquidate collateral positions. Supports an **emissions-routing flag** — on open the borrower chooses whether emissions are added to collateral value or held for them until close. |

---

## Oracle Design

The protocol uses a **dual-oracle stack** to value RWA LSTs, capturing both the income-stream dimension and the asset-value dimension:

```
totalValuePerToken = emissionsPerToken × emissionsWeight
                   + npvPerToken       × npvWeight
```

Weights default to 100% (10 000 bp) and can be adjusted by governance to apply risk haircuts (e.g. reduce NPV weight for illiquid underlying assets).

**Oracle research on HashKey Chain (April 2026):** At the time of building, neither Chainlink Data Feeds nor Supra Oracles had deployed price feeds on HashKey Chain, and hashfans.io does not yet expose an oracle SDK. The protocol therefore uses an **admin-push** pattern: oracle values are set by the contract owner (or authorised updater) via `setEmissionsPerToken` / `setNPVPerToken`. The frontend admin dashboard provides forms for updating these values, and the on-chain `RWAValuationOracle` is ready to be swapped for Chainlink/Supra feeds once they deploy on HashKey Chain — no other contract needs to change.

**Production path:** Replace the oracle contracts with Chainlink Data Feeds or a custom push-oracle updated by a credentialled off-chain keeper (e.g. a licensed valuation agent).

## Emissions Routing

When opening a position the borrower chooses one of two modes:

| Mode | Effect on valuation | Effect on emissions |
|---|---|---|
| **Include in collateral** (default) | Collateral value = emissions + NPV — higher borrow power | Emissions accrue to the LSTs held in the vault; they return to the borrower on close as part of the original LST balance |
| **Route to me on close** | Collateral value = NPV only — more conservative | Emissions accrue to the LSTs held in the vault for the lifetime of the position; the entire LST balance (including accrued emissions) is returned to the borrower on close |

The flag is stored on the `Position` and enforced on every valuation call — `topUp`, `harvest`, `liquidate`, and `healthFactor` all respect it.

---

## Position Lifecycle

```
                ┌─────────────────────────────────────────────────────────┐
                │                                                         │
 Borrower ──▶  openPosition(lstToken, lstAmount, borrowAmount,            │
                              includeEmissions)                           │
                │  • LSTs locked in vault                                 │
                │  • Net stablecoins sent to borrower                     │
                │  • Open fee retained by pool                            │
                │  • includeEmissions=true  → emissions count as collateral│
                │  • includeEmissions=false → emissions returned on close │
                └────────────────┬────────────────────────────────────────┘
                                 │
              ┌──────────────────┼──────────────────────┐
              │                  │                      │
              ▼                  ▼                      ▼
        topUpPosition      harvestPosition        closePosition
        (add collateral)   (withdraw surplus      (repay loan,
                            or borrow more)        get LSTs back)
              │                  │                      │
              └──────────────────┼──────────────────────┘
                                 │
                        healthFactor < 110%?
                                 │
                                 ▼
                            liquidate()
                        (anyone can call)
                                 │
                                 ▼
                        DisposalContract
                        (LSTs auctioned)
```

**Health Factor** = `(collateralValueUSD × 10 000) / loanAmount`

- Expressed in basis points: `15 000` = 150%
- **Open minimum:** 150% (configurable via `AdminController`)
- **Liquidation threshold:** 110% (configurable)

---

## Liquidation & Disposal

When a position is liquidated:

1. The `CollateralVault` transfers all LSTs to the `DisposalContract`.
2. A timed auction is opened (default: 24 hours).
3. Investors who have **pre-credited** stablecoins into the `DisposalContract` place ascending bids.
4. After the auction ends, anyone calls `finalizeAuction()`:
   - The winning bid (≥ outstanding debt) is sent to the `StablecoinPool` to clear the bad debt.
   - Any surplus over the debt is returned to the original borrower.
   - The winning investor receives the LSTs.

**Investor credit rules:**
- Credited funds are locked while there are active auctions **and** the investor has an active bid.
- Funds may be withdrawn freely when there are no active auctions.

---

## Investor Pools

### Stablecoin Pool

| Action | Effect |
|---|---|
| `deposit(amount)` | Mint proportional pool shares |
| `withdraw(shares)` | Burn shares, receive stablecoins + accrued fees |

Fees from `openFeePercent` and `closeFeePercent` (set in `AdminController`) flow back into the pool, increasing the redemption value of all shares.

### Disposal Pool

| Action | Effect |
|---|---|
| `creditFunds(amount)` | Lock stablecoins ready for bidding |
| `placeBid(auctionId, amount)` | Compete for liquidated LST bundles |
| `withdrawFunds(amount)` | Reclaim free balance (when no active bids) |

---

## Project Structure

```
Real-World-Asset-Collateral-Service/
├── contracts/                      # Hardhat project
│   ├── contracts/
│   │   ├── core/
│   │   │   ├── AdminController.sol
│   │   │   ├── CollateralVault.sol
│   │   │   ├── DisposalContract.sol
│   │   │   └── StablecoinPool.sol
│   │   ├── oracles/
│   │   │   ├── EmissionsOracle.sol
│   │   │   ├── NPVOracle.sol
│   │   │   └── RWAValuationOracle.sol
│   │   └── tokens/
│   │       ├── MockStablecoin.sol
│   │       └── RWAToken.sol
│   ├── scripts/
│   │   └── deploy.js               # Full deploy + wiring script
│   ├── test/
│   │   └── RWACollateral.test.js   # Integration test suite
│   ├── .env                        # Private — add PRIVATE_KEY here
│   ├── .env.example
│   └── hardhat.config.js
│
├── frontend/                       # Next.js 14 App Router
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx            # Landing page + live protocol stats
│   │   │   ├── borrower/page.tsx   # Borrower dashboard
│   │   │   ├── investor/page.tsx   # Investor dashboard
│   │   │   ├── admin/page.tsx      # Admin dashboard + factory form
│   │   │   └── faucet/page.tsx     # Testnet faucet
│   │   ├── components/
│   │   │   ├── borrower/           # OpenPositionModal, PositionCard
│   │   │   ├── investor/           # StablecoinPoolPanel, DisposalPoolPanel
│   │   │   ├── layout/             # Navbar, Footer
│   │   │   └── ui/                 # StatCard, Modal, HealthBar
│   │   ├── hooks/                  # wagmi read/write wrappers
│   │   │   ├── useCollateralVault.ts
│   │   │   ├── useStablecoinPool.ts
│   │   │   ├── useDisposalContract.ts
│   │   │   ├── useAdminController.ts
│   │   │   ├── useFaucet.ts
│   │   │   ├── useRWATokenFactory.ts
│   │   │   ├── useProtocolStats.ts
│   │   │   └── useToken.ts
│   │   ├── lib/
│   │   │   ├── contracts.ts        # Addresses + minimal ABIs
│   │   │   └── wagmi.ts            # Chain defs + RainbowKit config
│   │   └── types/index.ts
│   ├── .env.local                  # Private — add addresses here after deploy
│   ├── .env.example
│   └── package.json
│
├── .gitignore
├── package.json                    # Yarn workspaces root
└── README.md
```

---

## Prerequisites

- **Node.js** ≥ 18
- **Yarn** ≥ 1.22 (classic)
- A wallet with **HSK (HashKey testnet tokens)** for gas — faucet: https://faucet.hashkey.cloud
- Deployer address: `0x1D6a32cAcf1b8539af2125ACf037B2b76806a89b`

---

## Quick Start — Local

### 1. Install dependencies

```bash
# From repo root
yarn install
```

### 2. Compile contracts

```bash
yarn contracts:compile
```

### 3. Run a local Hardhat node

```bash
yarn contracts:node
```

### 4. Deploy to localhost (in a second terminal)

```bash
yarn contracts:deploy:local
```

The script prints all addresses and writes them to `contracts/deployments/31337.json`.

### 5. Copy addresses to frontend `.env.local`

```bash
# contracts/deployments/31337.json contains all deployed addresses.
# Copy each value into frontend/.env.local
```

### 6. Start the frontend

```bash
yarn frontend:dev
# Open http://localhost:3000
```

---

## Deploy to HashKey Testnet

### 1. Add your private key

Edit `contracts/.env`:

```
PRIVATE_KEY=<your_private_key_without_0x_prefix>
```

> Deployer wallet: `0x1D6a32cAcf1b8539af2125ACf037B2b76806a89b`
> Make sure it has testnet HSK — get some from https://faucet.hashkey.cloud

### 2. Deploy

```bash
yarn contracts:deploy:hashkey-testnet
```

Addresses are printed to the console **and** written to `contracts/deployments/133.json`.

### 3. Configure the frontend

Copy each address from `contracts/deployments/133.json` into `frontend/.env.local`:

```env
NEXT_PUBLIC_STABLECOIN_ADDRESS=0x...
NEXT_PUBLIC_EMISSIONS_ORACLE=0x...
NEXT_PUBLIC_NPV_ORACLE=0x...
NEXT_PUBLIC_VALUATION_ORACLE=0x...
NEXT_PUBLIC_ADMIN_CONTROLLER=0x...
NEXT_PUBLIC_STABLECOIN_POOL=0x...
NEXT_PUBLIC_DISPOSAL_CONTRACT=0x...
NEXT_PUBLIC_COLLATERAL_VAULT=0x...
NEXT_PUBLIC_RWA_TOKEN_HKCRE=0x...
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<your_wc_project_id>
```

---

## Run the Frontend

```bash
yarn frontend:dev      # development — http://localhost:3000
yarn frontend:build    # production build
yarn frontend:start    # serve production build
```

Connect MetaMask or any WalletConnect wallet to **HashKey Chain Testnet** (chainId 133).

| Dashboard | URL | Who uses it |
|---|---|---|
| Landing | `/` | Anyone |
| Borrower | `/borrower` | RWA LST holders who want to borrow |
| Investor | `/investor` | Liquidity providers & disposal bidders |
| Admin | `/admin` | Protocol owner (fee & oracle config) |

---

## Running Tests

```bash
cd contracts
npx hardhat test                       # all tests
npx hardhat coverage                   # coverage report
REPORT_GAS=true npx hardhat test       # with gas usage
```

The test suite covers:

- `AdminController` fee configuration and access control
- Oracle value calculations (emissions, NPV, aggregation)
- `StablecoinPool` deposit / withdraw / access control
- `CollateralVault` open / close / top-up / harvest
- Liquidation flow end-to-end: price drop → liquidate → bid → finalize → LST transfer
- `DisposalContract` fund credit / withdrawal rules

---

## Environment Variables Reference

### `contracts/.env`

| Variable | Required | Description |
|---|---|---|
| `PRIVATE_KEY` | Yes | Deployer private key (no `0x` prefix) |
| `HASHKEY_TESTNET_RPC` | No | HashKey testnet RPC (default provided) |
| `HASHKEY_MAINNET_RPC` | No | HashKey mainnet RPC (default provided) |
| `REPORT_GAS` | No | Set `true` to print gas usage in tests |
| `HASHKEY_EXPLORER_API_KEY` | No | Block explorer API key |

### `frontend/.env.local`

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect Cloud project ID |
| `NEXT_PUBLIC_STABLECOIN_ADDRESS` | MockStablecoin / USDC address |
| `NEXT_PUBLIC_EMISSIONS_ORACLE` | EmissionsOracle address |
| `NEXT_PUBLIC_NPV_ORACLE` | NPVOracle address |
| `NEXT_PUBLIC_VALUATION_ORACLE` | RWAValuationOracle address |
| `NEXT_PUBLIC_ADMIN_CONTROLLER` | AdminController address |
| `NEXT_PUBLIC_STABLECOIN_POOL` | StablecoinPool address |
| `NEXT_PUBLIC_DISPOSAL_CONTRACT` | DisposalContract address |
| `NEXT_PUBLIC_COLLATERAL_VAULT` | CollateralVault address |
| `NEXT_PUBLIC_RWA_TOKEN_FACTORY` | RWATokenFactory address |
| `NEXT_PUBLIC_FAUCET` | Faucet address |
| `NEXT_PUBLIC_RWA_TOKEN_HKCRE` | hkCRE RWAToken address |
| `NEXT_PUBLIC_RWA_TOKEN_HKGOLD` | hkGOLD RWAToken address |
| `NEXT_PUBLIC_RWA_TOKEN_HKSILVER` | hkSILVER RWAToken address |
| `NEXT_PUBLIC_RWA_TOKEN_HKOIL` | hkOIL RWAToken address |
| `NEXT_PUBLIC_RWA_TOKEN_HKCOAL` | hkCOAL RWAToken address |

---

## Contract Addresses (Testnet)

Deployed 2026-04-10 (v2 — RWA factory + faucet + multi-asset).

| Contract | Address |
|---|---|
| MockStablecoin (mUSDC) | `0xa3727c5952054635fb220aBf3A714222457bD91d` |
| EmissionsOracle        | `0x30010dD449797F9CE8CFb346e9D235d1C6057D83` |
| NPVOracle              | `0x52be1c1c63D31E4517b2e8b6d3536b3340c7259F` |
| RWAValuationOracle     | `0x9209C5A120FB1adF1De99Cf83be1874e4Be6BE1e` |
| AdminController        | `0x0c356E7Ba93e9203894259401AA0094237eAA2CC` |
| StablecoinPool         | `0x0C753D786385e2f47eBC3d945F123edcB674Ae19` |
| DisposalContract       | `0x2dAE4688B740a9FF42DE9bD259bFE87E29bb5979` |
| CollateralVault        | `0xf86D0E0018B12eb0978FD4E3c7dcC36F55d63b0F` |
| RWATokenFactory        | `0x2C072312CD9577D12524Ac44e21a4E3215c13194` |
| Faucet                 | `0xc45d6EE409d9e358B96B0c25bE3F7E3b0e563D3a` |
| RWAToken hkCRE         | `0xEa9919b7167feC5e389dF6f006E4F6446f699610` |
| RWAToken hkGOLD        | `0xB7A261732727e4D410c696821b0Ce28913E5C978` |
| RWAToken hkSILVER      | `0x14b5df6B56be0DfbE684114b5b3D38F3C21d469A` |
| RWAToken hkOIL         | `0xB8Fbb7baDa697b8CA969D6A3876Bb1B67021451D` |
| RWAToken hkCOAL        | `0x7B8bd123c21b2B9fD6581225B9fCE9af56E6b229` |

- **Network:** HashKey Chain Testnet
- **Chain ID:** `133`
- **RPC:** `https://testnet.hsk.xyz`
- **Explorer:** `https://testnet-explorer.hsk.xyz`
- **Deployer:** `0x1D6a32cAcf1b8539af2125ACf037B2b76806a89b`

---

## Security Notes

- Contracts are **unaudited**. Do not use on mainnet without a professional security audit.
- Oracle values are currently set manually by the owner. In production, replace with tamper-resistant price feeds and multi-sig governance.
- The `MockStablecoin` has an open `mint()` function — replace with a real stablecoin on mainnet.
- Never commit `contracts/.env` or `frontend/.env.local` — both are in `.gitignore`.
