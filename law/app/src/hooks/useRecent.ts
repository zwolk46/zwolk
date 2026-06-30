import { useEffect, useState } from 'react';
import { readJson, writeJson } from '@/lib/storage';

const KEY = 'lawHubRecent';
const MAX = 25;
const EVENT = 'law:recent-changed';

export interface RecentEntry {
  nodeId: string;
  citation: string | null;
  heading: string | null;
  visitedAt: string;
}

function read(): RecentEntry[] {
  const raw = readJson<RecentEntry[]>(KEY, []);
  return Array.isArray(raw) ? raw : [];
}

function emit() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT));
  }
}

export function recordRecent(
  nodeId: string,
  citation: string | null,
  heading: string | null
): void {
  const entries = read();
  const dedup = entries.filter((e) => e.nodeId !== nodeId);
  const next: RecentEntry[] = [
    { nodeId, citation, heading, visitedAt: new Date().toISOString() },
    ...dedup,
  ].slice(0, MAX);
  writeJson(KEY, next);
  emit();
}

export function clearRecent(): void {
  writeJson(KEY, []);
  emit();
}

export function useRecent(filter?: { jurId?: string }): RecentEntry[] {
  const [items, setItems] = useState<RecentEntry[]>(() => read());

  useEffect(() => {
    const refresh = () => setItems(read());
    window.addEventListener(EVENT, refresh);
    window.addEventListener('storage', refresh);
    refresh();
    return () => {
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  if (filter?.jurId) {
    return items.filter((e) => e.nodeId.startsWith(`${filter.jurId}:`));
  }
  return items;
}
