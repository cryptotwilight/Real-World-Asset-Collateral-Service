export type PositionStatus = "Active" | "Closed" | "Liquidated";

export interface Position {
  id: number;
  borrower: string;
  lstToken: string;
  lstTokenSymbol: string;
  lstAmount: bigint;       // 18 decimals
  loanAmount: bigint;      // stablecoin decimals
  openFee: bigint;
  openTimestamp: number;
  status: PositionStatus;
  // Derived / oracle-sourced
  collateralValueUSD: bigint; // 18 decimals USD
  healthFactor: number;       // basis points (e.g. 15000 = 150%)
}

export interface PoolStats {
  totalAssets: bigint;
  totalShares: bigint;
  totalBorrowed: bigint;
  totalFeesCollected: bigint;
  utilisation: number;         // basis points
  sharePrice: bigint;          // 18 decimals
}

export interface InvestorPoolPosition {
  shares: bigint;
  valueUSD: bigint;
  feesEarned: bigint;
}

export interface Auction {
  id: number;
  lstToken: string;
  lstTokenSymbol: string;
  lstAmount: bigint;
  minBid: bigint;
  debtToRepay: bigint;
  endTime: number;       // unix timestamp
  highestBidder: string;
  highestBid: bigint;
  finalized: boolean;
}

export interface InvestorDisposalPosition {
  creditedBalance: bigint;
  lockedBid: bigint;
  freeBalance: bigint;
  activeBidAuctions: number[];
  lstHoldings: { token: string; symbol: string; amount: bigint }[];
}

export interface OracleValues {
  token: string;
  symbol: string;
  emissionsPerToken: bigint;
  npvPerToken: bigint;
  totalPerToken: bigint;
}

export interface ProtocolConfig {
  openFeePercent: number;
  closeFeePercent: number;
  collateralThreshold: number;
  liquidationThreshold: number;
  auctionDuration: number;
}
