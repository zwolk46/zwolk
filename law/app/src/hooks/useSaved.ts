import { useEffect, useState, useCallback } from 'react';
import type { SavedItem } from '@/lib/law-data';
import { law } from '@/lib/lawClient';

// Cross-component sync: any save/unsave dispatches a custom event so other
// mounted consumers (Library page, SaveButton on a different section) update
// without manual coordination.
const EVENT = 'law:saved-changed';

function emit() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT));
  }
}

export function useSaved() {
  const [items, setItems] = useState<SavedItem[]>(() => law.listSaved());

  useEffect(() => {
    const refresh = () => setItems(law.listSaved());
    window.addEventListener(EVENT, refresh);
    window.addEventListener('storage', refresh); // sync across tabs
    refresh();
    return () => {
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const save = useCallback(
    (
      nodeId: string,
      opts?: {
        note?: string | null;
        tags?: string[];
        citation?: string | null;
        heading?: string | null;
      }
    ) => {
      law.save(nodeId, opts);
      emit();
    },
    []
  );

  const unsave = useCallback((nodeId: string) => {
    law.unsave(nodeId);
    emit();
  }, []);

  const isSaved = useCallback((nodeId: string) => items.some((s) => s.nodeId === nodeId), [items]);

  return { items, isSaved, save, unsave };
}
