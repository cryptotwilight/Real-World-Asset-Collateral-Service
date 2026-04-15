/**
 * Contract addresses and ABIs.
 *
 * Addresses are loaded from environment variables so that the same frontend
 * can be pointed at localhost, HashKey testnet, or mainnet without rebuilding.
 */

// ── Addresses ────────────────────────────────────────────────────────────────

export const CONTRACT_ADDRESSES = {
  MockStablecoin:     process.env.NEXT_PUBLIC_STABLECOIN_ADDRESS     ?? "0x0000000000000000000000000000000000000000",
  EmissionsOracle:    process.env.NEXT_PUBLIC_EMISSIONS_ORACLE       ?? "0x0000000000000000000000000000000000000000",
  NPVOracle:          process.env.NEXT_PUBLIC_NPV_ORACLE             ?? "0x0000000000000000000000000000000000000000",
  RWAValuationOracle: process.env.NEXT_PUBLIC_VALUATION_ORACLE       ?? "0x0000000000000000000000000000000000000000",
  AdminController:    process.env.NEXT_PUBLIC_ADMIN_CONTROLLER       ?? "0x0000000000000000000000000000000000000000",
  StablecoinPool:     process.env.NEXT_PUBLIC_STABLECOIN_POOL        ?? "0x0000000000000000000000000000000000000000",
  DisposalContract:   process.env.NEXT_PUBLIC_DISPOSAL_CONTRACT      ?? "0x0000000000000000000000000000000000000000",
  CollateralVault:    process.env.NEXT_PUBLIC_COLLATERAL_VAULT       ?? "0x0000000000000000000000000000000000000000",
  RWATokenFactory:    process.env.NEXT_PUBLIC_RWA_TOKEN_FACTORY      ?? "0x0000000000000000000000000000000000000000",
  Faucet:             process.env.NEXT_PUBLIC_FAUCET                 ?? "0x0000000000000000000000000000000000000000",
  RWAToken_hkCRE:     process.env.NEXT_PUBLIC_RWA_TOKEN_HKCRE        ?? "0x0000000000000000000000000000000000000000",
  RWAToken_hkGOLD:    process.env.NEXT_PUBLIC_RWA_TOKEN_HKGOLD       ?? "0x0000000000000000000000000000000000000000",
  RWAToken_hkSILVER:  process.env.NEXT_PUBLIC_RWA_TOKEN_HKSILVER     ?? "0x0000000000000000000000000000000000000000",
  RWAToken_hkOIL:     process.env.NEXT_PUBLIC_RWA_TOKEN_HKOIL        ?? "0x0000000000000000000000000000000000000000",
  RWAToken_hkCOAL:    process.env.NEXT_PUBLIC_RWA_TOKEN_HKCOAL       ?? "0x0000000000000000000000000000000000000000",
} as const;

// ── ABIs ─────────────────────────────────────────────────────────────────────

export const ADMIN_CONTROLLER_ABI = [
  "function openFeePercent() view returns (uint256)",
  "function closeFeePercent() view returns (uint256)",
  "function collateralThreshold() view returns (uint256)",
  "function liquidationThreshold() view returns (uint256)",
  "function auctionDuration() view returns (uint256)",
  "function getConfig() view returns (uint256, uint256, uint256, uint256, uint256)",
  "function setOpenFeePercent(uint256)",
  "function setCloseFeePercent(uint256)",
  "function setCollateralThreshold(uint256)",
  "function setLiquidationThreshold(uint256)",
  "function setAuctionDuration(uint256)",
  "event OpenFeeUpdated(uint256 oldFee, uint256 newFee)",
  "event CloseFeeUpdated(uint256 oldFee, uint256 newFee)",
] as const;

export const STABLECOIN_POOL_ABI = [
  "function totalAssets() view returns (uint256)",
  "function totalShares() view returns (uint256)",
  "function totalBorrowed() view returns (uint256)",
  "function totalFeesCollected() view returns (uint256)",
  "function shares(address) view returns (uint256)",
  "function investorBalance(address) view returns (uint256)",
  "function utilisation() view returns (uint256)",
  "function availableLiquidity() view returns (uint256)",
  "function sharePrice() view returns (uint256)",
  "function deposit(uint256)",
  "function withdraw(uint256)",
  "event Deposited(address indexed investor, uint256 amount, uint256 sharesIssued)",
  "event Withdrawn(address indexed investor, uint256 sharesRedeemed, uint256 amountReturned)",
  "event Repaid(address indexed vault, uint256 principal, uint256 fee)",
] as const;

export const COLLATERAL_VAULT_ABI = [
  "function positionCount() view returns (uint256)",
  "function totalActivePositions() view returns (uint256)",
  "function totalBorrowedAllTime() view returns (uint256)",
  "function totalLiquidatedPositions() view returns (uint256)",
  "function getProtocolStats() view returns (uint256 activePositions, uint256 totalBorrowed, uint256 totalLiquidated, uint256 currentTotalBorrowed)",
  "function getPosition(uint256) view returns (tuple(address borrower, address lstToken, uint256 lstAmount, uint256 loanAmount, uint256 openFee, uint256 openTimestamp, uint8 status, bool includeEmissions))",
  "function getBorrowerPositions(address) view returns (uint256[])",
  "function healthFactor(uint256) view returns (uint256)",
  "function harvestableCollateral(uint256) view returns (uint256)",
  "function openPosition(address lstToken, uint256 lstAmount, uint256 borrowAmount, bool includeEmissions)",
  "function closePosition(uint256 positionId)",
  "function topUpPosition(uint256 positionId, uint256 additionalLst)",
  "function harvestPosition(uint256 positionId, uint256 lstToWithdraw, uint256 additionalBorrow)",
  "function liquidate(uint256 positionId)",
  "event PositionOpened(uint256 indexed positionId, address indexed borrower, address lstToken, uint256 lstAmount, uint256 loanAmount, uint256 openFee, bool includeEmissions)",
  "event PositionClosed(uint256 indexed positionId, address indexed borrower, uint256 repaidAmount, uint256 closeFee)",
  "event PositionLiquidated(uint256 indexed positionId, address indexed borrower, uint256 auctionId)",
] as const;

export const DISPOSAL_CONTRACT_ABI = [
  "function auctionCount() view returns (uint256)",
  "function activeAuctionCount() view returns (uint256)",
  "function creditedBalance(address) view returns (uint256)",
  "function lockedBid(address) view returns (uint256)",
  "function freeBalance(address) view returns (uint256)",
  "function getAuction(uint256) view returns (tuple(address lstToken, uint256 lstAmount, uint256 minBid, uint256 debtToRepay, address debtor, address stablecoinPool, uint256 endTime, address highestBidder, uint256 highestBid, bool finalized))",
  "function getActiveAuctions() view returns (uint256[])",
  "function getActiveBidAuctions(address) view returns (uint256[])",
  "function creditFunds(uint256 amount)",
  "function withdrawFunds(uint256 amount)",
  "function placeBid(uint256 auctionId, uint256 bidAmount)",
  "function finalizeAuction(uint256 auctionId)",
  "event FundsCredited(address indexed investor, uint256 amount)",
  "event FundsWithdrawn(address indexed investor, uint256 amount)",
  "event BidPlaced(uint256 indexed auctionId, address indexed bidder, uint256 amount)",
  "event AuctionFinalized(uint256 indexed auctionId, address winner, uint256 winningBid)",
] as const;

export const EMISSIONS_ORACLE_ABI = [
  "function getEmissionsPerToken(address token) view returns (uint256)",
  "function getEmissionsValue(address token, uint256 amount) view returns (uint256)",
  "function setEmissionsPerToken(address token, uint256 value)",
  "function batchSetEmissionsPerToken(address[] tokens, uint256[] values)",
] as const;

export const NPV_ORACLE_ABI = [
  "function getNPVPerToken(address token) view returns (uint256)",
  "function getNPVValue(address token, uint256 amount) view returns (uint256)",
  "function setNPVPerToken(address token, uint256 value)",
  "function batchSetNPVPerToken(address[] tokens, uint256[] values)",
] as const;

export const VALUATION_ORACLE_ABI = [
  "function getTotalValue(address token, uint256 amount) view returns (uint256)",
  "function getPricePerToken(address token) view returns (uint256)",
  "function getTokenValue(address token, uint256 amount) view returns (uint256 total, uint256 emissionsComponent, uint256 npvComponent)",
] as const;

export const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
] as const;

export const RWA_TOKEN_ABI = [
  ...ERC20_ABI,
  "function assetDescription() view returns (string)",
  "function documentationURI() view returns (string)",
  "function mint(address to, uint256 amount)",
  "function grantRole(bytes32 role, address account)",
] as const;

export const FAUCET_ABI = [
  "function mint(address token)",
  "function mintAll()",
  "function canMint(address token, address user) view returns (bool)",
  "function cooldownPeriod() view returns (uint256)",
  "function lastMint(address token, address user) view returns (uint256)",
  "function getSupportedTokens() view returns (address[])",
  "function isSupported(address token) view returns (bool)",
  "function addToken(address token)",
  "function removeToken(address token)",
  "event TokensMinted(address indexed user, address indexed token, uint256 amount)",
] as const;

export const RWA_TOKEN_FACTORY_ABI = [
  "function createToken(string name_, string symbol_, string assetDescription_, string documentationURI_) returns (address)",
  "function registerToken(address tokenAddress, string name_, string symbol_, string assetDescription_)",
  "function getTokenCount() view returns (uint256)",
  "function getAllTokens() view returns (tuple(address tokenAddress, string name, string symbol, string assetDescription)[])",
  "function isRegistered(address) view returns (bool)",
  "event TokenCreated(address indexed tokenAddress, string name, string symbol, string assetDescription)",
] as const;

// Supported RWA tokens list for UI dropdowns
export interface RWATokenInfo {
  address: string;
  symbol: string;
  name: string;
  assetDescription: string;
}

export const RWA_TOKENS: RWATokenInfo[] = [
  {
    address: CONTRACT_ADDRESSES.RWAToken_hkCRE,
    symbol: "hkCRE",
    name: "HashKey CRE LST",
    assetDescription: "Commercial Real Estate Portfolio",
  },
  {
    address: CONTRACT_ADDRESSES.RWAToken_hkGOLD,
    symbol: "hkGOLD",
    name: "HashKey Gold LST",
    assetDescription: "Gold Bullion Reserve",
  },
  {
    address: CONTRACT_ADDRESSES.RWAToken_hkSILVER,
    symbol: "hkSILVER",
    name: "HashKey Silver LST",
    assetDescription: "Silver Bullion Reserve",
  },
  {
    address: CONTRACT_ADDRESSES.RWAToken_hkOIL,
    symbol: "hkOIL",
    name: "HashKey Oil LST",
    assetDescription: "Crude Oil (WTI) Futures Backed",
  },
  {
    address: CONTRACT_ADDRESSES.RWAToken_hkCOAL,
    symbol: "hkCOAL",
    name: "HashKey Coal LST",
    assetDescription: "Thermal Coal Forward Contracts",
  },
].filter(t => t.address !== "0x0000000000000000000000000000000000000000");
