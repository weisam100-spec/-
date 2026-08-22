"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { WatchlistItem } from "@/lib/types/stock";

const STORAGE_KEY = "ai-tw-stock.watchlist.v1";
const listeners = new Set<() => void>();

function readFromStorage(): WatchlistItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as WatchlistItem[]) : [];
  } catch {
    return [];
  }
}

// Module-level cache so useSyncExternalStore's getSnapshot can return a
// stable reference between renders (required to avoid re-render loops),
// updated only when the watchlist actually changes.
let cache: WatchlistItem[] = readFromStorage();

// Must be a single stable reference — a fresh [] literal on every call
// makes useSyncExternalStore think the snapshot changed every render,
// which React detects and errors out on ("should be cached to avoid an
// infinite loop").
const EMPTY: WatchlistItem[] = [];

function writeToStorage(items: WatchlistItem[]) {
  cache = items;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }
  listeners.forEach((listener) => listener());
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot() {
  return cache;
}

function getServerSnapshot(): WatchlistItem[] {
  return EMPTY;
}

const noopSubscribe = () => () => {};

export function useWatchlist() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Standard "has hydrated on the client" flag via useSyncExternalStore,
  // so it flips from false -> true after hydration without a manual
  // effect (React matches the server snapshot on the hydration pass,
  // then re-renders with the client snapshot right after).
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );

  const add = useCallback((symbol: string, name: string) => {
    if (cache.some((i) => i.symbol === symbol)) return;
    writeToStorage([...cache, { symbol, name, addedAt: new Date().toISOString() }]);
  }, []);

  const remove = useCallback((symbol: string) => {
    writeToStorage(cache.filter((i) => i.symbol !== symbol));
  }, []);

  const isWatched = useCallback(
    (symbol: string) => items.some((i) => i.symbol === symbol),
    [items]
  );

  const toggle = useCallback(
    (symbol: string, name: string) => {
      if (isWatched(symbol)) remove(symbol);
      else add(symbol, name);
    },
    [isWatched, add, remove]
  );

  return { items, hydrated, add, remove, toggle, isWatched };
}
