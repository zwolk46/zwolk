import path from "node:path";
import { fileTypeFromFile } from "file-type";
// A pragmatic, extensible list. Converters decide what is actually supported.
export const FORMATS = [
    // Images (raster)
    { id: "png", label: "PNG", extensions: ["png"], mediaType: "image" },
    { id: "jpg", label: "JPEG", extensions: ["jpg", "jpeg"], mediaType: "image" },
    { id: "webp", label: "WebP", extensions: ["webp"], mediaType: "image" },
    { id: "gif", label: "GIF", extensions: ["gif"], mediaType: "image" },
    { id: "tiff", label: "TIFF", extensions: ["tif", "tiff"], mediaType: "image" },
    { id: "bmp", label: "BMP", extensions: ["bmp"], mediaType: "image" },
    { id: "ico", label: "ICO", extensions: ["ico"], mediaType: "image" },
    { id: "heic", label: "HEIC/HEIF", extensions: ["heic", "heif"], mediaType: "image" },
    // Vector / page
    { id: "svg", label: "SVG", extensions: ["svg"], mediaType: "image" },
    { id: "pdf", label: "PDF", extensions: ["pdf"], mediaType: "document" },
    { id: "ps", label: "PostScript", extensions: ["ps"], mediaType: "document" },
    // Audio
    { id: "mp3", label: "MP3", extensions: ["mp3"], mediaType: "audio" },
    { id: "wav", label: "WAV", extensions: ["wav"], mediaType: "audio" },
    { id: "flac", label: "FLAC", extensions: ["flac"], mediaType: "audio" },
    { id: "aac", label: "AAC", extensions: ["aac"], mediaType: "audio" },
    { id: "m4a", label: "M4A", extensions: ["m4a"], mediaType: "audio" },
    { id: "ogg", label: "Ogg", extensions: ["ogg"], mediaType: "audio" },
    { id: "opus", label: "Opus", extensions: ["opus"], mediaType: "audio" },
    // Video
    { id: "mp4", label: "MP4", extensions: ["mp4"], mediaType: "video" },
    { id: "mkv", label: "MKV", extensions: ["mkv"], mediaType: "video" },
    { id: "webm", label: "WebM", extensions: ["webm"], mediaType: "video" },
    { id: "mov", label: "MOV", extensions: ["mov"], mediaType: "video" },
    { id: "avi", label: "AVI", extensions: ["avi"], mediaType: "video" },
    // Documents / markup
    { id: "txt", label: "Text", extensions: ["txt"], mediaType: "document" },
    { id: "md", label: "Markdown", extensions: ["md", "markdown"], mediaType: "document" },
    { id: "html", label: "HTML", extensions: ["html", "htm"], mediaType: "document" },
    { id: "rtf", label: "RTF", extensions: ["rtf"], mediaType: "document" },
    { id: "docx", label: "DOCX", extensions: ["docx"], mediaType: "document" },
    { id: "odt", label: "ODT", extensions: ["odt"], mediaType: "document" },
    { id: "pptx", label: "PPTX", extensions: ["pptx"], mediaType: "document" },
    { id: "xlsx", label: "XLSX", extensions: ["xlsx"], mediaType: "document" },
    { id: "csv", label: "CSV", extensions: ["csv"], mediaType: "data" },
    { id: "epub", label: "EPUB", extensions: ["epub"], mediaType: "document" },
    { id: "mobi", label: "MOBI", extensions: ["mobi"], mediaType: "document" },
    // Data
    { id: "json", label: "JSON", extensions: ["json"], mediaType: "data" },
    { id: "yaml", label: "YAML", extensions: ["yaml", "yml"], mediaType: "data" },
    { id: "xml", label: "XML", extensions: ["xml"], mediaType: "data" },
    // Archives
    { id: "zip", label: "ZIP", extensions: ["zip"], mediaType: "archive" },
    { id: "7z", label: "7-Zip", extensions: ["7z"], mediaType: "archive" },
    { id: "tar", label: "TAR", extensions: ["tar"], mediaType: "archive" },
    { id: "tgz", label: "TAR.GZ", extensions: ["tgz", "tar.gz"], mediaType: "archive" }
];
const EXT_TO_FORMAT = new Map();
for (const f of FORMATS) {
    for (const ext of f.extensions) {
        EXT_TO_FORMAT.set(ext.toLowerCase(), f.id);
    }
}
export function inferFormatFromFilename(filename) {
    const base = filename.toLowerCase();
    if (base.endsWith(".tar.gz"))
        return "tgz";
    const ext = path.extname(base).replace(".", "");
    if (!ext)
        return null;
    return EXT_TO_FORMAT.get(ext) || null;
}
export async function detectFormatFromFile(filePath, fallbackFilename) {
    try {
        const ft = await fileTypeFromFile(filePath);
        if (ft?.ext) {
            const direct = EXT_TO_FORMAT.get(ft.ext.toLowerCase());
            if (direct)
                return direct;
            return ft.ext.toLowerCase();
        }
    }
    catch {
        // ignore, fall back
    }
    if (fallbackFilename)
        return inferFormatFromFilename(fallbackFilename);
    return null;
}
export function listFormats() {
    return FORMATS;
}
