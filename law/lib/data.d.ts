// Ambient types for the framework-agnostic ESM data layer at law/lib/data.js.
// Sourced from docs/API_CONTRACT.md; keep in sync when the contract changes.
// TypeScript pairs this with data.js automatically via the file-name companion rule.

export type NodeStatus = 'active' | 'repealed' | 'reserved';
export type LawType = 'statute' | 'regulation' | 'ordinance';

export interface CorpusMeta {
  jurisdictionId: string;
  name: string;
  type: string;
  jurisdiction: string;
  lawType: LawType | string;
  corpus: string;
  sourceUrl?: string;
  nodeCount: number;
  sectionCount: number;
}

export interface NodeSource {
  via: string;
  publisher: string;
  sourceUrl: string;
  license: string;
  retrievedAt: string;
  lastCrawled?: string;
  permalink?: string;
}

export interface LiteNode {
  id: string;
  citation?: string | null;
  heading?: string | null;
  designation?: string | null;
  structureType?: string | null;
}

export interface LawNode extends LiteNode {
  kind: 'section' | 'container';
  structureType: string;
  parentId?: string | null;
  ancestors?: LiteNode[];
  depth?: number;
  sortKey?: string;
  status: NodeStatus;
  text?: string;
  textFormat?: 'plain' | 'html' | 'markdown';
  html?: string;
  source?: NodeSource;
}

export interface EnrichedNode extends LawNode {
  breadcrumb: LiteNode[];
  parent: LiteNode | null;
  prevSibling: LiteNode | null;
  nextSibling: LiteNode | null;
}

export interface TocNode extends LiteNode {
  children?: TocNode[];
}

export interface SearchDoc {
  id: string;
  jurId: string;
  citation?: string;
  heading?: string;
  lawType?: LawType | string;
  status?: NodeStatus;
  excerpt?: string;
}

export interface SearchOptions {
  jurisdiction?: string;
  lawType?: LawType | string;
  status?: NodeStatus;
  jurId?: string;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  total: number;
  results: SearchDoc[];
  query: string;
  filters: SearchOptions;
}

export interface SavedItem {
  nodeId: string;
  note: string | null;
  tags: string[];
  citation: string | null;
  heading: string | null;
  savedAt: string;
}

export interface Annotation {
  id: string;
  nodeId: string;
  quote: string | null;
  note: string | null;
  range: unknown;
  createdAt: string;
}

export type SubscriptionType = 'node' | 'corpus' | 'search';

export interface Subscription {
  id: string;
  type: SubscriptionType;
  target: string;
  label: string | null;
  createdAt: string;
}

export interface AlertsFeed {
  count: number;
  items: Array<{
    id: string;
    type: string;
    title: string;
    date: string;
    nodeId?: string;
  }>;
}

export interface UserStore {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
}

export interface CreateLawDataOptions {
  baseUrl?: string;
  fetchJson?: (url: string) => Promise<unknown>;
  userStore?: UserStore;
}

export interface LawData {
  listJurisdictions(): Promise<{ count: number; items: CorpusMeta[] }>;
  getJurisdiction(jurId: string): Promise<CorpusMeta | null>;
  getToc(jurId: string): Promise<TocNode[]>;
  getChildren(nodeId: string): Promise<LawNode[]>;
  getNode(nodeId: string): Promise<EnrichedNode | null>;
  search(query: string, options?: SearchOptions): Promise<SearchResult>;

  listSaved(): SavedItem[];
  isSaved(nodeId: string): boolean;
  save(
    nodeId: string,
    opts?: { note?: string | null; tags?: string[]; citation?: string | null; heading?: string | null }
  ): SavedItem[];
  unsave(nodeId: string): SavedItem[];

  listAnnotations(nodeId?: string): Annotation[];
  addAnnotation(
    nodeId: string,
    opts?: { quote?: string | null; note?: string | null; range?: unknown }
  ): Annotation;
  removeAnnotation(id: string): Annotation[];

  listSubscriptions(): Subscription[];
  subscribe(opts: { type: SubscriptionType; target: string; label?: string | null }): Subscription;
  unsubscribe(id: string): Subscription[];
  getAlertsFeed(): Promise<AlertsFeed>;
}

export function createLawData(opts?: CreateLawDataOptions): LawData;
declare const _default: typeof createLawData;
export default _default;
