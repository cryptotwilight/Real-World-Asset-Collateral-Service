"use client";

import { useReadContract, useReadContracts, useWriteContract, useAccount } from "wagmi";
import { CONTRACT_ADDRESSES, COLLATERAL_VAULT_ABI, VALUATION_ORACLE_ABI } from "@/lib/contracts";
import type { Position } from "@/types";

const VAULT = CONTRACT_ADDRESSES.CollateralVault as `0x${string}`;
const ORACLE = CONTRACT_ADDRESSES.RWAValuationOracle as `0x${string}`;

export function useBorrowerPositions() {
  const { address } = useAccount();

  const { data: positionIds, refetch: refetchIds } = useReadContract({
    address: VAULT,
    abi: COLLATERAL_VAULT_ABI,
    functionName: "getBorrowerPositions",
    args: [address ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!address },
  });

  return { positionIds: (positionIds ?? []) as bigint[], refetchIds };
}

export function usePosition(positionId: bigint) {
  const { data: pos } = useReadContract({
    address: VAULT,
    abi: COLLATERAL_VAULT_ABI,
    functionName: "getPosition",
    args: [positionId],
  });

  const { data: hf } = useReadContract({
    address: VAULT,
    abi: COLLATERAL_VAULT_ABI,
    functionName: "healthFactor",
    args: [positionId],
  });

  const { data: harvestable } = useReadContract({
    address: VAULT,
    abi: COLLATERAL_VAULT_ABI,
    functionName: "harvestableCollateral",
    args: [positionId],
  });

  return {
    position: pos as Position | undefined,
    healthFactor: hf ? Number(hf) : undefined,
    harvestable: harvestable as bigint | undefined,
  };
}

export function useOpenPosition() {
  const { writeContractAsync, isPending } = useWriteContract();

  const openPosition = async (
    lstToken: `0x${string}`,
    lstAmount: bigint,
    borrowAmount: bigint
  ) => {
    return writeContractAsync({
      address: VAULT,
      abi: COLLATERAL_VAULT_ABI,
      functionName: "openPosition",
      args: [lstToken, lstAmount, borrowAmount],
    });
  };

  return { openPosition, isPending };
}

export function useClosePosition() {
  const { writeContractAsync, isPending } = useWriteContract();

  const closePosition = async (positionId: bigint) => {
    return writeContractAsync({
      address: VAULT,
      abi: COLLATERAL_VAULT_ABI,
      functionName: "closePosition",
      args: [positionId],
    });
  };

  return { closePosition, isPending };
}

export function useTopUpPosition() {
  const { writeContractAsync, isPending } = useWriteContract();

  const topUpPosition = async (positionId: bigint, additionalLst: bigint) => {
    return writeContractAsync({
      address: VAULT,
      abi: COLLATERAL_VAULT_ABI,
      functionName: "topUpPosition",
      args: [positionId, additionalLst],
    });
  };

  return { topUpPosition, isPending };
}

export function useHarvestPosition() {
  const { writeContractAsync, isPending } = useWriteContract();

  const harvestPosition = async (
    positionId: bigint,
    lstToWithdraw: bigint,
    additionalBorrow: bigint
  ) => {
    return writeContractAsync({
      address: VAULT,
      abi: COLLATERAL_VAULT_ABI,
      functionName: "harvestPosition",
      args: [positionId, lstToWithdraw, additionalBorrow],
    });
  };

  return { harvestPosition, isPending };
}

export function useLiquidate() {
  const { writeContractAsync, isPending } = useWriteContract();

  const liquidate = async (positionId: bigint) => {
    return writeContractAsync({
      address: VAULT,
      abi: COLLATERAL_VAULT_ABI,
      functionName: "liquidate",
      args: [positionId],
    });
  };

  return { liquidate, isPending };
}

export function useTokenValuation(lstToken: `0x${string}`, amount: bigint) {
  const { data } = useReadContract({
    address: ORACLE,
    abi: VALUATION_ORACLE_ABI,
    functionName: "getTokenValue",
    args: [lstToken, amount],
    query: { enabled: amount > 0n },
  });

  if (!data) return { total: 0n, emissionsComponent: 0n, npvComponent: 0n };
  const [total, emissionsComponent, npvComponent] = data as [bigint, bigint, bigint];
  return { total, emissionsComponent, npvComponent };
}
