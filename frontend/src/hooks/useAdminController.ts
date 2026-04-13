"use client";

import { useReadContract, useWriteContract } from "wagmi";
import { CONTRACT_ADDRESSES, ADMIN_CONTROLLER_ABI, EMISSIONS_ORACLE_ABI, NPV_ORACLE_ABI } from "@/lib/contracts";

const ADMIN   = CONTRACT_ADDRESSES.AdminController  as `0x${string}`;
const EMISS   = CONTRACT_ADDRESSES.EmissionsOracle  as `0x${string}`;
const NPV     = CONTRACT_ADDRESSES.NPVOracle        as `0x${string}`;

export function useProtocolConfig() {
  const { data, refetch } = useReadContract({
    address: ADMIN,
    abi: ADMIN_CONTROLLER_ABI,
    functionName: "getConfig",
  });

  if (!data) return { config: null, refetch };
  const [openFeePercent, closeFeePercent, collateralThreshold, liquidationThreshold, auctionDuration] = data as [bigint, bigint, bigint, bigint, bigint];
  return {
    config: {
      openFeePercent:        Number(openFeePercent),
      closeFeePercent:       Number(closeFeePercent),
      collateralThreshold:   Number(collateralThreshold),
      liquidationThreshold:  Number(liquidationThreshold),
      auctionDuration:       Number(auctionDuration),
    },
    refetch,
  };
}

export function useUpdateFees() {
  const { writeContractAsync, isPending } = useWriteContract();

  const setOpenFee = (feeBps: number) =>
    writeContractAsync({ address: ADMIN, abi: ADMIN_CONTROLLER_ABI, functionName: "setOpenFeePercent",  args: [BigInt(feeBps)] });
  const setCloseFee = (feeBps: number) =>
    writeContractAsync({ address: ADMIN, abi: ADMIN_CONTROLLER_ABI, functionName: "setCloseFeePercent", args: [BigInt(feeBps)] });
  const setCollateralThreshold = (bps: number) =>
    writeContractAsync({ address: ADMIN, abi: ADMIN_CONTROLLER_ABI, functionName: "setCollateralThreshold",  args: [BigInt(bps)] });
  const setLiquidationThreshold = (bps: number) =>
    writeContractAsync({ address: ADMIN, abi: ADMIN_CONTROLLER_ABI, functionName: "setLiquidationThreshold", args: [BigInt(bps)] });

  return { setOpenFee, setCloseFee, setCollateralThreshold, setLiquidationThreshold, isPending };
}

export function useOracleValues(tokenAddress: `0x${string}`) {
  const { data: emissions } = useReadContract({ address: EMISS, abi: EMISSIONS_ORACLE_ABI, functionName: "getEmissionsPerToken", args: [tokenAddress] });
  const { data: npv }       = useReadContract({ address: NPV,   abi: NPV_ORACLE_ABI,       functionName: "getNPVPerToken",       args: [tokenAddress] });

  return {
    emissionsPerToken: (emissions ?? 0n) as bigint,
    npvPerToken:       (npv       ?? 0n) as bigint,
  };
}

export function useUpdateOracleValues() {
  const { writeContractAsync: writeEmissions, isPending: ePending } = useWriteContract();
  const { writeContractAsync: writeNPV,       isPending: nPending } = useWriteContract();

  const setEmissions = (token: `0x${string}`, value: bigint) =>
    writeEmissions({ address: EMISS, abi: EMISSIONS_ORACLE_ABI, functionName: "setEmissionsPerToken", args: [token, value] });
  const setNPV = (token: `0x${string}`, value: bigint) =>
    writeNPV({ address: NPV, abi: NPV_ORACLE_ABI, functionName: "setNPVPerToken", args: [token, value] });

  return { setEmissions, setNPV, isPending: ePending || nPending };
}
