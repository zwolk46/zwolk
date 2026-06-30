// Singleton data-layer client + a corpus cache for the linkifier.
// The linkifier needs to look up a citation string against a corpus's
// `nodesById` map to find the corresponding nodeId. The public data layer
// doesn't expose that map, so we keep a parallel cache here populated by a
// direct fetch of the same corpus JSON. The duplicate memory cost is
// per-corpus-once and only kicks in when the user actually opens a reader in
// that corpus.

import { createLawData } from '../../../lib/data.js';

// In prod the SPA is at /law and the data layer talks to the auth-gated proxy
// at /api/law/<path>. In dev, the Vite middleware serves /law/data/index/* from
// disk so the existing default still works.
const DEFAULT_BASE = import.meta.env.PROD ? '/api/law' : '/law/data/index';

export const law = createLawData({ baseUrl: DEFAULT_BASE });

interface NodeLike {
  id: string;
  citation?: string | null;
  kind?: 'section' | 'container';
  parentId?: string | null;
}

export interface CorpusLike {
  nodesById: Record<string, NodeLike>;
}

const promiseCache = new Map<string, Promise<CorpusLike | null>>();
const syncCache = new Map<string, CorpusLike | null>();

export function loadCorpus(jurId: string): Promise<CorpusLike | null> {
  let p = promiseCache.get(jurId);
  if (!p) {
    p = (async () => {
      try {
        const res = await fetch(`/law/data/index/jur/${jurId}.json`);
        if (!res.ok) return null;
        return (await res.json()) as CorpusLike;
      } catch {
        return null;
      }
    })();
    promiseCache.set(jurId, p);
    p.then((corpus) => syncCache.set(jurId, corpus));
  }
  return p;
}

// Returns the corpus only if its load promise has already resolved. Used by
// the linkifier on the synchronous render path.
export function getLoadedCorpusSync(jurId: string): CorpusLike | null {
  return syncCache.get(jurId) ?? null;
}
