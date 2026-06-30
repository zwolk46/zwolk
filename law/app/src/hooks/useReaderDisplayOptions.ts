import { useCallback, useEffect, useState } from 'react';
import { readJson, writeJson } from '@/lib/storage';

const KEY = 'lawHubReader';

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

export function useReaderDisplayOptions() {
  const [opts, setOpts] = useState<ReaderDisplayOptions>(() =>
    sanitize(readJson<Partial<ReaderDisplayOptions> | null>(KEY, null))
  );

  useEffect(() => {
    writeJson(KEY, opts);
  }, [opts]);

  const setFontSize = useCallback(
    (v: ReaderFontSize) => setOpts((prev) => ({ ...prev, fontSize: v })),
    []
  );
  const setMeasure = useCallback(
    (v: ReaderMeasure) => setOpts((prev) => ({ ...prev, measure: v })),
    []
  );

  return { ...opts, setFontSize, setMeasure };
}
