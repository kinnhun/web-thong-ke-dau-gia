import { ArrowDown, ArrowUp, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  trend?: { value: number; positive?: boolean };
  icon?: LucideIcon;
  accent?: "default" | "deep" | "mid" | "new";
}

const accentStyles = {
  default: "bg-card",
  deep: "bg-card",
  mid: "bg-card",
  new: "bg-card",
} as const;

const iconStyles = {
  default: "bg-secondary text-foreground",
  deep: "bg-discount-deep-soft text-discount-deep",
  mid: "bg-discount-mid-soft text-discount-mid",
  new: "bg-new-badge-soft text-new-badge",
} as const;

export const KpiCard = ({ label, value, hint, trend, icon: Icon, accent = "default" }: KpiCardProps) => (
  <div className={cn(
    "rounded-xl border bg-card p-5 transition-colors hover:border-foreground/20",
    accentStyles[accent]
  )}>
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </p>
        <p className="text-2xl font-semibold num text-foreground">{value}</p>
      </div>
      {Icon && (
        <div className={cn("rounded-lg p-2", iconStyles[accent])}>
          <Icon className="h-4 w-4" />
        </div>
      )}
    </div>
    {(hint || trend) && (
      <div className="mt-3 flex items-center gap-2 text-xs">
        {trend && (
          <span className={cn(
            "inline-flex items-center gap-0.5 font-medium num",
            trend.positive === false ? "text-discount-deep" : "text-new-badge"
          )}>
            {trend.positive === false ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
            {Math.abs(trend.value).toFixed(1)}%
          </span>
        )}
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </div>
    )}
  </div>
);
