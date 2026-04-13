"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Plus, Vault, AlertTriangle } from "lucide-react";
import { useReadContract } from "wagmi";
import { PositionCard } from "@/components/borrower/PositionCard";
import { OpenPositionModal } from "@/components/borrower/OpenPositionModal";
import { StatCard } from "@/components/ui/StatCard";
import { CONTRACT_ADDRESSES, COLLATERAL_VAULT_ABI } from "@/lib/contracts";
import { formatUnits } from "viem";

export default function BorrowerPage() {
  const { address, isConnected } = useAccount();
  const [openModal, setOpenModal] = useState(false);
  const [refresh, setRefresh] = useState(0);

  const { data: positionIds, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.CollateralVault as `0x${string}`,
    abi: COLLATERAL_VAULT_ABI,
    functionName: "getBorrowerPositions",
    args: [address ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!address },
  });

  const ids = (positionIds ?? []) as bigint[];

  function handleRefresh() {
    refetch();
    setRefresh(r => r + 1);
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-24">
        <Vault className="w-12 h-12 text-brand-400" />
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-slate-200">Connect your wallet</h2>
          <p className="text-slate-500 text-sm">Connect to view and manage your collateral positions.</p>
        </div>
        <ConnectButton />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Borrower Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your RWA collateral positions on HashKey Chain</p>
        </div>
        <button onClick={() => setOpenModal(true)} className="btn-primary">
          <Plus className="w-4 h-4" />
          Open Position
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Active Positions"
          value={String(ids.length)}
          icon={Vault}
        />
        <StatCard
          label="Collateral Threshold"
          value="150%"
          sub="Minimum to open"
        />
        <StatCard
          label="Liquidation Threshold"
          value="110%"
          sub="Position liquidated below this"
        />
        <StatCard
          label="Borrow Fee"
          value="0.5%"
          sub="One-time on open & close"
        />
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-brand-950/30 border border-brand-800/30 text-sm">
        <AlertTriangle className="w-4 h-4 text-brand-400 mt-0.5 shrink-0" />
        <div className="text-slate-400">
          <strong className="text-slate-200">How it works:</strong> Lock your RWA LST tokens as collateral to borrow USDC.
          Your position is valued using dual oracles (emissions entitlement + NPV).
          Maintain a health factor above 110% to avoid liquidation.
          Use <strong className="text-slate-200">Top Up</strong> to add collateral or{" "}
          <strong className="text-slate-200">Harvest</strong> to withdraw surplus when the market moves in your favour.
        </div>
      </div>

      {/* Positions */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-slate-200">
          Your Positions {ids.length > 0 && <span className="text-slate-500 font-normal">({ids.length})</span>}
        </h2>

        {ids.length === 0 ? (
          <div className="card text-center py-16 space-y-4">
            <Vault className="w-10 h-10 text-slate-600 mx-auto" />
            <div>
              <p className="text-slate-400 font-medium">No positions yet</p>
              <p className="text-slate-600 text-sm mt-1">Open your first position to start borrowing against your RWAs.</p>
            </div>
            <button onClick={() => setOpenModal(true)} className="btn-primary mx-auto">
              <Plus className="w-4 h-4" />
              Open First Position
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {ids.map((id) => (
              <PositionCard key={id.toString()} positionId={id} onRefresh={handleRefresh} />
            ))}
          </div>
        )}
      </div>

      <OpenPositionModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        onSuccess={handleRefresh}
      />
    </div>
  );
}
