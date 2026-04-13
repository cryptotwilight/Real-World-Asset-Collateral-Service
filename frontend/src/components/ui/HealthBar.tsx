import { clsx } from "clsx";

interface HealthBarProps {
  healthFactor: number; // basis points (e.g. 15000 = 150%)
  liquidationThreshold?: number; // default 11000
  collateralThreshold?: number;  // default 15000
}

export function HealthBar({
  healthFactor,
  liquidationThreshold = 11000,
  collateralThreshold = 15000,
}: HealthBarProps) {
  // Clamp display to 200% for visual purposes
  const maxDisplay = 20000;
  const pct = Math.min((healthFactor / maxDisplay) * 100, 100);

  const isLiquidatable = healthFactor < liquidationThreshold;
  const isWarning = healthFactor < collateralThreshold && !isLiquidatable;

  const fillClass = isLiquidatable
    ? "bg-red-500"
    : isWarning
    ? "bg-amber-400"
    : "bg-emerald-500";

  const label = healthFactor === Number.MAX_SAFE_INTEGER
    ? "∞"
    : `${(healthFactor / 100).toFixed(1)}%`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">Health Factor</span>
        <span className={clsx(
          "font-mono font-medium",
          isLiquidatable ? "text-red-400" : isWarning ? "text-amber-400" : "text-emerald-400"
        )}>
          {label}
        </span>
      </div>
      <div className="health-bar">
        <div
          className={clsx("health-bar-fill", fillClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-slate-600">
        <span>Liquidation {(liquidationThreshold / 100).toFixed(0)}%</span>
        <span>Min collateral {(collateralThreshold / 100).toFixed(0)}%</span>
      </div>
    </div>
  );
}
