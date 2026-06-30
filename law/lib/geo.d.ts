// Ambient types for the framework-agnostic ESM geo/map layer at law/lib/geo.js.
// Sourced from docs/MAP_GEO.md; keep in sync when the contract changes.
// TypeScript pairs this with geo.js automatically via the file-name companion rule.

export interface StateRec {
  fips: string;   // 2-digit
  usps: string;   // 2-letter postal code
  name: string;
}

export const STATES: StateRec[];

export const TOPO: {
  nation: string;
  states: string;
  counties: string;
};

export function stateByFips(fips: string | number): StateRec | null;
export function stateByUsps(usps: string): StateRec | null;
export function stateOf(fips: string | number): string;

export type CoverageStatus =
  | 'ingested'
  | 'available'
  | 'gap-no-source'
  | 'gap-unprobed'
  | 'governed-by-parent'
  | null;

export interface CoverageSummary {
  national: { pctIngested: number; states: number } | null;
  states: Record<string, { pctIngested?: number; pctAvailable?: number; places?: number }>;
}

export interface StateCoverage {
  places: Array<{
    fips: string;
    name?: string;
    status: CoverageStatus;
    jurisdictionId?: string;
    lastChecked?: string;
  }>;
}

export interface CreateGeoOptions {
  baseUrl?: string;
  fetchJson?: (url: string) => Promise<unknown>;
}

export interface Geo {
  STATES: StateRec[];
  TOPO: typeof TOPO;
  stateByFips: typeof stateByFips;
  stateByUsps: typeof stateByUsps;
  stateOf: typeof stateOf;
  statesTopoUrl(): string;
  countiesTopoUrl(): string;
  nationTopoUrl(): string;
  placesTopoUrl(usps: string): string;
  coverageSummary(): Promise<CoverageSummary>;
  coverageForState(usps: string): Promise<StateCoverage>;
  statusForFips(fips: string | number): Promise<CoverageStatus>;
  jurisdictionsForFips(fips: string | number): Promise<string[]>;
}

export function createGeo(opts?: CreateGeoOptions): Geo;
declare const _default: typeof createGeo;
export default _default;
