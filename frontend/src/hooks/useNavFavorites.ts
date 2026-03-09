import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";

const MAX_FAVORITES = 5;

export function useNavFavorites() {
  const { member, user } = useAuth();
  const [favorites, setFavorites] = useState<string[]>([]);

  const getStorageKey = useCallback(() => {
    if (!member?.club_id || !user?.id) return null;
    return `nav_favorites:${member.club_id}:${user.id}`;
  }, [member?.club_id, user?.id]);

  // Load favorites from localStorage
  useEffect(() => {
    const key = getStorageKey();
    if (!key) return;

    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setFavorites(parsed.slice(0, MAX_FAVORITES));
        }
      } catch {
        setFavorites([]);
      }
    }
  }, [getStorageKey]);

  const addFavorite = useCallback((href: string) => {
    const key = getStorageKey();
    if (!key) return;

    setFavorites((prev) => {
      if (prev.includes(href)) return prev;
      const updated = [href, ...prev].slice(0, MAX_FAVORITES);
      localStorage.setItem(key, JSON.stringify(updated));
      return updated;
    });
  }, [getStorageKey]);

  const removeFavorite = useCallback((href: string) => {
    const key = getStorageKey();
    if (!key) return;

    setFavorites((prev) => {
      const updated = prev.filter((f) => f !== href);
      localStorage.setItem(key, JSON.stringify(updated));
      return updated;
    });
  }, [getStorageKey]);

  const toggleFavorite = useCallback((href: string) => {
    if (favorites.includes(href)) {
      removeFavorite(href);
    } else {
      addFavorite(href);
    }
  }, [favorites, addFavorite, removeFavorite]);

  const isFavorite = useCallback((href: string) => {
    return favorites.includes(href);
  }, [favorites]);

  const canAddMore = favorites.length < MAX_FAVORITES;

  return {
    favorites,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    isFavorite,
    canAddMore,
    maxFavorites: MAX_FAVORITES,
  };
}
