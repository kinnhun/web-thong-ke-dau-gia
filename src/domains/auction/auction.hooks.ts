import { useQuery } from '@tanstack/react-query';
import { auctionKeys } from './auction.keys';
import type { DiscountedParams } from './auction.types';
import {
  fetchDashboardStats,
  fetchDashboardTrend,
  fetchTopDiscounted,
  fetchNewlyReduced,
  fetchTopRelisted,
  fetchDiscountedAuctions,
  fetchFilterOptions,
  fetchRelistedAuctions,
  fetchRelistedFilterOptions,
  fetchAuctionDetail,
  fetchDuplicateDetail,
  fetchReportByProvince,
  fetchReportByType,
  fetchReportMonthlyTrend,
  fetchReportTopDiscount,
  fetchCrawlLogs,
  fetchAuctions,
} from '@/services/auction.service';

// ═══════════════════════════════════
// DASHBOARD HOOKS
// ═══════════════════════════════════

export function useDashboardStats() {
  return useQuery({
    queryKey: auctionKeys.dashboardStats(),
    queryFn: fetchDashboardStats,
    staleTime: 60_000, // 1 min
  });
}

export function useDashboardTrend(days = 14) {
  return useQuery({
    queryKey: auctionKeys.dashboardTrend(days),
    queryFn: () => fetchDashboardTrend(days),
    staleTime: 5 * 60_000,
  });
}

export function useTopDiscounted(limit = 10) {
  return useQuery({
    queryKey: auctionKeys.dashboardTopDiscounted(limit),
    queryFn: () => fetchTopDiscounted(limit),
    staleTime: 60_000,
  });
}

export function useNewlyReduced(limit = 4) {
  return useQuery({
    queryKey: auctionKeys.dashboardNewlyReduced(limit),
    queryFn: () => fetchNewlyReduced(limit),
    staleTime: 60_000,
  });
}

export function useTopRelisted(limit = 10) {
  return useQuery({
    queryKey: auctionKeys.dashboardTopRelisted(limit),
    queryFn: () => fetchTopRelisted(limit),
    staleTime: 60_000,
  });
}

export function useAuctions(params: Record<string, string | number>) {
  return useQuery({
    queryKey: ['auctions', params],
    queryFn: () => fetchAuctions(params),
    staleTime: 60_000,
  });
}

// ═══════════════════════════════════
// DISCOUNTED LIST HOOKS
// ═══════════════════════════════════

export function useDiscountedAuctions(params: DiscountedParams) {
  return useQuery({
    queryKey: auctionKeys.discountedList(params),
    queryFn: () => fetchDiscountedAuctions(params),
    staleTime: 30_000,
    placeholderData: (prev) => prev, // keep previous data while loading
  });
}

export function useFilterOptions() {
  return useQuery({
    queryKey: auctionKeys.discountedFilters(),
    queryFn: fetchFilterOptions,
    staleTime: 10 * 60_000, // 10 min — rarely changes
  });
}

// ═══════════════════════════════════
// RELISTED LIST HOOKS
// ═══════════════════════════════════

export function useRelistedAuctions(params: DiscountedParams) {
  return useQuery({
    queryKey: auctionKeys.relistedList(params),
    queryFn: () => fetchRelistedAuctions(params),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });
}

export function useRelistedFilterOptions() {
  return useQuery({
    queryKey: auctionKeys.relistedFilters(),
    queryFn: fetchRelistedFilterOptions,
    staleTime: 10 * 60_000,
  });
}

// ═══════════════════════════════════
// DETAIL HOOKS
// ═══════════════════════════════════

export function useAuctionDetail(id: string) {
  return useQuery({
    queryKey: auctionKeys.detail(id),
    queryFn: () => fetchAuctionDetail(id),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useDuplicateDetail(id: string) {
  return useQuery({
    queryKey: auctionKeys.duplicateDetail(id),
    queryFn: () => fetchDuplicateDetail(id),
    enabled: !!id,
    staleTime: 60_000,
  });
}

// ═══════════════════════════════════
// REPORTS HOOKS
// ═══════════════════════════════════

export function useReportByProvince(limit = 10) {
  return useQuery({
    queryKey: auctionKeys.reportByProvince(limit),
    queryFn: () => fetchReportByProvince(limit),
    staleTime: 5 * 60_000,
  });
}

export function useReportByType() {
  return useQuery({
    queryKey: auctionKeys.reportByType(),
    queryFn: fetchReportByType,
    staleTime: 5 * 60_000,
  });
}

export function useReportMonthlyTrend(months = 8) {
  return useQuery({
    queryKey: auctionKeys.reportMonthlyTrend(months),
    queryFn: () => fetchReportMonthlyTrend(months),
    staleTime: 5 * 60_000,
  });
}

export function useReportTopDiscount(by: 'percent' | 'amount', limit = 5) {
  return useQuery({
    queryKey: auctionKeys.reportTopDiscount(by, limit),
    queryFn: () => fetchReportTopDiscount(by, limit),
    staleTime: 5 * 60_000,
  });
}

// ═══════════════════════════════════
// ADMIN HOOKS
// ═══════════════════════════════════

export function useCrawlLogs() {
  return useQuery({
    queryKey: auctionKeys.crawlLogs(),
    queryFn: fetchCrawlLogs,
    staleTime: 10_000,
    refetchInterval: (query) => {
      const payload = query.state.data as { hasRunningDuplicateScan?: boolean; hasRunningCrawl?: boolean } | undefined;
      return payload?.hasRunningCrawl || payload?.hasRunningDuplicateScan ? 5000 : false;
    },
  });
}
