"use client";

import Link from "next/link";
import { ArrowRight, ShieldCheck, BarChart2, Vault, Zap, Globe, Lock } from "lucide-react";

export default function HomePage() {
  return (
    <div className="space-y-20 py-8">
      {/* Hero */}
      <section className="text-center space-y-6 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-900/40 border border-brand-800/50 text-brand-300 text-xs font-medium">
          <Globe className="w-3.5 h-3.5" />
          Deployed on HashKey Chain
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-slate-100 leading-tight">
          Unlock Liquidity From
          <br />
          <span className="text-brand-400">Real-World Assets</span>
        </h1>
        <p className="text-slate-400 text-lg max-w-xl mx-auto leading-relaxed">
          Collateralise your RWA Liquid Staked Tokens to borrow stablecoins.
          Valuations powered by dual on-chain oracles combining emissions entitlement
          and net present value.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link href="/borrower" className="btn-primary text-base px-6 py-3">
            Open a Position
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/investor" className="btn-secondary text-base px-6 py-3">
            Invest / Provide Liquidity
          </Link>
        </div>
      </section>

      {/* Feature grid */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          {
            icon: Lock,
            title: "Dual-Oracle Valuation",
            desc: "LST collateral is priced using both emissions entitlement (income stream) and net present value (underlying asset), giving a robust, manipulation-resistant price.",
          },
          {
            icon: Vault,
            title: "Borrow Against RWAs",
            desc: "Lock your LSTs, receive stablecoins instantly from the liquidity pool. Repay any time and reclaim your tokens. Monitor health in real time.",
          },
          {
            icon: ShieldCheck,
            title: "Transparent Liquidations",
            desc: "Under-collateralised positions are liquidated via a transparent Dutch auction. Investors bid with pre-credited funds and receive LSTs at a discount.",
          },
          {
            icon: BarChart2,
            title: "Earn Yield as LP",
            desc: "Deposit stablecoins into the lending pool. Earn pro-rata fees from every position open and close. Track TVL and fee income on your dashboard.",
          },
          {
            icon: Zap,
            title: "Disposal Pool",
            desc: "Credit the disposal pool to participate in liquidation auctions. Bid on quality RWA tokens at below-market prices when positions fail.",
          },
          {
            icon: Globe,
            title: "HashKey Chain Native",
            desc: "Built on HashKey Chain — an EVM-compatible Layer 2 optimised for regulated digital assets and institutional DeFi.",
          },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="card-hover space-y-3">
            <div className="w-9 h-9 rounded-lg bg-brand-900/40 border border-brand-800/40 flex items-center justify-center">
              <Icon className="w-4.5 h-4.5 text-brand-400" />
            </div>
            <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
            <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
          </div>
        ))}
      </section>

      {/* Stats banner */}
      <section className="card border-brand-800/30 bg-brand-950/20">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            { label: "Supported RWA Types",  value: "3+" },
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
          <Link href="/admin" className="btn-secondary">
            Admin Dashboard
          </Link>
        </div>
      </section>
    </div>
  );
}
