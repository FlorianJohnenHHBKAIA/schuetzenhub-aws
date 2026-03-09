// IndexedDB Cache Layer for Offline Support
// Provides persistent storage for API responses

const DB_NAME = "schuetzenhub_cache";
const DB_VERSION = 1;
const STORE_NAME = "api_cache";

interface CacheEntry {
  key: string;
  data: unknown;
  timestamp: number;
  expiresAt?: number;
}

let db: IDBDatabase | null = null;

// Initialize IndexedDB
async function initDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.warn("IndexedDB not available, falling back to localStorage");
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
  });
}

// Check if IndexedDB is available
function isIndexedDBAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined";
  } catch {
    return false;
  }
}

// Get from cache (IndexedDB or localStorage fallback)
export async function getFromCache<T>(key: string): Promise<T | null> {
  try {
    if (isIndexedDBAvailable()) {
      const database = await initDB();
      return new Promise((resolve) => {
        const transaction = database.transaction(STORE_NAME, "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);

        request.onsuccess = () => {
          const entry = request.result as CacheEntry | undefined;
          if (entry) {
            // Check if expired
            if (entry.expiresAt && Date.now() > entry.expiresAt) {
              resolve(null);
              return;
            }
            resolve(entry.data as T);
          } else {
            resolve(null);
          }
        };

        request.onerror = () => {
          console.warn("IndexedDB read failed, trying localStorage");
          resolve(getFromLocalStorage(key));
        };
      });
    } else {
      return getFromLocalStorage(key);
    }
  } catch {
    return getFromLocalStorage(key);
  }
}

// Set to cache (IndexedDB or localStorage fallback)
export async function setToCache<T>(
  key: string,
  data: T,
  ttlMinutes?: number
): Promise<void> {
  const entry: CacheEntry = {
    key,
    data,
    timestamp: Date.now(),
    expiresAt: ttlMinutes ? Date.now() + ttlMinutes * 60 * 1000 : undefined,
  };

  try {
    if (isIndexedDBAvailable()) {
      const database = await initDB();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(entry);

        request.onsuccess = () => resolve();
        request.onerror = () => {
          console.warn("IndexedDB write failed, trying localStorage");
          setToLocalStorage(key, data);
          resolve();
        };
      });
    } else {
      setToLocalStorage(key, data);
    }
  } catch {
    setToLocalStorage(key, data);
  }
}

// Remove from cache
export async function removeFromCache(key: string): Promise<void> {
  try {
    if (isIndexedDBAvailable()) {
      const database = await initDB();
      return new Promise((resolve) => {
        const transaction = database.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        store.delete(key);
        resolve();
      });
    }
    localStorage.removeItem(`cache_${key}`);
  } catch {
    localStorage.removeItem(`cache_${key}`);
  }
}

// Clear all cache
export async function clearCache(): Promise<void> {
  try {
    if (isIndexedDBAvailable()) {
      const database = await initDB();
      return new Promise((resolve) => {
        const transaction = database.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        store.clear();
        resolve();
      });
    }
    // Clear localStorage cache keys
    Object.keys(localStorage)
      .filter((key) => key.startsWith("cache_"))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    // Silent fail
  }
}

// LocalStorage fallbacks
function getFromLocalStorage<T>(key: string): T | null {
  try {
    const item = localStorage.getItem(`cache_${key}`);
    if (!item) return null;
    const entry = JSON.parse(item) as CacheEntry;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      localStorage.removeItem(`cache_${key}`);
      return null;
    }
    return entry.data as T;
  } catch {
    return null;
  }
}

function setToLocalStorage<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry = {
      key,
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(`cache_${key}`, JSON.stringify(entry));
  } catch {
    // localStorage might be full, try to clear old entries
    console.warn("localStorage write failed");
  }
}

// Cache key generators
export const CacheKeys = {
  eventsList: (clubId: string) => `events_list_${clubId}`,
  eventDetail: (eventId: string) => `event_detail_${eventId}`,
  workshiftsByEvent: (eventId: string) => `workshifts_by_event_${eventId}`,
  postsList: (clubId: string) => `posts_list_${clubId}`,
  postDetail: (postId: string) => `post_detail_${postId}`,
  notifications: (memberId: string) => `notifications_${memberId}`,
  members: (clubId: string) => `members_${clubId}`,
  companies: (clubId: string) => `companies_${clubId}`,
};
