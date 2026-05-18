/**
 * Format a number as Vietnamese Dong currency (full).
 * e.g. 4200000000 → "4.200.000.000 ₫"
 */
export function formatVND(value: number | undefined | null): string {
  if (value == null) return "Chưa cập nhật";
  return value.toLocaleString("vi-VN") + " ₫";
}

/**
 * Format VND in shortened form.
 * e.g. 4200000000 → "4,2 tỷ", 980000000 → "980 tr"
 */
export function formatVNDShort(value: number | undefined | null): string {
  if (value == null) return "Chưa cập nhật";
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

/**
 * Fixes malformed source URLs from the backend database.
 */
export function getFixedSourceUrl(sourceUrl: string | undefined, name: string | undefined, type: string | undefined, sourceId: number | string): string {
  if (!sourceUrl) return '';
  if (sourceUrl.includes('thong-bao-cong-khai/')) {
    const slugify = (str: string) => {
      if (!str) return '';
      str = str.toLowerCase();
      str = str.replace(/(à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ)/g, 'a');
      str = str.replace(/(è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ)/g, 'e');
      str = str.replace(/(ì|í|ị|ỉ|ĩ)/g, 'i');
      str = str.replace(/(ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ)/g, 'o');
      str = str.replace(/(ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ)/g, 'u');
      str = str.replace(/(ỳ|ý|ỵ|ỷ|ỹ)/g, 'y');
      str = str.replace(/(đ)/g, 'd');
      str = str.replace(/([^0-9a-z-\s])/g, '');
      str = str.replace(/(\s+)/g, '-');
      str = str.replace(/^-+/g, '');
      str = str.replace(/-+$/g, '');
      return str;
    };
    
    const slug = slugify(name || '');
    const path = type === 'org' 
      ? 'thong-bao-cong-khai-viec-lua-chon-to-chuc-dau-gia-tai-san'
      : 'thong-bao-cong-khai-viec-dau-gia';
      
    return `https://dgts.moj.gov.vn/${path}/${slug}-${sourceId}.html`;
  }
  return sourceUrl;
}
