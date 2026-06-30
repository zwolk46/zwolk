// Thin re-export of the framework-agnostic data layer at law/lib/data.js.
// The .d.ts at law/lib/data.d.ts provides the types; no allowJs required.

export { createLawData } from '../../../lib/data.js';
export type {
  LawData,
  CorpusMeta,
  LawNode,
  EnrichedNode,
  TocNode,
  SearchDoc,
  SearchOptions,
  SearchResult,
  SavedItem,
  Annotation,
  Subscription,
  AlertsFeed,
  NodeStatus,
  LawType,
  UserStore,
  CreateLawDataOptions,
} from '../../../lib/data.js';
