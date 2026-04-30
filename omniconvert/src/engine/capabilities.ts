import type { ConverterAvailability, FormatId } from "./types.js";
import { listFormats, inferFormatFromFilename } from "./formats.js";
import { ALL_CONVERTERS } from "./converters/index.js";

type Capabilities = {
  formats: ReturnType<typeof listFormats>;
  converters: Array<{
    id: string;
    label: string;
    description: string;
    availability: ConverterAvailability;
    pairs: Array<{ from: FormatId; to: FormatId }>;
  }>;
};

let cached: { at: number; value: Capabilities } | null = null;

export async function getCapabilities(): Promise<Capabilities> {
  const now = Date.now();
  if (cached && now - cached.at < 30_000) return cached.value;

  const formats = listFormats();
  const converters = [];

  for (const c of ALL_CONVERTERS) {
    const availability = await c.availability();
    const pairs: Array<{ from: FormatId; to: FormatId }> = [];
    if (availability.ok) {
      for (const f of formats) {
        for (const t of formats) {
          if (c.supports(f.id, t.id)) pairs.push({ from: f.id, to: t.id });
        }
      }
    }
    converters.push({
      id: c.id,
      label: c.label,
      description: c.description,
      availability,
      pairs
    });
  }

  const value: Capabilities = { formats, converters };
  cached = { at: now, value };
  return value;
}

export function getTargetsForFilename(filename: string): { from: FormatId | null; targets: FormatId[] } {
  const from = inferFormatFromFilename(filename);
  if (!from) return { from: null, targets: [] };

  const targets = new Set<FormatId>();
  // Availability check requires async; keep this endpoint “best effort” by using declared support only.
  // The UI uses /api/capabilities for the authoritative list.
  for (const c of ALL_CONVERTERS) {
    for (const t of listFormats()) {
      if (c.supports(from, t.id)) targets.add(t.id);
    }
  }
  return { from, targets: [...targets].sort() };
}

