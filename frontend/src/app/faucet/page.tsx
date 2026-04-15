"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { formatUnits } from "viem";
import { Droplet, Clock, Check, AlertTriangle } from "lucide-react";
import { CONTRACT_ADDRESSES, RWA_TOKENS } from "@/lib/contracts";
import { useFaucetCooldown, useFaucetMint } from "@/hooks/useFaucet";
import { useToken } from "@/hooks/useToken";

interface FaucetTokenRow {
  address: string;
  symbol: string;
  name: string;
}

const ALL_FAUCET_TOKENS: FaucetTokenRow[] = [
  { address: CONTRACT_ADDRESSES.MockStablecoin, symbol: "mUSDC", name: "Mock USDC Stablecoin" },
  ...RWA_TOKENS.map(t => ({ address: t.address, symbol: t.symbol, name: t.name })),
];

export default function FaucetPage() {
  const { isConnected } = useAccount();
  const { mintAll, isPending: mintAllPending } = useFaucetMint();
  const [txError, setTxError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleMintAll() {
    setTxError("");
    try {
      await mintAll();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (e: unknown) {
      setTxError(e instanceof Error ? e.message : String(e));
    }
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-24">
        <Droplet className="w-12 h-12 text-brand-400" />
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-slate-200">Connect your wallet</h2>
          <p className="text-slate-500 text-sm">The testnet faucet requires a connected wallet.</p>
        </div>
        <ConnectButton />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Testnet Faucet</h1>
        <p className="text-sm text-slate-500 mt-1">
          Mint 100 tokens of any supported asset — mUSDC stablecoin and all RWA LSTs.
          One mint per token per hour, per wallet.
        </p>
      </div>

      {/* Mint all */}
      <div className="card space-y-4 border-brand-800/40 bg-brand-950/20">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Mint all supported tokens</h2>
            <p className="text-xs text-slate-400 mt-1">
              Get 100 of every token in one transaction. Tokens on cooldown are skipped silently.
            </p>
          </div>
          <button
            onClick={handleMintAll}
            disabled={mintAllPending}
            className="btn-primary whitespace-nowrap"
          >
            {mintAllPending ? "Minting…" : "Mint All"}
          </button>
        </div>
        {success && (
          <div className="flex items-center gap-2 text-xs text-emerald-400">
            <Check className="w-4 h-4" /> Mint transaction confirmed.
          </div>
        )}
        {txError && (
          <div className="flex items-start gap-2 text-xs text-red-400">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span className="break-all">{txError}</span>
          </div>
        )}
      </div>

      {/* Per-token */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {ALL_FAUCET_TOKENS.map((t) => (
          <FaucetTokenCard key={t.address} token={t} />
        ))}
      </div>
    </div>
  );
}

function formatCountdown(seconds: number) {
  if (seconds <= 0) return "ready";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function FaucetTokenCard({ token }: { token: FaucetTokenRow }) {
  const addr = token.address as `0x${string}`;
  const { balance, decimals } = useToken(addr);
  const { canMint, secondsUntilAvailable, refetchCanMint } = useFaucetCooldown(addr);
  const { mint, isPending } = useFaucetMint();
  const [err, setErr] = useState("");

  async function handleMint() {
    setErr("");
    try {
      await mint(addr);
      refetchCanMint();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-semibold text-slate-100">{token.symbol}</div>
          <div className="text-xs text-slate-500 mt-0.5">{token.name}</div>
        </div>
        <Droplet className="w-4 h-4 text-brand-400" />
      </div>

      <div className="text-xs space-y-1">
        <div className="flex justify-between">
          <span className="text-slate-400">Balance</span>
          <span className="font-mono text-slate-200">
            {Number(formatUnits(balance, decimals)).toLocaleString(undefined, { maximumFractionDigits: 4 })}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Status</span>
          {canMint ? (
            <span className="text-emerald-400 flex items-center gap-1">
              <Check className="w-3 h-3" /> Ready
            </span>
          ) : (
            <span className="text-amber-400 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {formatCountdown(secondsUntilAvailable)}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={handleMint}
        disabled={isPending || !canMint}
        className="btn-secondary w-full justify-center text-xs"
      >
        {isPending ? "Minting…" : `Mint 100 ${token.symbol}`}
      </button>

      {err && (
        <p className="text-[10px] text-red-400 break-all">{err}</p>
      )}
    </div>
  );
}
