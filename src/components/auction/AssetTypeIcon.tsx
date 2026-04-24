import { Building2, Car, Cog, Gavel, Home, Landmark, Package } from "lucide-react";
import type { AssetType } from "@/domains/auction/auction.types";
import { cn } from "@/lib/utils";

const map: Record<AssetType, typeof Home> = {
  land: Landmark,
  house: Home,
  car: Car,
  machinery: Cog,
  enforcement: Gavel,
  public: Building2,
  other: Package,
};

export const AssetTypeIcon = ({ type, className }: { type: AssetType; className?: string }) => {
  const Icon = map[type];
  return <Icon className={cn("h-4 w-4", className)} />;
};
