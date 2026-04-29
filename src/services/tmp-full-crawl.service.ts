import { httpClient } from '@/lib/http/client';

export interface TmpFullCrawlNotice {
  sourceId?: number;
  name?: string;
  province?: string;
  publishedAt?: string | null;
}

export interface TmpFullCrawlLog {
  id: string;
  status: string;
  startedAt?: string;
  finishedAt?: string;
  totalPages: number;
  pagesProcessed: number;
  itemsInserted: number;
  itemsSkipped: number;
  itemsUpdated: number;
  recentNotices: TmpFullCrawlNotice[];
  errorMessages: string[];
  updatedAt?: string;
}

export interface TmpFullCrawlStatus {
  target: number;
  totalSaved: number;
  missingToTarget: number;
  detailDone: number;
  detailPending: number;
  progressPercent: number;
  pagePercent: number;
  latestLog: TmpFullCrawlLog | null;
}

export async function getTmpFullCrawlStatus(): Promise<TmpFullCrawlStatus> {
  const response = await httpClient.get<TmpFullCrawlStatus>('/api/tmp/full-crawl/status');
  return response.data;
}

export async function startTmpFullCrawl(): Promise<{ success: boolean; message: string }> {
  const response = await httpClient.post<{ success: boolean; message: string }>('/api/tmp/full-crawl/start');
  return response.data;
}
