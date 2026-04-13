"use client";

import { useReadContract, useWriteContract, useAccount } from "wagmi";
import { CONTRACT_ADDRESSES, STABLECOIN_POOL_ABI } from "@/lib/contracts";

const POOL = CONTRACT_ADDRESSES.StablecoinPool as `0x${string}`;

export function usePoolStats() {
  const { data: totalAssets }         = useReadContract({ address: POOL, abi: STABLECOIN_POOL_ABI, functionName: "totalAssets" });
  const { data: totalShares }         = useReadContract({ address: POOL, abi: STABLECOIN_POOL_ABI, functionName: "totalShares" });
  const { data: totalBorrowed }       = useReadContract({ address: POOL, abi: STABLECOIN_POOL_ABI, functionName: "totalBorrowed" });
  const { data: totalFeesCollected }  = useReadContract({ address: POOL, abi: STABLECOIN_POOL_ABI, functionName: "totalFeesCollected" });
  const { data: utilisation }         = useReadContract({ address: POOL, abi: STABLECOIN_POOL_ABI, functionName: "utilisation" });
  const { data: availableLiquidity }  = useReadContract({ address: POOL, abi: STABLECOIN_POOL_ABI, functionName: "availableLiquidity" });
  const { data: sharePrice }          = useReadContract({ address: POOL, abi: STABLECOIN_POOL_ABI, functionName: "sharePrice" });

  return {
    totalAssets:        (totalAssets        ?? 0n) as bigint,
    totalShares:        (totalShares        ?? 0n) as bigint,
    totalBorrowed:      (totalBorrowed      ?? 0n) as bigint,
    totalFeesCollected: (totalFeesCollected ?? 0n) as bigint,
    utilisation:        Number(utilisation  ?? 0n),
    availableLiquidity: (availableLiquidity ?? 0n) as bigint,
    sharePrice:         (sharePrice         ?? 0n) as bigint,
  };
}

export function useInvestorPoolBalance() {
  const { address } = useAccount();

  const { data: shares } = useReadContract({
    address: POOL,
    abi: STABLECOIN_POOL_ABI,
    functionName: "shares",
    args: [address ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!address },
  });

  const { data: investorBalance } = useReadContract({
    address: POOL,
    abi: STABLECOIN_POOL_ABI,
    functionName: "investorBalance",
    args: [address ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!address },
  });

  return {
    shares:   (shares          ?? 0n) as bigint,
    balanceUSD: (investorBalance ?? 0n) as bigint,
  };
}

export function useDepositToPool() {
  const { writeContractAsync, isPending } = useWriteContract();
  const deposit = async (amount: bigint) =>
    writeContractAsync({ address: POOL, abi: STABLECOIN_POOL_ABI, functionName: "deposit", args: [amount] });
  return { deposit, isPending };
}

export function useWithdrawFromPool() {
  const { writeContractAsync, isPending } = useWriteContract();
  const withdraw = async (shares: bigint) =>
    writeContractAsync({ address: POOL, abi: STABLECOIN_POOL_ABI, functionName: "withdraw", args: [shares] });
  return { withdraw, isPending };
}
