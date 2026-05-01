import path from "node:path";
import fs from "node:fs/promises";
import yaml from "js-yaml";
import * as XLSX from "xlsx";
export const builtinDataConverter = {
    id: "builtin-data",
    label: "Built-in (Data)",
    description: "JSON↔YAML and CSV↔XLSX conversions implemented in JS.",
    availability: async () => ({ ok: true }),
    supports: (from, to) => {
        if (from === to)
            return false;
        if (from === "json" && to === "yaml")
            return true;
        if (from === "yaml" && to === "json")
            return true;
        if (from === "csv" && to === "xlsx")
            return true;
        if (from === "xlsx" && to === "csv")
            return true;
        return false;
    },
    convert: async ({ inputPath, originalFilename, from, to, outputDir }) => {
        const base = safeBasename(originalFilename);
        const outputFilename = `${base}.${to}`;
        const outputPath = path.join(outputDir, outputFilename);
        if (from === "json" && to === "yaml") {
            const raw = await fs.readFile(inputPath, "utf8");
            const obj = JSON.parse(raw);
            const out = yaml.dump(obj, { noRefs: true, lineWidth: 120 });
            await fs.writeFile(outputPath, out, "utf8");
            return { outputPath, outputFilename };
        }
        if (from === "yaml" && to === "json") {
            const raw = await fs.readFile(inputPath, "utf8");
            const obj = yaml.load(raw);
            const out = JSON.stringify(obj, null, 2) + "\n";
            await fs.writeFile(outputPath, out, "utf8");
            return { outputPath, outputFilename };
        }
        if (from === "csv" && to === "xlsx") {
            const raw = await fs.readFile(inputPath, "utf8");
            const ws = XLSX.utils.aoa_to_sheet(parseCsv(raw));
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
            XLSX.writeFile(wb, outputPath);
            return { outputPath, outputFilename };
        }
        if (from === "xlsx" && to === "csv") {
            const wb = XLSX.readFile(inputPath);
            const firstName = wb.SheetNames[0];
            if (!firstName)
                throw new Error("XLSX has no sheets");
            const ws = wb.Sheets[firstName];
            const csv = XLSX.utils.sheet_to_csv(ws);
            await fs.writeFile(outputPath, csv, "utf8");
            return { outputPath, outputFilename };
        }
        throw new Error(`Built-in converter does not support ${from} -> ${to}`);
    }
};
function safeBasename(filename) {
    const base = path.parse(filename).name || "output";
    return base.replaceAll(/[^a-zA-Z0-9._-]/g, "_").slice(0, 160) || "output";
}
function parseCsv(raw) {
    // Minimal CSV parser: handles quoted fields and commas/newlines.
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;
    for (let i = 0; i < raw.length; i++) {
        const ch = raw[i];
        if (inQuotes) {
            if (ch === '"') {
                const next = raw[i + 1];
                if (next === '"') {
                    field += '"';
                    i++;
                }
                else {
                    inQuotes = false;
                }
            }
            else {
                field += ch;
            }
            continue;
        }
        if (ch === '"') {
            inQuotes = true;
            continue;
        }
        if (ch === ",") {
            row.push(field);
            field = "";
            continue;
        }
        if (ch === "\n") {
            row.push(field);
            field = "";
            rows.push(row);
            row = [];
            continue;
        }
        if (ch === "\r")
            continue;
        field += ch;
    }
    row.push(field);
    rows.push(row);
    return rows;
}
