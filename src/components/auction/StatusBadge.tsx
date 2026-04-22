import { cn } from "@/lib/utils";
import type { AuctionStatus } from "@/data/mockAuctions";
import { statusLabel } from "@/data/mockAuctions";

const styles: Record<AuctionStatus, string> = {
  upcoming: "bg-secondary text-secondary-foreground",
  receiving_docs: "bg-watch-badge-soft text-watch-badge",
  newly_reduced: "bg-discount-deep-soft text-discount-deep",
  watch: "bg-discount-mid-soft text-discount-mid",
};

export const StatusBadge = ({ status, className }: { status: AuctionStatus; className?: string }) => (
  <span className={cn(
    "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
    styles[status],
    className
  )}>
    {statusLabel[status]}
  </span>
);
