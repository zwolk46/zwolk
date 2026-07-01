import { useCallback, useEffect, useState } from 'react';
import { readJson, writeJson } from '@/lib/storage';

const KEY = 'lawHubReader';
const EVENT = 'law:reader-options-changed';

export type ReaderFontSize = 14 | 16 | 18 | 20;
export type ReaderMeasure = 60 | 68 | 78;

export interface ReaderDisplayOptions {
  fontSize: ReaderFontSize;
  measure: ReaderMeasure;
}

const DEFAULTS: ReaderDisplayOptions = { fontSize: 18, measure: 68 };

function sanitize(raw: Partial<ReaderDisplayOptions> | null): ReaderDisplayOptions {
  if (!raw || typeof raw !== 'object') return DEFAULTS;
  const fontSize: ReaderFontSize = ([14, 16, 18, 20] as const).includes(
    raw.fontSize as ReaderFontSize
  )
    ? (raw.fontSize as ReaderFontSize)
    : DEFAULTS.fontSize;
  const measure: ReaderMeasure = ([60, 68, 78] as const).includes(
    raw.measure as ReaderMeasure
  )
    ? (raw.measure as ReaderMeasure)
    : DEFAULTS.measure;
  return { fontSize, measure };
}

function emit() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT));
  }
}

// Every caller of this hook gets its own useState, so without cross-component
// sync the DisplayOptionsPopover would update its own copy + localStorage
// while the ReaderBody's copy (in a different component tree) never sees the
// change. Follow the useSaved/useAnnotations pattern: dispatch a CustomEvent
// on write; every mounted subscriber refreshes from storage.
export function useReaderDisplayOptions() {
  const [opts, setOpts] = useState<ReaderDisplayOptions>(() =>
    sanitize(readJson<Partial<ReaderDisplayOptions> | null>(KEY, null))
  );

  useEffect(() => {
    const refresh = () =>
      setOpts(sanitize(readJson<Partial<ReaderDisplayOptions> | null>(KEY, null)));
    window.addEventListener(EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const setFontSize = useCallback((v: ReaderFontSize) => {
    setOpts((prev) => {
      const next = { ...prev, fontSize: v };
      writeJson(KEY, next);
      return next;
    });
    emit();
  }, []);
  const setMeasure = useCallback((v: ReaderMeasure) => {
    setOpts((prev) => {
      const next = { ...prev, measure: v };
      writeJson(KEY, next);
      return next;
    });
    emit();
  }, []);

  return { ...opts, setFontSize, setMeasure };
}
