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
  workerCount?: number;
}

export interface TmpFullCrawlStatus {
  target: number;
  totalSaved: number;
  missingToTarget: number;
  detailDone: number;
  detailPending: number;
  progressPercent: number;
  pagePercent: number;
  speedPerSecond: number;
  insertPerSecond: number;
  processedItems: number;
  elapsedSeconds: number;
  workerCount: number;
  latestLog: TmpFullCrawlLog | null;
}

export interface TmpFullCrawlActionResponse {
  success: boolean;
  message: string;
}

export async function getTmpFullCrawlStatus(): Promise<TmpFullCrawlStatus> {
  const response = await httpClient.get<TmpFullCrawlStatus>('/api/tmp/full-crawl/status');
  return response.data;
}

export async function startTmpFullCrawl(): Promise<TmpFullCrawlActionResponse> {
  const response = await httpClient.post<TmpFullCrawlActionResponse>('/api/tmp/full-crawl/start');
  return response.data;
}

export async function continueTmpFullCrawl(): Promise<TmpFullCrawlActionResponse> {
  const response = await httpClient.post<TmpFullCrawlActionResponse>('/api/tmp/full-crawl/continue');
  return response.data;
}
