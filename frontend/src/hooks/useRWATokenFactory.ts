"use client";

import { useReadContract, useWriteContract } from "wagmi";
import { CONTRACT_ADDRESSES, RWA_TOKEN_FACTORY_ABI } from "@/lib/contracts";

const FACTORY = CONTRACT_ADDRESSES.RWATokenFactory as `0x${string}`;

export interface FactoryTokenInfo {
  tokenAddress: `0x${string}`;
  name: string;
  symbol: string;
  assetDescription: string;
}

export function useAllFactoryTokens() {
  const { data, refetch } = useReadContract({
    address: FACTORY,
    abi: RWA_TOKEN_FACTORY_ABI,
    functionName: "getAllTokens",
  });

  return {
    tokens: (data ?? []) as readonly FactoryTokenInfo[],
    refetch,
  };
}

export function useCreateRWAToken() {
  const { writeContractAsync, isPending } = useWriteContract();

  const createToken = async (
    name: string,
    symbol: string,
    assetDescription: string,
    documentationURI: string
  ) =>
    writeContractAsync({
      address: FACTORY,
      abi: RWA_TOKEN_FACTORY_ABI,
      functionName: "createToken",
      args: [name, symbol, assetDescription, documentationURI],
    });

  return { createToken, isPending };
}
