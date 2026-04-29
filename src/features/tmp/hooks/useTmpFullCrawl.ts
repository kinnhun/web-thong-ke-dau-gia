import { useCallback, useEffect, useState } from 'react';
import {
  getTmpFullCrawlStatus,
  startTmpFullCrawl,
  type TmpFullCrawlStatus,
} from '@/services/tmp-full-crawl.service';

export function useTmpFullCrawl() {
  const [status, setStatus] = useState<TmpFullCrawlStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await getTmpFullCrawlStatus();
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

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return { status, isLoading, isStarting, error, notice, refresh, start };
}
