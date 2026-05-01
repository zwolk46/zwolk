import { listFormats, inferFormatFromFilename } from "./formats.js";
import { ALL_CONVERTERS } from "./converters/index.js";
let cached = null;
export async function getCapabilities() {
    const now = Date.now();
    if (cached && now - cached.at < 30_000)
        return cached.value;
    const formats = listFormats();
    const converters = [];
    for (const c of ALL_CONVERTERS) {
        const availability = await c.availability();
        const pairs = [];
        if (availability.ok) {
            for (const f of formats) {
                for (const t of formats) {
                    if (c.supports(f.id, t.id))
                        pairs.push({ from: f.id, to: t.id });
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
    const value = { formats, converters };
    cached = { at: now, value };
    return value;
}
export function getTargetsForFilename(filename) {
    const from = inferFormatFromFilename(filename);
    if (!from)
        return { from: null, targets: [] };
    const targets = new Set();
    // Availability check requires async; keep this endpoint “best effort” by using declared support only.
    // The UI uses /api/capabilities for the authoritative list.
    for (const c of ALL_CONVERTERS) {
        for (const t of listFormats()) {
            if (c.supports(from, t.id))
                targets.add(t.id);
        }
    }
    return { from, targets: [...targets].sort() };
}
