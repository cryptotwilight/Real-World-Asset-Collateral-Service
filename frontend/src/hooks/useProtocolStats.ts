"use client";

import { useReadContract } from "wagmi";
import { CONTRACT_ADDRESSES, COLLATERAL_VAULT_ABI, VALUATION_ORACLE_ABI } from "@/lib/contracts";
import { RWA_TOKENS } from "@/lib/contracts";

const VAULT  = CONTRACT_ADDRESSES.CollateralVault    as `0x${string}`;
const ORACLE = CONTRACT_ADDRESSES.RWAValuationOracle as `0x${string}`;

export function useProtocolStats() {
  const { data } = useReadContract({
    address: VAULT,
    abi: COLLATERAL_VAULT_ABI,
    functionName: "getProtocolStats",
  });

  const [activePositions, totalBorrowed, totalLiquidated, currentTotalBorrowed] =
    (data ?? [0n, 0n, 0n, 0n]) as [bigint, bigint, bigint, bigint];

  return { activePositions, totalBorrowed, totalLiquidated, currentTotalBorrowed };
}

/**
 * Live price-per-token in 18-decimal USD from the valuation oracle.
 * Returns a stable ref for one RWA token; composed per-token on UI side.
 */
export function useTokenPrice(token: `0x${string}`) {
  const { data } = useReadContract({
    address: ORACLE,
    abi: VALUATION_ORACLE_ABI,
    functionName: "getPricePerToken",
    args: [token],
    query: { enabled: token !== "0x0000000000000000000000000000000000000000" },
  });
  return (data ?? 0n) as bigint;
}

/**
 * For dashboards listing all RWA prices. Iterates via useTokenPrice on the client.
 */
export function useAllRWAPrices() {
  // Minor workaround: individual hooks per token preserve React rules.
  // Use this in UI by calling useTokenPrice per token explicitly — this export
  // exists for symmetry and can be refactored to useReadContracts if needed.
  return RWA_TOKENS;
}
