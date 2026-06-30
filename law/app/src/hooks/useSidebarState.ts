import { useCallback, useEffect, useState } from 'react';
import { readJson, writeJson } from '@/lib/storage';

const KEY = 'lawHubSidebar';

interface Persisted {
  expandedGroups: string[];
  expandedJurs: string[];
}

const EMPTY: Persisted = { expandedGroups: [], expandedJurs: [] };

export function useSidebarState() {
  const [state, setState] = useState<Persisted>(() => {
    const raw = readJson<Partial<Persisted> | null>(KEY, null);
    return {
      expandedGroups: Array.isArray(raw?.expandedGroups) ? raw!.expandedGroups : EMPTY.expandedGroups,
      expandedJurs: Array.isArray(raw?.expandedJurs) ? raw!.expandedJurs : EMPTY.expandedJurs,
    };
  });

  useEffect(() => {
    writeJson(KEY, state);
  }, [state]);

  const toggleGroup = useCallback((groupKey: string) => {
    setState((prev) => {
      const has = prev.expandedGroups.includes(groupKey);
      return {
        ...prev,
        expandedGroups: has
          ? prev.expandedGroups.filter((g) => g !== groupKey)
          : [...prev.expandedGroups, groupKey],
      };
    });
  }, []);

  const toggleJur = useCallback((jurId: string) => {
    setState((prev) => {
      const has = prev.expandedJurs.includes(jurId);
      return {
        ...prev,
        expandedJurs: has
          ? prev.expandedJurs.filter((j) => j !== jurId)
          : [...prev.expandedJurs, jurId],
      };
    });
  }, []);

  const expandedGroupsSet = new Set(state.expandedGroups);
  const expandedJursSet = new Set(state.expandedJurs);

  return {
    expandedGroups: expandedGroupsSet,
    expandedJurs: expandedJursSet,
    toggleGroup,
    toggleJur,
  };
}
