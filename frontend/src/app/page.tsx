"use client";

import Link from "next/link";
import { formatEther, formatUnits } from "viem";
import { ArrowRight, ShieldCheck, BarChart2, Vault, Zap, Globe, Lock, TrendingUp, Droplet } from "lucide-react";
import { useProtocolStats, useTokenPrice } from "@/hooks/useProtocolStats";
import { usePoolStats } from "@/hooks/useStablecoinPool";
import { RWA_TOKENS, type RWATokenInfo } from "@/lib/contracts";

export default function HomePage() {
  const { activePositions, totalBorrowed, totalLiquidated, currentTotalBorrowed } = useProtocolStats();
  const poolStats = usePoolStats();

  const activeCount      = Number(activePositions ?? 0n);
  const totalBorrowedUsd = Number(formatUnits(totalBorrowed ?? 0n, 6));
  const liquidatedCount  = Number(totalLiquidated ?? 0n);
  const currentBorrowed  = Number(formatUnits(currentTotalBorrowed ?? 0n, 6));
  const tvl              = Number(formatUnits(poolStats.totalAssets, 6));

  return (
    <div className="space-y-16 py-8">
      {/* Hero */}
      <section className="text-center space-y-6 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-900/40 border border-brand-800/50 text-brand-300 text-xs font-medium">
          <Globe className="w-3.5 h-3.5" />
          Live on HashKey Chain Testnet
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-slate-100 leading-tight">
          Unlock Liquidity From
          <br />
          <span className="text-brand-400">Real-World Assets</span>
        </h1>
        <p className="text-slate-400 text-lg max-w-xl mx-auto leading-relaxed">
          Collateralise RWA Liquid Staked Tokens — CRE, Gold, Silver, Oil, Coal — to borrow stablecoins.
          Dual-oracle valuations combine emissions entitlement and net present value.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link href="/borrower" className="btn-primary text-base px-6 py-3">
            Open a Position
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/investor" className="btn-secondary text-base px-6 py-3">
            Invest / Provide Liquidity
          </Link>
          <Link href="/faucet" className="btn-secondary text-base px-6 py-3">
            <Droplet className="w-4 h-4" /> Get Test Tokens
          </Link>
        </div>
      </section>

      {/* Live protocol stats */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <LiveStat label="Active Positions"        value={activeCount.toLocaleString()} />
        <LiveStat label="Outstanding Debt"        value={`$${currentBorrowed.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
        <LiveStat label="Total Borrowed All-Time" value={`$${totalBorrowedUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
        <LiveStat label="Liquidations"            value={liquidatedCount.toLocaleString()} />
      </section>

      {/* Live RWA prices */}
      <section className="card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-brand-400" /> Live RWA Price Feeds
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Prices streamed on-chain from the Emissions + NPV dual oracle.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {RWA_TOKENS.map((t) => (
            <PriceCard key={t.address} token={t} />
          ))}
        </div>
      </section>

      {/* Top DeFi destinations */}
      <section className="card space-y-3">
        <h2 className="text-sm font-semibold text-slate-200">Top DeFi Destinations for Borrowed Stablecoins</h2>
        <p className="text-xs text-slate-500">Where the community typically deploys mUSDC borrowed against RWA collateral.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          {[
            { name: "hashfans.io", desc: "RWA staking & LST minting",    tag: "Native" },
            { name: "Aster DEX",   desc: "Stable-stable swaps on HashKey", tag: "AMM"    },
            { name: "Izumi Finance",desc: "Concentrated liquidity pools",    tag: "CLMM"   },
            { name: "SushiSwap",   desc: "Cross-chain routing",            tag: "DEX"    },
          ].map((d) => (
            <div key={d.name} className="p-3 rounded-lg bg-surface border border-surface-border">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-200 text-sm">{d.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-900/40 text-brand-300">{d.tag}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">{d.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Feature grid */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          {
            icon: Lock,
            title: "Dual-Oracle Valuation",
            desc: "LST collateral priced using both emissions entitlement and net present value — robust, manipulation-resistant.",
          },
          {
            icon: Vault,
            title: "Borrow Against 5 RWAs",
            desc: "CRE, Gold, Silver, Oil, Coal. Lock LSTs, mint stablecoins, monitor health in real time.",
          },
          {
            icon: ShieldCheck,
            title: "Transparent Liquidations",
            desc: "Under-collateralised positions auctioned via disposal pool. Investors bid with pre-credited funds.",
          },
          {
            icon: BarChart2,
            title: "Earn Yield as LP",
            desc: "Deposit mUSDC into the lending pool. Earn pro-rata fees from every position open and close.",
          },
          {
            icon: Zap,
            title: "Emissions Routing",
            desc: "Choose whether emissions accrue to the collateral value or route back to you when the position closes.",
          },
          {
            icon: Globe,
            title: "HashKey Chain Native",
            desc: "Built on HashKey Chain — an EVM L2 optimised for regulated assets and institutional DeFi.",
          },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="card-hover space-y-3">
            <div className="w-9 h-9 rounded-lg bg-brand-900/40 border border-brand-800/40 flex items-center justify-center">
              <Icon className="w-4 h-4 text-brand-400" />
            </div>
            <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
            <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
          </div>
        ))}
      </section>

      {/* Protocol params banner */}
      <section className="card border-brand-800/30 bg-brand-950/20">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            { label: "Pool TVL",              value: `$${tvl.toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
            { label: "Collateral Threshold", value: "150%" },
            { label: "Liquidation Threshold", value: "110%" },
            { label: "Max Borrow Fee",        value: "0.5%" },
          ].map(({ label, value }) => (
            <div key={label}>
              <div className="text-2xl font-bold text-brand-400">{value}</div>
              <div className="text-xs text-slate-500 mt-1">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="text-center space-y-4">
        <h2 className="text-xl font-semibold text-slate-200">Ready to get started?</h2>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link href="/borrower" className="btn-primary">
            Borrower Dashboard <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/investor" className="btn-secondary">
            Investor Dashboard
          </Link>
          <Link href="/faucet" className="btn-secondary">
            Faucet
          </Link>
        </div>
      </section>
    </div>
  );
}

function LiveStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card text-center">
      <div className="text-2xl font-bold text-slate-100">{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  );
}

function PriceCard({ token }: { token: RWATokenInfo }) {
  const price = useTokenPrice(token.address as `0x${string}`);
  const priceNum = Number(formatEther(price));
  return (
    <div className="p-3 rounded-lg bg-surface border border-surface-border">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-slate-200 text-sm">{token.symbol}</span>
        <span className="text-[10px] text-slate-500">LST</span>
      </div>
      <div className="mt-1.5 font-mono text-lg text-brand-400">
        ${priceNum.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </div>
      <div className="text-[10px] text-slate-500 mt-0.5">{token.assetDescription}</div>
    </div>
  );
}
