"use client";

import { useReadContract, useWriteContract, useAccount } from "wagmi";
import { CONTRACT_ADDRESSES, DISPOSAL_CONTRACT_ABI } from "@/lib/contracts";

const DISPOSAL = CONTRACT_ADDRESSES.DisposalContract as `0x${string}`;

export function useDisposalStats() {
  const { data: auctionCount }       = useReadContract({ address: DISPOSAL, abi: DISPOSAL_CONTRACT_ABI, functionName: "auctionCount" });
  const { data: activeAuctionCount } = useReadContract({ address: DISPOSAL, abi: DISPOSAL_CONTRACT_ABI, functionName: "activeAuctionCount" });
  const { data: activeAuctions }     = useReadContract({ address: DISPOSAL, abi: DISPOSAL_CONTRACT_ABI, functionName: "getActiveAuctions" });

  return {
    auctionCount:       Number(auctionCount       ?? 0n),
    activeAuctionCount: Number(activeAuctionCount ?? 0n),
    activeAuctions:     (activeAuctions           ?? []) as bigint[],
  };
}

export function useAuction(auctionId: bigint) {
  const { data, refetch } = useReadContract({
    address: DISPOSAL,
    abi: DISPOSAL_CONTRACT_ABI,
    functionName: "getAuction",
    args: [auctionId],
  });
  return { auction: data, refetch };
}

export function useInvestorDisposalBalance() {
  const { address } = useAccount();
  const enabled = !!address;
  const addr = (address ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;

  const { data: credited }  = useReadContract({ address: DISPOSAL, abi: DISPOSAL_CONTRACT_ABI, functionName: "creditedBalance",    args: [addr], query: { enabled } });
  const { data: locked }    = useReadContract({ address: DISPOSAL, abi: DISPOSAL_CONTRACT_ABI, functionName: "lockedBid",          args: [addr], query: { enabled } });
  const { data: free }      = useReadContract({ address: DISPOSAL, abi: DISPOSAL_CONTRACT_ABI, functionName: "freeBalance",        args: [addr], query: { enabled } });
  const { data: bidAuctions } = useReadContract({ address: DISPOSAL, abi: DISPOSAL_CONTRACT_ABI, functionName: "getActiveBidAuctions", args: [addr], query: { enabled } });

  return {
    credited:    (credited    ?? 0n) as bigint,
    locked:      (locked      ?? 0n) as bigint,
    free:        (free        ?? 0n) as bigint,
    bidAuctions: (bidAuctions ?? []) as bigint[],
  };
}

export function useCreditFunds() {
  const { writeContractAsync, isPending } = useWriteContract();
  const creditFunds = async (amount: bigint) =>
    writeContractAsync({ address: DISPOSAL, abi: DISPOSAL_CONTRACT_ABI, functionName: "creditFunds", args: [amount] });
  return { creditFunds, isPending };
}

export function useWithdrawDisposalFunds() {
  const { writeContractAsync, isPending } = useWriteContract();
  const withdrawFunds = async (amount: bigint) =>
    writeContractAsync({ address: DISPOSAL, abi: DISPOSAL_CONTRACT_ABI, functionName: "withdrawFunds", args: [amount] });
  return { withdrawFunds, isPending };
}

export function usePlaceBid() {
  const { writeContractAsync, isPending } = useWriteContract();
  const placeBid = async (auctionId: bigint, bidAmount: bigint) =>
    writeContractAsync({ address: DISPOSAL, abi: DISPOSAL_CONTRACT_ABI, functionName: "placeBid", args: [auctionId, bidAmount] });
  return { placeBid, isPending };
}

export function useFinalizeAuction() {
  const { writeContractAsync, isPending } = useWriteContract();
  const finalizeAuction = async (auctionId: bigint) =>
    writeContractAsync({ address: DISPOSAL, abi: DISPOSAL_CONTRACT_ABI, functionName: "finalizeAuction", args: [auctionId] });
  return { finalizeAuction, isPending };
}
