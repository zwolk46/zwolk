import fs from "node:fs/promises";
import path from "node:path";
import { constants as FS_CONSTANTS } from "node:fs";
export async function findExecutable(candidates) {
    const envPath = process.env.PATH || "";
    const pathEntries = envPath.split(path.delimiter).filter(Boolean);
    const suffixes = process.platform === "win32" ? (process.env.PATHEXT || ".EXE").split(";") : [""];
    for (const name of candidates) {
        if (name.includes(path.sep)) {
            if (await isExecutable(name))
                return name;
            continue;
        }
        for (const dir of pathEntries) {
            for (const suf of suffixes) {
                const full = path.join(dir, process.platform === "win32" ? name + suf : name);
                if (await isExecutable(full))
                    return full;
            }
        }
    }
    return null;
}
async function isExecutable(filePath) {
    try {
        const mode = process.platform === "win32" ? FS_CONSTANTS.F_OK : FS_CONSTANTS.X_OK;
        await fs.access(filePath, mode);
        return true;
    }
    catch {
        return false;
    }
}
