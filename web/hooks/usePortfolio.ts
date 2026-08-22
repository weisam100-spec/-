"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { HoldingItem } from "@/lib/types/stock";

const STORAGE_KEY = "ai-tw-stock.portfolio.v1";
const listeners = new Set<() => void>();

function readFromStorage(): HoldingItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as HoldingItem[]) : [];
  } catch {
    return [];
  }
}

let cache: HoldingItem[] = readFromStorage();

// Must be a single stable reference — a fresh [] literal on every call
// makes useSyncExternalStore think the snapshot changed every render,
// which React detects and errors out on ("should be cached to avoid an
// infinite loop").
const EMPTY: HoldingItem[] = [];

function writeToStorage(items: HoldingItem[]) {
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

function getServerSnapshot(): HoldingItem[] {
  return EMPTY;
}

const noopSubscribe = () => () => {};

export function usePortfolio() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );

  const add = useCallback(
    (holding: Omit<HoldingItem, "addedAt">) => {
      if (cache.some((i) => i.symbol === holding.symbol)) return;
      writeToStorage([...cache, { ...holding, addedAt: new Date().toISOString() }]);
    },
    []
  );

  const update = useCallback((symbol: string, patch: Partial<HoldingItem>) => {
    writeToStorage(cache.map((i) => (i.symbol === symbol ? { ...i, ...patch } : i)));
  }, []);

  const remove = useCallback((symbol: string) => {
    writeToStorage(cache.filter((i) => i.symbol !== symbol));
  }, []);

  return { items, hydrated, add, update, remove };
}
