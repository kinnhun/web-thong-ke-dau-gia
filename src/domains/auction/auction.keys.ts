import type { DiscountedParams } from './auction.types';

/**
 * React Query keys cho domain auction.
 * Convention: [domain, scope, ...params]
 */
export const auctionKeys = {
  all: ['auction'] as const,

  // Dashboard
  dashboardStats: () => [...auctionKeys.all, 'dashboard', 'stats'] as const,
  dashboardTrend: (days: number) => [...auctionKeys.all, 'dashboard', 'trend', days] as const,
  dashboardTopDiscounted: (limit: number) => [...auctionKeys.all, 'dashboard', 'top-discounted', limit] as const,
  dashboardNewlyReduced: (limit: number) => [...auctionKeys.all, 'dashboard', 'newly-reduced', limit] as const,
  dashboardTopRelisted: (limit: number) => [...auctionKeys.all, 'dashboard', 'top-relisted', limit] as const,

  // Discounted list
  discountedList: (params: DiscountedParams) => [...auctionKeys.all, 'discounted', params] as const,
  discountedFilters: () => [...auctionKeys.all, 'discounted', 'filters'] as const,

  // Relisted list
  relistedList: (params: DiscountedParams) => [...auctionKeys.all, 'relisted', params] as const,
  relistedFilters: () => [...auctionKeys.all, 'relisted', 'filters'] as const,

  // Auction detail
  detail: (id: string) => [...auctionKeys.all, 'detail', id] as const,

  // Duplicates
  duplicateDetail: (id: string) => [...auctionKeys.all, 'duplicate', id] as const,

  // Reports
  reportByProvince: (limit: number) => [...auctionKeys.all, 'report', 'province', limit] as const,
  reportByType: () => [...auctionKeys.all, 'report', 'type'] as const,
  reportMonthlyTrend: (months: number) => [...auctionKeys.all, 'report', 'monthly', months] as const,
  reportTopDiscount: (by: string, limit: number) => [...auctionKeys.all, 'report', 'top', by, limit] as const,

  // Admin
  crawlLogs: () => [...auctionKeys.all, 'crawl-logs'] as const,
  auctionsList: (params: Record<string, string | number>) => [...auctionKeys.all, 'list', params] as const,
  duplicatesList: (params: Record<string, string | number>) => [...auctionKeys.all, 'duplicates', params] as const,
};
