import { useCallback, useEffect, useRef, useState } from 'react';
import {
  continueTmpFullCrawl,
  getTmpFullCrawlStatus,
  startTmpFullCrawl,
  type TmpFullCrawlStatus,
} from '@/services/tmp-full-crawl.service';

function getProcessedItems(data: TmpFullCrawlStatus) {
  const log = data.latestLog;
  return (log?.itemsInserted || 0) + (log?.itemsUpdated || 0) + (log?.itemsSkipped || 0);
}

export function useTmpFullCrawl() {
  const [status, setStatus] = useState<TmpFullCrawlStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [isContinuing, setIsContinuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const speedSnapshotRef = useRef<{ processedItems: number; insertedItems: number; checkedAt: number } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await getTmpFullCrawlStatus();
      const now = Date.now();
      const processedItems = getProcessedItems(data);
      const insertedItems = data.latestLog?.itemsInserted || 0;
      const previous = speedSnapshotRef.current;

      if (previous) {
        const elapsedSeconds = Math.max((now - previous.checkedAt) / 1000, 1);
        const processedDelta = Math.max(processedItems - previous.processedItems, 0);
        const insertedDelta = Math.max(insertedItems - previous.insertedItems, 0);

        data.speedPerSecond = Number((processedDelta / elapsedSeconds).toFixed(2));
        data.insertPerSecond = Number((insertedDelta / elapsedSeconds).toFixed(2));
      }

      speedSnapshotRef.current = { processedItems, insertedItems, checkedAt: now };
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được trạng thái crawler');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const start = useCallback(async () => {
    setIsStarting(true);
    setNotice(null);
    speedSnapshotRef.current = null;
    try {
      const result = await startTmpFullCrawl();
      setNotice(result.message);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không khởi động được full crawl');
    } finally {
      setIsStarting(false);
    }
  }, [refresh]);

  const continueCrawl = useCallback(async () => {
    setIsContinuing(true);
    setNotice(null);
    speedSnapshotRef.current = null;
    try {
      const result = await continueTmpFullCrawl();
      setNotice(result.message);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tiếp tục được full crawl');
    } finally {
      setIsContinuing(false);
    }
  }, [refresh]);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [refresh]);

  return { status, isLoading, isStarting, isContinuing, error, notice, refresh, start, continueCrawl };
}
