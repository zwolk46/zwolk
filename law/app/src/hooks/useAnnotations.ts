import { useEffect, useState, useCallback } from 'react';
import type { Annotation } from '@/lib/law-data';
import { law } from '@/lib/lawClient';

const EVENT = 'law:annotations-changed';

function emit() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT));
  }
}

export function useAnnotations(nodeId?: string | null) {
  const [items, setItems] = useState<Annotation[]>(() =>
    law.listAnnotations(nodeId || undefined)
  );

  useEffect(() => {
    const refresh = () => setItems(law.listAnnotations(nodeId || undefined));
    window.addEventListener(EVENT, refresh);
    window.addEventListener('storage', refresh);
    refresh();
    return () => {
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [nodeId]);

  const add = useCallback(
    (id: string, opts?: { quote?: string | null; note?: string | null; range?: unknown }) => {
      const ann = law.addAnnotation(id, opts);
      emit();
      return ann;
    },
    []
  );

  const remove = useCallback((id: string) => {
    law.removeAnnotation(id);
    emit();
  }, []);

  return { items, add, remove };
}
