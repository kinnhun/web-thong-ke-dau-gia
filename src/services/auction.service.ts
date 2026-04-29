import { httpClient } from '@/lib/http/client';
import type {
  DashboardStats,
  TrendPoint,
  DiscountedAuction,
  DiscountedParams,
  AuctionDetail,
  FilterOptions,
  Pagination,
  ProvinceReport,
  TypeReport,
  MonthlyTrend,
  TopDiscountItem,
} from '@/domains/auction/auction.types';

// ═══════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const { data } = await httpClient.get('/api/dashboard/stats');
  return data;
}

export async function fetchDashboardTrend(days: number): Promise<TrendPoint[]> {
  const { data } = await httpClient.get('/api/dashboard/trend', { params: { days } });
  return data.trend;
}

export async function fetchTopDiscounted(limit: number): Promise<DiscountedAuction[]> {
  const { data } = await httpClient.get('/api/dashboard/top-discounted', { params: { limit } });
  return data.items;
}

export async function fetchNewlyReduced(limit: number): Promise<DiscountedAuction[]> {
  const { data } = await httpClient.get('/api/dashboard/newly-reduced', { params: { limit } });
  return data.items;
}

export async function fetchTopRelisted(limit: number): Promise<DiscountedAuction[]> {
  const { data } = await httpClient.get('/api/dashboard/top-relisted', { params: { limit } });
  return data.items;
}

// ═══════════════════════════════════
// DISCOUNTED LIST
// ═══════════════════════════════════

export async function fetchDiscountedAuctions(
  params: DiscountedParams
): Promise<{ items: DiscountedAuction[]; pagination: Pagination }> {
  // Clean params: remove 'all' values and empty strings
  const cleanParams: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '' && value !== 'all') {
      cleanParams[key] = value;
    }
  }
  const { data } = await httpClient.get('/api/discounted', { params: cleanParams });
  return data;
}

export async function fetchAuctions(
  params: Record<string, string | number>
): Promise<{ items: Record<string, unknown>[]; pagination: Pagination }> {
  const { data } = await httpClient.get('/api/auctions', { params });
  return data;
}

export async function fetchFilterOptions(): Promise<FilterOptions> {
  const { data } = await httpClient.get('/api/discounted/filters');
  return data;
}

// ═══════════════════════════════════
// RELISTED LIST
// ═══════════════════════════════════

export async function fetchRelistedAuctions(
  params: DiscountedParams
): Promise<{ items: DiscountedAuction[]; pagination: Pagination }> {
  const cleanParams: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '' && value !== 'all') {
      cleanParams[key] = value;
    }
  }
  const { data } = await httpClient.get('/api/relisted', { params: cleanParams });
  return data;
}

export async function fetchRelistedFilterOptions(): Promise<FilterOptions> {
  const { data } = await httpClient.get('/api/relisted/filters');
  return data;
}

// ═══════════════════════════════════
// AUCTION DETAIL
// ═══════════════════════════════════

export async function fetchAuctionDetail(id: string): Promise<AuctionDetail> {
  const { data } = await httpClient.get(`/api/auctions/${id}`);
  return data;
}

// ═══════════════════════════════════
// DUPLICATES
// ═══════════════════════════════════

export async function fetchDuplicateDetail(id: string) {
  const { data } = await httpClient.get(`/api/duplicates/${id}`);
  return data;
}

// ═══════════════════════════════════
// REPORTS
// ═══════════════════════════════════

export async function fetchReportByProvince(limit: number): Promise<ProvinceReport[]> {
  const { data } = await httpClient.get('/api/reports/by-province', { params: { limit } });
  return data.data;
}

export async function fetchReportByType(): Promise<TypeReport[]> {
  const { data } = await httpClient.get('/api/reports/by-type');
  return data.data;
}

export async function fetchReportMonthlyTrend(months: number): Promise<MonthlyTrend[]> {
  const { data } = await httpClient.get('/api/reports/monthly-trend', { params: { months } });
  return data.data;
}

export async function fetchReportTopDiscount(by: 'percent' | 'amount', limit: number): Promise<TopDiscountItem[]> {
  const { data } = await httpClient.get('/api/reports/top-discount', { params: { by, limit } });
  return data.data;
}

// ═══════════════════════════════════
// ADMIN
// ═══════════════════════════════════

export async function fetchCrawlLogs(): Promise<{ logs: Record<string, unknown>[]; hasRunningDuplicateScan: boolean; hasRunningCrawl: boolean }> {
  const { data } = await httpClient.get('/api/crawl-logs');
  return data;
}

export async function triggerDetailCrawl(limit: number, type: string) {
  const { data } = await httpClient.post('/api/trigger-detail-crawl', { limit, type });
  return data;
}

export async function triggerListCrawl(maxPages: number, type: string) {
  const { data } = await httpClient.post('/api/trigger-list-crawl', { maxPages, type });
  return data;
}

export async function triggerDuplicateScan() {
  const { data } = await httpClient.post('/api/trigger-duplicate-scan');
  return data;
}

export async function triggerRecrawlItem(sourceId: number, type = 'auction') {
  const { data } = await httpClient.post('/api/trigger-recrawl-item', { sourceId, type });
  return data;
}

export async function triggerRecrawlMissingProperties(limit = 50, type = 'auction') {
  const { data } = await httpClient.post('/api/trigger-recrawl-missing-properties', { limit, type });
  return data;
}

export async function triggerKillDuplicateScan() {
  const { data } = await httpClient.post('/api/trigger-kill-duplicate-scan');
  return data;
}
