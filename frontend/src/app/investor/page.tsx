"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { BarChart2 } from "lucide-react";
import { StablecoinPoolPanel } from "@/components/investor/StablecoinPoolPanel";
import { DisposalPoolPanel } from "@/components/investor/DisposalPoolPanel";
import { clsx } from "clsx";

type Tab = "pool" | "disposal";

export default function InvestorPage() {
  const { isConnected } = useAccount();
  const [tab, setTab] = useState<Tab>("pool");

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-24">
        <BarChart2 className="w-12 h-12 text-brand-400" />
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-slate-200">Connect your wallet</h2>
          <p className="text-slate-500 text-sm">Connect to access the investor dashboard.</p>
        </div>
        <ConnectButton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Investor Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          Provide liquidity to the stablecoin pool or bid on liquidated RWA LSTs in the disposal pool
        </p>
      </div>

      {/* Tab selector */}
      <div className="flex items-end gap-6 border-b border-surface-border">
        <button
          className={clsx("text-sm font-medium", tab === "pool" ? "tab-active" : "tab-inactive")}
          onClick={() => setTab("pool")}
        >
          Stablecoin Pool
        </button>
        <button
          className={clsx("text-sm font-medium", tab === "disposal" ? "tab-active" : "tab-inactive")}
          onClick={() => setTab("disposal")}
        >
          Disposal Pool
        </button>
      </div>

      {/* Panel */}
      {tab === "pool"     && <StablecoinPoolPanel />}
      {tab === "disposal" && <DisposalPoolPanel />}
    </div>
  );
}
