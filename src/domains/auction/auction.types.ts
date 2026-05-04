// ═══════════════════════════════════
// Asset Types & Labels
// ═══════════════════════════════════

export type AssetType =
  | 'land'
  | 'house'
  | 'car'
  | 'machinery'
  | 'enforcement'
  | 'public'
  | 'other';

export type AuctionStatus =
  | 'upcoming'
  | 'receiving_docs'
  | 'newly_reduced'
  | 'watch'
  | 'completed'
  | 'unknown';

export const assetTypeLabel: Record<AssetType, string> = {
  land: 'Quyền sử dụng đất',
  house: 'Nhà ở',
  car: 'Ô tô',
  machinery: 'Máy móc thiết bị',
  enforcement: 'Tài sản thi hành án',
  public: 'Tài sản công',
  other: 'Khác',
};

export const statusLabel: Partial<Record<AuctionStatus, string>> = {
  upcoming: 'Sắp đấu giá',
  receiving_docs: 'Đang nhận hồ sơ',
  // newly_reduced: 'Mới giảm giá',
  // watch: 'Cần theo dõi',
  completed: 'Đã hoàn thành',
  unknown: 'Không rõ',
};

// ═══════════════════════════════════
// API Response Types
// ═══════════════════════════════════

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Dashboard KPI stats */
export interface DashboardStats {
  totalAuctions: number;
  totalOrg: number;
  recentCount: number;
  newIn72h: number;
  totalDiscounted: number;
  maxDiscountPercent: number;
  maxDiscountItem: { name: string; sourceId: number } | null;
  totalReducedValue: number;
  byType: Array<{ type: string; count: number }>;
  byProvince: Array<{ province: string; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
}

/** Dashboard trend data point */
export interface TrendPoint {
  date: string;
  count: number;
  avgDiscount: number;
}

/** Discounted auction item (from Duplicate + AuctionNotice join) */
export interface DiscountedAuction {
  _id: string;
  name: string;
  shortDescription?: string;
  firstPrice: number;
  latestPrice: number;
  priceDropPercent: number;
  relistCount: number;
  reducedAmount: number;
  updatedAt: string;
  sourceId: number;
  type: AssetType;
  province: string;
  district?: string;
  organizer?: string;
  owner?: string;
  publishedAt: string;
  auctionDate?: string;
  status: AuctionStatus;
  initialPrice: number;
  currentPrice: number;
  sourceUrl?: string;
  properties?: Array<{
    name: string;
    amount?: string;
    place?: string;
    startPrice?: number;
    deposit?: number;
    quality?: string;
  }>;
}

/** Auction detail (from /api/auctions/:id) */
export interface AuctionDetail {
  id: string;
  sourceId: number;
  name: string;
  shortDescription: string;
  type: AssetType;
  province: string;
  address: string;
  initialPrice: number;
  currentPrice: number;
  deposit: number;
  depositPercent?: string;
  applicationFee: number;
  publishRound: number;
  publishRoundLabel: string;
  rootId: number | null;
  relatedIds: number[];
  publishedAt: string;
  auctionDate: string;
  registrationStart: string;
  registrationEnd: string;
  status: AuctionStatus;
  organizer: string;
  owner: string;
  sourceUrl: string;
  propertyTypeName: string;
  propertyAmount: string;
  files: Array<{ name: string; url: string }>;
  properties: Array<{
    name: string;
    amount: string;
    startPrice: number;
    deposit: number;
    depositPercent?: string;
    place: string;
    quality: string;
  }>;
  relatedItems?: Array<{
    id: string;
    sourceId: number;
    name: string;
    initialPrice: number;
    publishRound: number;
    publishedAt: string;
  }>;
  duplicateGroup?: DuplicateGroup | null;
}

export interface DuplicateGroup {
  id: string;
  name: string;
  relistCount: number;
  isPriceDrop: boolean;
  priceDropPercent: number;
  firstPrice: number;
  latestPrice: number;
  entries: Array<{
    sourceId: number;
    price: number;
    publishedAt: string;
    publishRound: number;
    publishRoundLabel: string;
    rootId: number;
    sourceUrl: string;
  }>;
}

/** Filter options for discounted page */
export interface FilterOptions {
  provinces: string[];
  organizers: string[];
  types: string[];
}

/** Report data types */
export interface ProvinceReport {
  province: string;
  count: number;
  avg: number;
  max: number;
}

export interface TypeReport {
  type: string;
  count: number;
}

export interface MonthlyTrend {
  month: string;
  count: number;
  avg: number;
}

export interface TopDiscountItem {
  name: string;
  firstPrice: number;
  latestPrice: number;
  priceDropPercent: number;
  reducedAmount: number;
  relistCount: number;
  province: string;
  type: AssetType;
  sourceId: number;
}

/** Query params for discounted list */
export interface DiscountedParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: AssetType | 'all';
  province?: string;
  organizer?: string;
  minDiscount?: string;
  maxPrice?: string;
  minRounds?: string;
  sort?: string;
  status?: string;
}
