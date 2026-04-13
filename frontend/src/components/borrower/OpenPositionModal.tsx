"use client";

import { useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { parseEther, parseUnits, formatEther, formatUnits } from "viem";
import { Modal } from "@/components/ui/Modal";
import { CONTRACT_ADDRESSES, COLLATERAL_VAULT_ABI, ERC20_ABI, VALUATION_ORACLE_ABI } from "@/lib/contracts";
import { RWA_TOKENS } from "@/lib/contracts";
import { AlertTriangle, Info } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function OpenPositionModal({ open, onClose, onSuccess }: Props) {
  const { address } = useAccount();
  const [selectedToken, setSelectedToken] = useState(RWA_TOKENS[0]?.address ?? "");
  const [lstAmount, setLstAmount] = useState("");
  const [borrowAmount, setBorrowAmount] = useState("");
  const [txError, setTxError] = useState("");

  const { writeContractAsync: approve, isPending: approvePending } = useWriteContract();
  const { writeContractAsync: openPos, isPending: openPending }    = useWriteContract();

  const lstAmountBig   = lstAmount    ? parseEther(lstAmount)       : 0n;
  const borrowAmountBig = borrowAmount ? parseUnits(borrowAmount, 6) : 0n;

  // LST balance
  const { data: lstBalance } = useReadContract({
    address: selectedToken as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [address ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!address && !!selectedToken },
  });

  // Valuation
  const { data: valData } = useReadContract({
    address: CONTRACT_ADDRESSES.RWAValuationOracle as `0x${string}`,
    abi: VALUATION_ORACLE_ABI,
    functionName: "getTokenValue",
    args: [selectedToken as `0x${string}`, lstAmountBig],
    query: { enabled: lstAmountBig > 0n },
  });
  const [totalValue, emissionsValue, npvValue] = (valData ?? [0n, 0n, 0n]) as [bigint, bigint, bigint];

  // Health factor preview
  const healthPreview = borrowAmountBig > 0n && totalValue > 0n
    ? Number((totalValue * 10000n) / (borrowAmountBig * (10n ** 12n))) // adjust for stablecoin 6dec vs 18dec value
    : null;

  const isHealthy = healthPreview !== null && healthPreview >= 15000;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTxError("");
    if (!selectedToken || !lstAmountBig || !borrowAmountBig) return;
    try {
      // 1. Approve vault to spend LST
      await approve({
        address: selectedToken as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [CONTRACT_ADDRESSES.CollateralVault as `0x${string}`, lstAmountBig],
      });
      // 2. Open position
      await openPos({
        address: CONTRACT_ADDRESSES.CollateralVault as `0x${string}`,
        abi: COLLATERAL_VAULT_ABI,
        functionName: "openPosition",
        args: [selectedToken as `0x${string}`, lstAmountBig, borrowAmountBig],
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setTxError(err instanceof Error ? err.message : String(err));
    }
  }

  const isPending = approvePending || openPending;

  return (
    <Modal open={open} onClose={onClose} title="Open Collateral Position">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Token select */}
        <div>
          <label className="label">RWA LST Token</label>
          <select
            className="input"
            value={selectedToken}
            onChange={(e) => setSelectedToken(e.target.value)}
          >
            {RWA_TOKENS.map((t) => (
              <option key={t.address} value={t.address}>{t.symbol} – {t.name}</option>
            ))}
          </select>
          {lstBalance !== undefined && (
            <p className="text-[11px] text-slate-500 mt-1">
              Balance: {formatEther(lstBalance as bigint)} {RWA_TOKENS.find(t => t.address === selectedToken)?.symbol}
            </p>
          )}
        </div>

        {/* LST amount */}
        <div>
          <label className="label">LST Amount to Lock</label>
          <input
            type="number" min="0" step="any" placeholder="0.0"
            className="input"
            value={lstAmount}
            onChange={(e) => setLstAmount(e.target.value)}
          />
          {totalValue > 0n && (
            <div className="mt-2 p-3 rounded-lg bg-surface border border-surface-border space-y-1 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Emissions value</span>
                <span className="font-mono">${formatEther(emissionsValue)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>NPV component</span>
                <span className="font-mono">${formatEther(npvValue)}</span>
              </div>
              <div className="flex justify-between text-slate-200 font-medium border-t border-surface-border pt-1">
                <span>Total collateral value</span>
                <span className="font-mono">${formatEther(totalValue)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Borrow amount */}
        <div>
          <label className="label">Borrow Amount (USDC)</label>
          <input
            type="number" min="0" step="any" placeholder="0.00"
            className="input"
            value={borrowAmount}
            onChange={(e) => setBorrowAmount(e.target.value)}
          />
          {totalValue > 0n && (
            <p className="text-[11px] text-slate-500 mt-1">
              Max borrow at 150% collateral: ~${formatEther(totalValue * 10000n / 15000n)} USDC
            </p>
          )}
        </div>

        {/* Health preview */}
        {healthPreview !== null && (
          <div className={`flex items-center gap-2 p-3 rounded-lg text-xs ${
            isHealthy
              ? "bg-emerald-900/20 border border-emerald-800/30 text-emerald-400"
              : "bg-red-900/20 border border-red-800/30 text-red-400"
          }`}>
            {isHealthy ? <Info className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            Health factor: {(healthPreview / 100).toFixed(1)}%
            {!isHealthy && " — below 150% minimum"}
          </div>
        )}

        {/* Fee info */}
        {borrowAmountBig > 0n && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-surface border border-surface-border text-xs text-slate-400">
            <Info className="w-4 h-4 shrink-0 text-brand-400" />
            Open fee (0.5%): ~${formatUnits(borrowAmountBig * 50n / 10000n, 6)} USDC will be retained by the pool.
          </div>
        )}

        {txError && (
          <p className="text-xs text-red-400 bg-red-900/20 p-3 rounded-lg border border-red-800/30">
            {txError}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending || !isHealthy || !lstAmountBig || !borrowAmountBig}
          className="btn-primary w-full justify-center"
        >
          {isPending ? "Confirming…" : "Open Position"}
        </button>
      </form>
    </Modal>
  );
}
