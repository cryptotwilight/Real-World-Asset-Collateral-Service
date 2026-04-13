"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { formatEther, parseEther } from "viem";
import { Settings, AlertTriangle } from "lucide-react";
import { useProtocolConfig, useUpdateFees, useOracleValues, useUpdateOracleValues } from "@/hooks/useAdminController";
import { StatCard } from "@/components/ui/StatCard";
import { RWA_TOKENS, CONTRACT_ADDRESSES } from "@/lib/contracts";

export default function AdminPage() {
  const { isConnected } = useAccount();
  const { config, refetch } = useProtocolConfig();

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-24">
        <Settings className="w-12 h-12 text-brand-400" />
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-slate-200">Connect your wallet</h2>
          <p className="text-slate-500 text-sm">Admin dashboard requires a connected wallet.</p>
        </div>
        <ConnectButton />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Admin Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure protocol fees, collateral thresholds, and oracle values
        </p>
      </div>

      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-900/20 border border-amber-800/30 text-sm">
        <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
        <span className="text-amber-300">Admin functions are restricted to the contract owner. Transactions from non-owner accounts will revert.</span>
      </div>

      {/* Current config */}
      {config && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatCard label="Open Fee"           value={`${(config.openFeePercent / 100).toFixed(2)}%`} />
          <StatCard label="Close Fee"          value={`${(config.closeFeePercent / 100).toFixed(2)}%`} />
          <StatCard label="Collateral Thresh." value={`${(config.collateralThreshold / 100).toFixed(0)}%`} />
          <StatCard label="Liq. Threshold"     value={`${(config.liquidationThreshold / 100).toFixed(0)}%`} />
          <StatCard label="Auction Duration"   value={`${(config.auctionDuration / 3600).toFixed(0)}h`} />
        </div>
      )}

      {/* Fee settings form */}
      <FeeSettingsForm onSaved={refetch} />

      {/* Oracle settings */}
      {RWA_TOKENS.map((token) => (
        <OracleSettingsForm key={token.address} token={token} />
      ))}

      {/* Contract addresses */}
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-slate-200">Deployed Contract Addresses</h2>
        <div className="space-y-2 font-mono text-xs">
          {Object.entries(CONTRACT_ADDRESSES).map(([name, addr]) => (
            <div key={name} className="flex items-center gap-3">
              <span className="text-slate-400 w-40 shrink-0">{name}</span>
              <span className="text-slate-300 break-all">{addr}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Fee Settings Form ─────────────────────────────────────────────────────────
function FeeSettingsForm({ onSaved }: { onSaved: () => void }) {
  const { setOpenFee, setCloseFee, setCollateralThreshold, setLiquidationThreshold, isPending } = useUpdateFees();
  const [openFee,   setOpenFeeLocal]   = useState("");
  const [closeFee,  setCloseFeeLocal]  = useState("");
  const [collThresh, setCollThresh] = useState("");
  const [liqThresh,  setLiqThresh]  = useState("");
  const [saved, setSaved] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (openFee)   await setOpenFee(Math.round(parseFloat(openFee) * 100));
    if (closeFee)  await setCloseFee(Math.round(parseFloat(closeFee) * 100));
    if (collThresh) await setCollateralThreshold(Math.round(parseFloat(collThresh) * 100));
    if (liqThresh)  await setLiquidationThreshold(Math.round(parseFloat(liqThresh) * 100));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    onSaved();
  }

  return (
    <div className="card space-y-5">
      <h2 className="text-sm font-semibold text-slate-200">Fee & Threshold Configuration</h2>
      <form onSubmit={handleSave} className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Open Fee (%)</label>
          <input type="number" min="0" max="10" step="0.01" placeholder="e.g. 0.50" className="input" value={openFee} onChange={e => setOpenFeeLocal(e.target.value)} />
          <p className="text-[11px] text-slate-500 mt-1">Charged on borrow amount at position open (max 10%)</p>
        </div>
        <div>
          <label className="label">Close Fee (%)</label>
          <input type="number" min="0" max="10" step="0.01" placeholder="e.g. 0.50" className="input" value={closeFee} onChange={e => setCloseFeeLocal(e.target.value)} />
          <p className="text-[11px] text-slate-500 mt-1">Charged on repay amount at position close (max 10%)</p>
        </div>
        <div>
          <label className="label">Collateral Threshold (%)</label>
          <input type="number" min="100" step="1" placeholder="e.g. 150" className="input" value={collThresh} onChange={e => setCollThresh(e.target.value)} />
          <p className="text-[11px] text-slate-500 mt-1">Minimum ratio required to open a position</p>
        </div>
        <div>
          <label className="label">Liquidation Threshold (%)</label>
          <input type="number" min="100" step="1" placeholder="e.g. 110" className="input" value={liqThresh} onChange={e => setLiqThresh(e.target.value)} />
          <p className="text-[11px] text-slate-500 mt-1">Position liquidated if health drops below this</p>
        </div>
        <div className="sm:col-span-2 flex items-center gap-3">
          <button type="submit" disabled={isPending} className="btn-primary">
            {isPending ? "Saving…" : "Save Changes"}
          </button>
          {saved && <span className="text-xs text-emerald-400">Saved successfully</span>}
        </div>
      </form>
    </div>
  );
}

// ── Oracle Settings Form ──────────────────────────────────────────────────────
function OracleSettingsForm({ token }: { token: { address: string; symbol: string; name: string } }) {
  const { emissionsPerToken, npvPerToken } = useOracleValues(token.address as `0x${string}`);
  const { setEmissions, setNPV, isPending } = useUpdateOracleValues();
  const [emissions, setEmissionsLocal] = useState("");
  const [npv,       setNPVLocal]       = useState("");
  const [saved, setSaved] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (emissions) await setEmissions(token.address as `0x${string}`, parseEther(emissions));
    if (npv)       await setNPV(token.address as `0x${string}`, parseEther(npv));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="card space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-slate-200">Oracle Values – {token.symbol}</h2>
        <p className="text-xs text-slate-500 mt-0.5">{token.name} · {token.address}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="bg-surface rounded-lg p-3">
          <div className="text-slate-400">Current Emissions Value</div>
          <div className="font-mono font-semibold text-slate-100 mt-0.5">${formatEther(emissionsPerToken)} / token</div>
        </div>
        <div className="bg-surface rounded-lg p-3">
          <div className="text-slate-400">Current NPV</div>
          <div className="font-mono font-semibold text-slate-100 mt-0.5">${formatEther(npvPerToken)} / token</div>
        </div>
      </div>
      <form onSubmit={handleSave} className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Emissions Value (USD / token)</label>
          <input type="number" min="0" step="any" placeholder="e.g. 0.10" className="input" value={emissions} onChange={e => setEmissionsLocal(e.target.value)} />
          <p className="text-[11px] text-slate-500 mt-1">Present value of income stream entitlement per LST</p>
        </div>
        <div>
          <label className="label">NPV (USD / token)</label>
          <input type="number" min="0" step="any" placeholder="e.g. 1.00" className="input" value={npv} onChange={e => setNPVLocal(e.target.value)} />
          <p className="text-[11px] text-slate-500 mt-1">Net present value of the underlying RWA per LST</p>
        </div>
        <div className="sm:col-span-2 flex items-center gap-3">
          <button type="submit" disabled={isPending} className="btn-primary">
            {isPending ? "Updating…" : "Update Oracle Values"}
          </button>
          {saved && <span className="text-xs text-emerald-400">Updated</span>}
        </div>
      </form>
    </div>
  );
}
