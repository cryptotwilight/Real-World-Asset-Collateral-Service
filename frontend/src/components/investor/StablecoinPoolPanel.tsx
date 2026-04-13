"use client";

import { useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { useAccount, useWriteContract } from "wagmi";
import { usePoolStats, useInvestorPoolBalance, useDepositToPool, useWithdrawFromPool } from "@/hooks/useStablecoinPool";
import { StatCard } from "@/components/ui/StatCard";
import { Modal } from "@/components/ui/Modal";
import { CONTRACT_ADDRESSES, ERC20_ABI, STABLECOIN_POOL_ABI } from "@/lib/contracts";
import { BarChart2, TrendingUp, DollarSign, Droplets } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

// Mock historical data for the chart (replace with indexed events in production)
const mockHistory = Array.from({ length: 30 }, (_, i) => ({
  day: `D-${30 - i}`,
  tvl: 900000 + Math.random() * 200000,
  fees: 200 + Math.random() * 300,
}));

export function StablecoinPoolPanel() {
  const { address } = useAccount();
  const stats = usePoolStats();
  const position = useInvestorPoolBalance();
  const [depositOpen,  setDepositOpen]  = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const utilisationPct = (stats.utilisation / 100).toFixed(1);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-200">Stablecoin Liquidity Pool</h2>
          <p className="text-xs text-slate-500 mt-0.5">Earn pro-rata fees from every borrow open and close</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setDepositOpen(true)}  className="btn-primary text-xs">Deposit</button>
          <button onClick={() => setWithdrawOpen(true)} className="btn-secondary text-xs">Withdraw</button>
        </div>
      </div>

      {/* Protocol stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="TVL"               value={`$${formatUnits(stats.totalAssets, 6)}`}        icon={DollarSign} />
        <StatCard label="Total Borrowed"    value={`$${formatUnits(stats.totalBorrowed, 6)}`}      icon={TrendingUp} />
        <StatCard label="Utilisation"       value={`${utilisationPct}%`}                            icon={BarChart2} />
        <StatCard label="Fees Collected"    value={`$${formatUnits(stats.totalFeesCollected, 6)}`} icon={Droplets} />
      </div>

      {/* Your position */}
      {address && (
        <div className="card border-brand-800/30 space-y-3">
          <h3 className="text-sm font-medium text-slate-300">Your Pool Position</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-slate-400">Deposited Value</div>
              <div className="text-lg font-bold font-mono text-slate-100 mt-0.5">
                ${formatUnits(position.balanceUSD, 6)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Pool Shares</div>
              <div className="text-lg font-bold font-mono text-slate-100 mt-0.5">
                {formatUnits(position.shares, 18)}
              </div>
            </div>
          </div>
          <div className="text-xs text-slate-500">
            Share price: ${formatUnits(stats.sharePrice, 18)} USDC
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="card space-y-3">
        <h3 className="text-sm font-medium text-slate-300">Pool TVL History (30d)</h3>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={mockHistory}>
            <defs>
              <linearGradient id="tvlGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#4a5cff" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#4a5cff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#252a3a" />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} interval={9} />
            <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ background: "#171b26", border: "1px solid #252a3a", borderRadius: "8px", fontSize: 12 }}
              labelStyle={{ color: "#94a3b8" }}
              itemStyle={{ color: "#7088ff" }}
              formatter={(v: number) => [`$${v.toFixed(0)}`, "TVL"]}
            />
            <Area type="monotone" dataKey="tvl" stroke="#4a5cff" fill="url(#tvlGrad)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Modals */}
      <DepositModal  open={depositOpen}  onClose={() => setDepositOpen(false)}  />
      <WithdrawModal open={withdrawOpen} onClose={() => setWithdrawOpen(false)} shares={position.shares} />
    </div>
  );
}

function DepositModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const { writeContractAsync: approve, isPending: ap } = useWriteContract();
  const { deposit, isPending: dp } = useDepositToPool();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amtBig = parseUnits(amount || "0", 6);
    if (!amtBig) return;
    await approve({ address: CONTRACT_ADDRESSES.MockStablecoin as `0x${string}`, abi: ERC20_ABI, functionName: "approve", args: [CONTRACT_ADDRESSES.StablecoinPool as `0x${string}`, amtBig] });
    await deposit(amtBig);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Deposit to Pool" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">USDC Amount</label>
          <input type="number" min="0" step="any" placeholder="0.00" className="input" value={amount} onChange={e => setAmount(e.target.value)} />
        </div>
        <p className="text-xs text-slate-500">You will receive pool shares proportional to your deposit. Shares appreciate as fees accrue.</p>
        <button type="submit" disabled={ap || dp || !amount} className="btn-primary w-full justify-center">
          {ap || dp ? "Confirming…" : "Deposit"}
        </button>
      </form>
    </Modal>
  );
}

function WithdrawModal({ open, onClose, shares }: { open: boolean; onClose: () => void; shares: bigint }) {
  const [amount, setAmount] = useState("");
  const { withdraw, isPending } = useWithdrawFromPool();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const sharesBig = parseUnits(amount || "0", 18);
    if (!sharesBig) return;
    await withdraw(sharesBig);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Withdraw from Pool" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Shares to Redeem</label>
          <input type="number" min="0" step="any" placeholder="0.0" className="input" value={amount} onChange={e => setAmount(e.target.value)} />
          <p className="text-[11px] text-slate-500 mt-1">Your shares: {formatUnits(shares, 18)}</p>
        </div>
        <button type="submit" disabled={isPending || !amount} className="btn-primary w-full justify-center">
          {isPending ? "Confirming…" : "Withdraw"}
        </button>
      </form>
    </Modal>
  );
}
