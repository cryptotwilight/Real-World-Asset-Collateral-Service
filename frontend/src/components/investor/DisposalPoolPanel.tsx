"use client";

import { useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { useAccount, useWriteContract } from "wagmi";
import {
  useDisposalStats, useAuction, useInvestorDisposalBalance,
  useCreditFunds, useWithdrawDisposalFunds, usePlaceBid, useFinalizeAuction
} from "@/hooks/useDisposalContract";
import { StatCard } from "@/components/ui/StatCard";
import { Modal } from "@/components/ui/Modal";
import { CONTRACT_ADDRESSES, ERC20_ABI } from "@/lib/contracts";
import { RWA_TOKENS } from "@/lib/contracts";
import { Gavel, Clock, ChevronRight, DollarSign } from "lucide-react";

export function DisposalPoolPanel() {
  const { address } = useAccount();
  const stats = useDisposalStats();
  const position = useInvestorDisposalBalance();
  const [creditOpen,   setCreditOpen]   = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [bidAuction,   setBidAuction]   = useState<bigint | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-200">Disposal Pool</h2>
          <p className="text-xs text-slate-500 mt-0.5">Bid on liquidated RWA LSTs using pre-credited funds</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setCreditOpen(true)}   className="btn-primary text-xs">Credit Funds</button>
          <button onClick={() => setWithdrawOpen(true)} className="btn-secondary text-xs">Withdraw</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Active Auctions"   value={String(stats.activeAuctionCount)} icon={Gavel} />
        <StatCard label="Total Auctions"    value={String(stats.auctionCount)}        icon={Clock} />
        {address && (
          <StatCard label="Your Free Balance" value={`$${formatUnits(position.free, 6)}`} icon={DollarSign} />
        )}
      </div>

      {/* Your credited position */}
      {address && (
        <div className="card border-brand-800/30 space-y-3">
          <h3 className="text-sm font-medium text-slate-300">Your Disposal Position</h3>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-xs text-slate-400">Total Credited</div>
              <div className="font-mono font-semibold text-slate-100 mt-0.5">${formatUnits(position.credited, 6)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Locked in Bids</div>
              <div className="font-mono font-semibold text-amber-400 mt-0.5">${formatUnits(position.locked, 6)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Free Balance</div>
              <div className="font-mono font-semibold text-emerald-400 mt-0.5">${formatUnits(position.free, 6)}</div>
            </div>
          </div>
          {position.bidAuctions.length > 0 && (
            <p className="text-xs text-slate-500">Active bids in auctions: {position.bidAuctions.map(a => `#${Number(a)}`).join(", ")}</p>
          )}
        </div>
      )}

      {/* Active Auctions */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-200">Active Auctions</h3>
        {stats.activeAuctions.length === 0 ? (
          <div className="card text-center py-10">
            <Gavel className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No active auctions</p>
            <p className="text-slate-600 text-xs mt-1">Auctions appear when positions are liquidated.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {stats.activeAuctions.map((id) => (
              <AuctionRow key={id.toString()} auctionId={id} onBid={() => setBidAuction(id)} />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <CreditModal     open={creditOpen}         onClose={() => setCreditOpen(false)} />
      <WithdrawModal   open={withdrawOpen}        onClose={() => setWithdrawOpen(false)} freeBalance={position.free} />
      {bidAuction !== null && (
        <BidModal auctionId={bidAuction} freeBalance={position.free} onClose={() => setBidAuction(null)} />
      )}
    </div>
  );
}

// ── Auction Row ───────────────────────────────────────────────────────────────
function AuctionRow({ auctionId, onBid }: { auctionId: bigint; onBid: () => void }) {
  const { auction } = useAuction(auctionId);
  const { finalizeAuction, isPending } = useFinalizeAuction();

  if (!auction) return <div className="card h-16 animate-pulse" />;

  const a = auction as {
    lstToken: string; lstAmount: bigint; minBid: bigint; highestBid: bigint;
    highestBidder: string; endTime: bigint; finalized: boolean;
  };

  const tokenInfo = RWA_TOKENS.find(t => t.address.toLowerCase() === a.lstToken.toLowerCase());
  const endDate = new Date(Number(a.endTime) * 1000);
  const isEnded = Date.now() > Number(a.endTime) * 1000;

  return (
    <div className="card-hover flex items-center gap-4">
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-200">Auction #{Number(auctionId)}</span>
          <span className="badge-warning text-[10px]">{isEnded ? "Ended" : "Active"}</span>
        </div>
        <div className="text-xs text-slate-400">
          {formatUnits(a.lstAmount, 18)} {tokenInfo?.symbol ?? "LST"} · Min bid: ${formatUnits(a.minBid, 6)} ·
          Highest: ${formatUnits(a.highestBid, 6)}
        </div>
        <div className="flex items-center gap-1 text-[11px] text-slate-500">
          <Clock className="w-3 h-3" />
          {isEnded ? "Ended" : `Ends ${endDate.toLocaleString()}`}
        </div>
      </div>
      <div className="flex gap-2">
        {isEnded ? (
          <button
            onClick={() => finalizeAuction(auctionId)}
            disabled={isPending}
            className="btn-secondary text-xs"
          >
            {isPending ? "…" : "Finalize"}
          </button>
        ) : (
          <button onClick={onBid} className="btn-primary text-xs gap-1">
            <Gavel className="w-3.5 h-3.5" /> Bid
          </button>
        )}
      </div>
    </div>
  );
}

// ── Modals ────────────────────────────────────────────────────────────────────

function CreditModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const { writeContractAsync: approve, isPending: ap } = useWriteContract();
  const { creditFunds, isPending: cp } = useCreditFunds();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amtBig = parseUnits(amount || "0", 6);
    if (!amtBig) return;
    await approve({ address: CONTRACT_ADDRESSES.MockStablecoin as `0x${string}`, abi: ERC20_ABI, functionName: "approve", args: [CONTRACT_ADDRESSES.DisposalContract as `0x${string}`, amtBig] });
    await creditFunds(amtBig);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Credit Disposal Pool" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-slate-400">Credited funds are locked until you win an auction or there are no active auctions.</p>
        <div>
          <label className="label">USDC to Credit</label>
          <input type="number" min="0" step="any" placeholder="0.00" className="input" value={amount} onChange={e => setAmount(e.target.value)} />
        </div>
        <button type="submit" disabled={ap || cp || !amount} className="btn-primary w-full justify-center">
          {ap || cp ? "Confirming…" : "Credit Funds"}
        </button>
      </form>
    </Modal>
  );
}

function WithdrawModal({ open, onClose, freeBalance }: { open: boolean; onClose: () => void; freeBalance: bigint }) {
  const [amount, setAmount] = useState("");
  const { withdrawFunds, isPending } = useWithdrawDisposalFunds();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amtBig = parseUnits(amount || "0", 6);
    if (!amtBig) return;
    await withdrawFunds(amtBig);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Withdraw Disposal Funds" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-slate-400">You can only withdraw free (un-locked) balance when you have no active bids or when there are no active auctions.</p>
        <div>
          <label className="label">USDC to Withdraw</label>
          <input type="number" min="0" step="any" placeholder="0.00" className="input" value={amount} onChange={e => setAmount(e.target.value)} />
          <p className="text-[11px] text-slate-500 mt-1">Free balance: ${formatUnits(freeBalance, 6)}</p>
        </div>
        <button type="submit" disabled={isPending || !amount} className="btn-primary w-full justify-center">
          {isPending ? "Confirming…" : "Withdraw"}
        </button>
      </form>
    </Modal>
  );
}

function BidModal({ auctionId, freeBalance, onClose }: { auctionId: bigint; freeBalance: bigint; onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const { auction } = useAuction(auctionId);
  const { placeBid, isPending } = usePlaceBid();

  const a = auction as { highestBid: bigint; minBid: bigint } | undefined;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amtBig = parseUnits(amount || "0", 6);
    await placeBid(auctionId, amtBig);
    onClose();
  }

  return (
    <Modal open={true} onClose={onClose} title={`Place Bid – Auction #${Number(auctionId)}`} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="card text-sm space-y-1">
          <div className="flex justify-between"><span className="text-slate-400">Min bid</span><span className="font-mono">${formatUnits(a?.minBid ?? 0n, 6)}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Current highest</span><span className="font-mono">${formatUnits(a?.highestBid ?? 0n, 6)}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Your free balance</span><span className="font-mono">${formatUnits(freeBalance, 6)}</span></div>
        </div>
        <div>
          <label className="label">Your Bid (USDC)</label>
          <input type="number" min="0" step="any" placeholder="0.00" className="input" value={amount} onChange={e => setAmount(e.target.value)} />
        </div>
        <button type="submit" disabled={isPending || !amount} className="btn-primary w-full justify-center">
          {isPending ? "Confirming…" : <><Gavel className="w-4 h-4" /> Place Bid</>}
        </button>
      </form>
    </Modal>
  );
}
