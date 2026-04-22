/**
 * Format a number as Vietnamese Dong currency (full).
 * e.g. 4200000000 → "4.200.000.000 ₫"
 */
export function formatVND(value: number): string {
  return value.toLocaleString("vi-VN") + " ₫";
}

/**
 * Format VND in shortened form.
 * e.g. 4200000000 → "4,2 tỷ", 980000000 → "980 tr"
 */
export function formatVNDShort(value: number): string {
  if (value >= 1_000_000_000) {
    const v = value / 1_000_000_000;
    return v % 1 === 0 ? `${v} tỷ` : `${v.toFixed(1)} tỷ`.replace(".", ",");
  }
  if (value >= 1_000_000) {
    const v = value / 1_000_000;
    return v % 1 === 0 ? `${v} tr` : `${v.toFixed(0)} tr`;
  }
  return value.toLocaleString("vi-VN") + " ₫";
}

/**
 * Format an ISO date string to Vietnamese locale.
 * e.g. "2025-03-15T..." → "15/03/2025"
 */
export function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Format relative days from an ISO date string.
 * e.g. yesterday → "Hôm qua", 3 days ago → "3 ngày trước"
 */
export function formatRelativeDays(isoString: string): string {
  const diff = Math.floor(
    (Date.now() - new Date(isoString).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diff === 0) return "Hôm nay";
  if (diff === 1) return "Hôm qua";
  if (diff < 0) return `${Math.abs(diff)} ngày nữa`;
  return `${diff} ngày trước`;
}

export type DiscountTier = "deep" | "mid" | "light" | "none";

/**
 * Determine the visual tier for a given discount percentage.
 */
export function getDiscountTier(percent: number): DiscountTier {
  if (percent >= 25) return "deep";
  if (percent >= 10) return "mid";
  if (percent > 0) return "light";
  return "none";
}
