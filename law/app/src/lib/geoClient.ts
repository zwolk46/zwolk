// Singleton geo data-layer client. Mirrors lawClient — in prod talks to the
// auth-gated /api/law/* proxy (which serves blob keys at coverage/* and geo/*);
// in dev talks to the Vite middleware that serves /law/data/* from disk.

import { createGeo } from '../../../lib/geo.js';

const DEFAULT_BASE = import.meta.env.PROD ? '/api/law' : '/law/data';

export const geo = createGeo({ baseUrl: DEFAULT_BASE });
