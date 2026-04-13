import { clsx } from "clsx";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  icon?: LucideIcon;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function StatCard({ label, value, sub, icon: Icon, trend, className }: StatCardProps) {
  return (
    <div className={clsx("card flex flex-col gap-1", className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">{label}</span>
        {Icon && <Icon className="w-4 h-4 text-slate-500" />}
      </div>
      <div className="stat-value mt-1">{value}</div>
      {sub && (
        <div className={clsx("text-xs mt-0.5",
          trend === "up"   ? "text-emerald-400" :
          trend === "down" ? "text-red-400" :
          "text-slate-500"
        )}>
          {sub}
        </div>
      )}
    </div>
  );
}
