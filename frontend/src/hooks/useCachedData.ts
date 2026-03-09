import { useEffect, useState, useCallback } from "react";
import { getFromCache, setToCache, CacheKeys } from "@/lib/offlineCache";

interface UseCachedDataOptions<T> {
  cacheKey: string;
  fetchFn: () => Promise<T>;
  ttlMinutes?: number;
  enabled?: boolean;
}

interface UseCachedDataResult<T> {
  data: T | null;
  isLoading: boolean;
  isFromCache: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useCachedData<T>({
  cacheKey,
  fetchFn,
  ttlMinutes = 60,
  enabled = true,
}: UseCachedDataOptions<T>): UseCachedDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFromCache, setIsFromCache] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadData = useCallback(async () => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    // First, try to load from cache for instant display
    try {
      const cached = await getFromCache<T>(cacheKey);
      if (cached) {
        setData(cached);
        setIsFromCache(true);
        setIsLoading(false);
      }
    } catch (e) {
      console.warn("Cache read failed:", e);
    }

    // Then, if online, fetch fresh data
    if (navigator.onLine) {
      try {
        const freshData = await fetchFn();
        setData(freshData);
        setIsFromCache(false);
        setError(null);
        
        // Update cache
        await setToCache(cacheKey, freshData, ttlMinutes);
      } catch (e) {
        // If we have cached data, don't show error
        if (!data) {
          setError(e instanceof Error ? e : new Error("Fetch failed"));
        }
      }
    } else if (!data) {
      // We're offline and have no cached data
      setError(new Error("offline_no_cache"));
    }

    setIsLoading(false);
  }, [cacheKey, fetchFn, ttlMinutes, enabled, data]);

  useEffect(() => {
    loadData();
  }, [cacheKey, enabled]);

  // Refetch when coming back online
  useEffect(() => {
    const handleOnline = () => {
      if (enabled) {
        loadData();
      }
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [loadData, enabled]);

  return {
    data,
    isLoading: isLoading && !data, // Only show loading if we don't have cached data
    isFromCache,
    error,
    refetch: loadData,
  };
}

// Export cache keys for convenience
export { CacheKeys };
