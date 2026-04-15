"use client";

import { useAccount, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { CONTRACT_ADDRESSES, FAUCET_ABI } from "@/lib/contracts";

const FAUCET = CONTRACT_ADDRESSES.Faucet as `0x${string}`;

export function useFaucetSupportedTokens() {
  const { data, refetch } = useReadContract({
    address: FAUCET,
    abi: FAUCET_ABI,
    functionName: "getSupportedTokens",
  });
  return { tokens: (data ?? []) as readonly `0x${string}`[], refetch };
}

export function useFaucetCooldown(token: `0x${string}`) {
  const { address } = useAccount();
  const zero = "0x0000000000000000000000000000000000000000" as const;

  const { data: canMintData, refetch: refetchCanMint } = useReadContract({
    address: FAUCET,
    abi: FAUCET_ABI,
    functionName: "canMint",
    args: [token, address ?? zero],
    query: { enabled: !!address },
  });

  const { data: lastMintData } = useReadContract({
    address: FAUCET,
    abi: FAUCET_ABI,
    functionName: "lastMint",
    args: [token, address ?? zero],
    query: { enabled: !!address },
  });

  const { data: cooldownData } = useReadContract({
    address: FAUCET,
    abi: FAUCET_ABI,
    functionName: "cooldownPeriod",
  });

  const lastMint  = Number(lastMintData ?? 0n);
  const cooldown  = Number(cooldownData ?? 0n);
  const available = lastMint + cooldown;
  const now       = Math.floor(Date.now() / 1000);
  const secondsUntilAvailable = Math.max(0, available - now);

  return {
    canMint: !!canMintData,
    secondsUntilAvailable,
    refetchCanMint,
  };
}

export function useFaucetMint() {
  const { writeContractAsync, isPending } = useWriteContract();

  const mint = async (token: `0x${string}`) =>
    writeContractAsync({
      address: FAUCET,
      abi: FAUCET_ABI,
      functionName: "mint",
      args: [token],
    });

  const mintAll = async () =>
    writeContractAsync({
      address: FAUCET,
      abi: FAUCET_ABI,
      functionName: "mintAll",
      args: [],
    });

  return { mint, mintAll, isPending };
}
