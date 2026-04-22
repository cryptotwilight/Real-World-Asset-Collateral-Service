"use client";

import { useState } from "react";
import { formatEther, formatUnits, parseEther, parseUnits } from "viem";
import { useWriteContract, useReadContract } from "wagmi";
import { HealthBar } from "@/components/ui/HealthBar";
import { Modal } from "@/components/ui/Modal";
import { CONTRACT_ADDRESSES, COLLATERAL_VAULT_ABI, ERC20_ABI } from "@/lib/contracts";
import { RWA_TOKENS } from "@/lib/contracts";
import { TrendingUp, Plus, X, Clock } from "lucide-react";
import { clsx } from "clsx";

interface RawPosition {
  borrower: string;
  lstToken: string;
  lstAmount: bigint;
  loanAmount: bigint;
  openFee: bigint;
  openTimestamp: bigint;
  status: number;
}

interface Props {
  positionId: bigint;
  onRefresh: () => void;
}

const STATUS_LABELS = ["Active", "Closed", "Liquidated"] as const;

export function PositionCard({ positionId, onRefresh }: Props) {
  const [topUpOpen,   setTopUpOpen]   = useState(false);
  const [harvestOpen, setHarvestOpen] = useState(false);
  const [closeOpen,   setCloseOpen]   = useState(false);

  const { data: pos } = useReadContract({
    address: CONTRACT_ADDRESSES.CollateralVault as `0x${string}`,
    abi: COLLATERAL_VAULT_ABI,
    functionName: "getPosition",
    args: [positionId],
  });
  const position = pos as RawPosition | undefined;

  const { data: hf } = useReadContract({
    address: CONTRACT_ADDRESSES.CollateralVault as `0x${string}`,
    abi: COLLATERAL_VAULT_ABI,
    functionName: "healthFactor",
    args: [positionId],
  });
  const healthFactor = hf ? Number(hf) / 1e12 : 0;

  if (!position) return (
    <div className="card animate-pulse h-32" />
  );

  const tokenInfo = RWA_TOKENS.find(t => t.address.toLowerCase() === position.lstToken.toLowerCase());
  const statusLabel = STATUS_LABELS[position.status] ?? "Unknown";
  const openedAt = new Date(Number(position.openTimestamp) * 1000).toLocaleDateString();

  return (
    <>
      <div className={clsx(
        "card space-y-4",
        position.status === 0 && "border-surface-border",
        position.status === 1 && "opacity-60",
        position.status === 2 && "border-red-800/40 bg-red-950/10"
      )}>
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-100">
                Position #{Number(positionId)}
              </span>
              <span className={clsx(
                "text-xs px-2 py-0.5 rounded-full font-medium",
                position.status === 0 && "badge-healthy",
                position.status === 1 && "badge-info",
                position.status === 2 && "badge-danger"
              )}>
                {statusLabel}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
              <Clock className="w-3 h-3" />
              Opened {openedAt}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">Collateral Token</div>
            <div className="text-sm font-medium text-slate-200">{tokenInfo?.symbol ?? position.lstToken.slice(0, 8)}</div>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface rounded-lg p-3">
            <div className="text-xs text-slate-400">LST Locked</div>
            <div className="text-sm font-mono font-medium text-slate-200 mt-0.5">
              {formatEther(position.lstAmount)} {tokenInfo?.symbol}
            </div>
          </div>
          <div className="bg-surface rounded-lg p-3">
            <div className="text-xs text-slate-400">Outstanding Loan</div>
            <div className="text-sm font-mono font-medium text-slate-200 mt-0.5">
              ${formatUnits(position.loanAmount, 6)} USDC
            </div>
          </div>
        </div>

        {/* Health bar – active positions only */}
        {position.status === 0 && (
          <HealthBar healthFactor={healthFactor} />
        )}

        {/* Actions – active positions only */}
        {position.status === 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            <button onClick={() => setTopUpOpen(true)} className="btn-secondary text-xs gap-1">
              <Plus className="w-3.5 h-3.5" /> Top Up
            </button>
            <button onClick={() => setHarvestOpen(true)} className="btn-secondary text-xs gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> Harvest
            </button>
            <button onClick={() => setCloseOpen(true)} className="btn-danger text-xs gap-1">
              <X className="w-3.5 h-3.5" /> Close
            </button>
          </div>
        )}
      </div>

      {/* Top-up modal */}
      <TopUpModal open={topUpOpen} onClose={() => setTopUpOpen(false)} positionId={positionId} lstToken={position.lstToken} lstSymbol={tokenInfo?.symbol ?? "LST"} onSuccess={onRefresh} />

      {/* Harvest modal */}
      <HarvestModal open={harvestOpen} onClose={() => setHarvestOpen(false)} positionId={positionId} lstSymbol={tokenInfo?.symbol ?? "LST"} onSuccess={onRefresh} />

      {/* Close modal */}
      <CloseModal open={closeOpen} onClose={() => setCloseOpen(false)} positionId={positionId} loanAmount={position.loanAmount} onSuccess={onRefresh} />
    </>
  );
}

// ── Top-up Modal ──────────────────────────────────────────────────────────────
function TopUpModal({ open, onClose, positionId, lstToken, lstSymbol, onSuccess }: {
  open: boolean; onClose: () => void; positionId: bigint;
  lstToken: string; lstSymbol: string; onSuccess: () => void;
}) {
  const [amount, setAmount] = useState("");
  const { writeContractAsync: approve, isPending: ap } = useWriteContract();
  const { writeContractAsync: topUp,   isPending: tp } = useWriteContract();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amtBig = parseEther(amount || "0");
    if (!amtBig) return;
    await approve({ address: lstToken as `0x${string}`, abi: ERC20_ABI, functionName: "approve", args: [CONTRACT_ADDRESSES.CollateralVault as `0x${string}`, amtBig] });
    await topUp({ address: CONTRACT_ADDRESSES.CollateralVault as `0x${string}`, abi: COLLATERAL_VAULT_ABI, functionName: "topUpPosition", args: [positionId, amtBig] });
    onSuccess(); onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Top Up Collateral" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Additional {lstSymbol} to Lock</label>
          <input type="number" min="0" step="any" placeholder="0.0" className="input" value={amount} onChange={e => setAmount(e.target.value)} />
        </div>
        <button type="submit" disabled={ap || tp || !amount} className="btn-primary w-full justify-center">
          {ap || tp ? "Confirming…" : "Confirm Top Up"}
        </button>
      </form>
    </Modal>
  );
}

// ── Harvest Modal ─────────────────────────────────────────────────────────────
function HarvestModal({ open, onClose, positionId, lstSymbol, onSuccess }: {
  open: boolean; onClose: () => void; positionId: bigint;
  lstSymbol: string; onSuccess: () => void;
}) {
  const [lstWithdraw, setLstWithdraw]   = useState("");
  const [addBorrow, setAddBorrow] = useState("");
  const { writeContractAsync, isPending } = useWriteContract();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const lstBig  = lstWithdraw ? parseEther(lstWithdraw) : 0n;
    const borrBig = addBorrow   ? parseUnits(addBorrow, 6) : 0n;
    await writeContractAsync({
      address: CONTRACT_ADDRESSES.CollateralVault as `0x${string}`,
      abi: COLLATERAL_VAULT_ABI,
      functionName: "harvestPosition",
      args: [positionId, lstBig, borrBig],
    });
    onSuccess(); onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Harvest Position" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-slate-400">Withdraw excess collateral and/or borrow more, while staying above the 150% threshold.</p>
        <div>
          <label className="label">{lstSymbol} to Withdraw (optional)</label>
          <input type="number" min="0" step="any" placeholder="0.0" className="input" value={lstWithdraw} onChange={e => setLstWithdraw(e.target.value)} />
        </div>
        <div>
          <label className="label">Additional USDC to Borrow (optional)</label>
          <input type="number" min="0" step="any" placeholder="0.00" className="input" value={addBorrow} onChange={e => setAddBorrow(e.target.value)} />
        </div>
        <button type="submit" disabled={isPending || (!lstWithdraw && !addBorrow)} className="btn-primary w-full justify-center">
          {isPending ? "Confirming…" : "Harvest"}
        </button>
      </form>
    </Modal>
  );
}

// ── Close Modal ───────────────────────────────────────────────────────────────
function CloseModal({ open, onClose, positionId, loanAmount, onSuccess }: {
  open: boolean; onClose: () => void; positionId: bigint;
  loanAmount: bigint; onSuccess: () => void;
}) {
  const closeFee  = loanAmount * 50n / 10000n;
  const totalRepay = loanAmount + closeFee;

  const { writeContractAsync: approve, isPending: ap } = useWriteContract();
  const { writeContractAsync: close,   isPending: cp } = useWriteContract();

  async function handleClose() {
    await approve({
      address: CONTRACT_ADDRESSES.MockStablecoin as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [CONTRACT_ADDRESSES.CollateralVault as `0x${string}`, totalRepay],
    });
    await close({
      address: CONTRACT_ADDRESSES.CollateralVault as `0x${string}`,
      abi: COLLATERAL_VAULT_ABI,
      functionName: "closePosition",
      args: [positionId],
    });
    onSuccess(); onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Close Position" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-slate-300">You will repay the outstanding loan plus a 0.5% close fee.</p>
        <div className="card space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-slate-400">Loan</span><span className="font-mono">${formatUnits(loanAmount, 6)}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Close fee (0.5%)</span><span className="font-mono">${formatUnits(closeFee, 6)}</span></div>
          <div className="flex justify-between font-semibold border-t border-surface-border pt-2"><span>Total to repay</span><span className="font-mono text-brand-400">${formatUnits(totalRepay, 6)} USDC</span></div>
        </div>
        <button onClick={handleClose} disabled={ap || cp} className="btn-danger w-full justify-center">
          {ap || cp ? "Confirming…" : "Repay & Close"}
        </button>
      </div>
    </Modal>
  );
}
