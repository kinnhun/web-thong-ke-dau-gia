import { assetTypeLabel, type AssetType, type DiscountedAuction } from "@/domains/auction";

function normalizeText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "";
}

export function getAuctionDisplayTitle(auction: Pick<DiscountedAuction, "name" | "shortDescription">) {
  return normalizeText(auction.shortDescription) || normalizeText(auction.name) || "Không có tiêu đề";
}

export function getAuctionPropertyLines(
  auction: Pick<DiscountedAuction, "properties" | "shortDescription" | "name" | "type">
) {
  const propertyLines = (auction.properties || [])
    .map((property) => normalizeText(property.name))
    .filter(Boolean);

  if (propertyLines.length > 1) {
    return propertyLines;
  }

  if (propertyLines.length === 1) {
    return [
      normalizeText(auction.shortDescription) || propertyLines[0] || assetTypeLabel[auction.type as AssetType] || auction.type,
    ];
  }

  return [
    normalizeText(auction.shortDescription) ||
      normalizeText(auction.name) ||
      assetTypeLabel[auction.type as AssetType] ||
      auction.type,
  ];
}
