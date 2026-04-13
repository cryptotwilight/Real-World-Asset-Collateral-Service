"use client";

import { useReadContract, useWriteContract, useAccount } from "wagmi";
import { ERC20_ABI } from "@/lib/contracts";

/**
 * Shared hook for ERC-20 token interactions.
 * Provides balance, allowance queries and approve / transfer writes.
 */
export function useToken(tokenAddress: `0x${string}`) {
  const { address } = useAccount();
  const enabled = !!address && tokenAddress !== "0x0000000000000000000000000000000000000000";

  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [address ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled },
  });

  const { data: symbol } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "symbol",
    query: { enabled: tokenAddress !== "0x0000000000000000000000000000000000000000" },
  });

  const { data: decimals } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled: tokenAddress !== "0x0000000000000000000000000000000000000000" },
  });

  const { writeContractAsync, isPending: approvePending } = useWriteContract();

  const approve = async (spender: `0x${string}`, amount: bigint) =>
    writeContractAsync({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [spender, amount],
    });

  return {
    balance:        (balance  ?? 0n) as bigint,
    symbol:         (symbol   ?? "") as string,
    decimals:       (decimals ?? 18) as number,
    approve,
    approvePending,
    refetchBalance,
  };
}

/**
 * Check how much `spender` is allowed to pull from the connected wallet for `tokenAddress`.
 */
export function useAllowance(tokenAddress: `0x${string}`, spender: `0x${string}`) {
  const { address } = useAccount();
  const enabled = !!address
    && tokenAddress !== "0x0000000000000000000000000000000000000000"
    && spender      !== "0x0000000000000000000000000000000000000000";

  const { data, refetch } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [
      address ?? "0x0000000000000000000000000000000000000000",
      spender,
    ],
    query: { enabled },
  });

  return { allowance: (data ?? 0n) as bigint, refetch };
}
