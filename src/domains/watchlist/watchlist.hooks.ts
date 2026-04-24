import { useState, useEffect } from 'react';

export interface WatchlistItem {
  id: number;
  name: string;
  type: string;
  relistCount: number;
  firstPrice: number;
  latestPrice: number;
  priceDropPercent: number;
  publishedAt: string;
  url: string;
}

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('auction_watchlist');
      if (saved) {
        setWatchlist(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to parse watchlist", e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const toggleWatch = (item: WatchlistItem) => {
    setWatchlist((prev) => {
      const exists = prev.find((w) => w.id === item.id);
      let updated;
      if (exists) {
        updated = prev.filter((w) => w.id !== item.id);
      } else {
        updated = [...prev, item];
      }
      localStorage.setItem('auction_watchlist', JSON.stringify(updated));
      return updated;
    });
  };

  const isWatched = (id: number) => {
    return watchlist.some((w) => w.id === id);
  };

  return { watchlist, toggleWatch, isWatched, isLoaded };
}
