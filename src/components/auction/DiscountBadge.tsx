import { cn } from "@/lib/utils";
import { getDiscountTier } from "@/lib/format";

interface DiscountBadgeProps {
  percent: number;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const DiscountBadge = ({ percent, className, size = "md" }: DiscountBadgeProps) => {
  const tier = getDiscountTier(percent);

  if (tier === "none") {
    return (
      <span className={cn(
        "inline-flex items-center rounded-md bg-neutral-badge-soft text-neutral-badge font-medium",
        size === "sm" && "px-1.5 py-0.5 text-xs",
        size === "md" && "px-2 py-0.5 text-xs",
        size === "lg" && "px-2.5 py-1 text-sm",
        className
      )}>
        Chưa giảm
      </span>
    );
  }

  const tierStyles = {
    deep: "bg-discount-deep-soft text-discount-deep",
    mid: "bg-discount-mid-soft text-discount-mid",
    light: "bg-discount-light-soft text-discount-light",
  } as const;

  return (
    <span className={cn(
      "inline-flex items-center rounded-md font-semibold num",
      tierStyles[tier],
      size === "sm" && "px-1.5 py-0.5 text-xs",
      size === "md" && "px-2 py-0.5 text-xs",
      size === "lg" && "px-2.5 py-1 text-sm",
      className
    )}>
      −{percent.toFixed(1)}%
    </span>
  );
};
