const API_BASE = "/api/omniconvert";

const fileEl = document.getElementById("file");
const dropEl = document.getElementById("drop");
const toEl = document.getElementById("to");
const convertEl = document.getElementById("convert");
const statusEl = document.getElementById("status");
const capsEl = document.getElementById("caps");

let selectedFile = null;
let caps = null;

await loadCaps();
wireDnD();

fileEl.addEventListener("change", () => {
  selectedFile = fileEl.files?.[0] || null;
  updateUi();
});

convertEl.addEventListener("click", async () => {
  if (!selectedFile) return;
  convertEl.disabled = true;
  statusEl.textContent = "Converting…";

  try {
    const to = toEl.value;
    const buf = await selectedFile.arrayBuffer();
    const from = inferFormatFromName(selectedFile.name);
    const url = new URL(`${API_BASE}/convert`, window.location.origin);
    url.searchParams.set("to", to);
    url.searchParams.set("from", from || "");
    url.searchParams.set("filename", selectedFile.name);

    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "x-filename": selectedFile.name },
      body: buf,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error((data && data.error) || `Convert failed (${res.status})`);
    }

    const blob = await res.blob();
    const cd = res.headers.get("content-disposition") || "";
    const outName = parseFilenameFromContentDisposition(cd) || suggestName(selectedFile.name, to);

    downloadBlob(blob, outName);
    statusEl.textContent = "Done.";
  } catch (e) {
    statusEl.textContent = String(e && e.message ? e.message : e);
  } finally {
    convertEl.disabled = !selectedFile;
  }
});

async function loadCaps() {
  const res = await fetch(`${API_BASE}/capabilities`);
  caps = await res.json();
  capsEl.textContent = JSON.stringify(caps, null, 2);
  updateUi();
}

function updateUi() {
  convertEl.disabled = !selectedFile;
  if (!selectedFile) {
    statusEl.textContent = "Choose a file to begin.";
    populateTargets(null);
    return;
  }
  const from = inferFormatFromName(selectedFile.name);
  populateTargets(from);
  statusEl.textContent = `Selected: ${selectedFile.name} (${prettyBytes(selectedFile.size)})${from ? ` • from: ${from}` : ""}`;
}

function populateTargets(from) {
  if (!caps || !caps.ok) return;
  const pairs = Array.isArray(caps.pairs) ? caps.pairs : [];
  const formats = Array.isArray(caps.formats) ? caps.formats : [];

  const targets = new Set();
  if (from) {
    for (const p of pairs) if (p.from === from) targets.add(p.to);
  }
  const idsToShow = targets.size ? [...targets].sort() : formats;

  toEl.innerHTML = "";
  for (const id of idsToShow) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = id.toUpperCase();
    toEl.appendChild(opt);
  }
}

function wireDnD() {
  dropEl.addEventListener("click", () => fileEl.click());
  dropEl.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropEl.classList.add("drag");
  });
  dropEl.addEventListener("dragleave", () => dropEl.classList.remove("drag"));
  dropEl.addEventListener("drop", (e) => {
    e.preventDefault();
    dropEl.classList.remove("drag");
    const f = e.dataTransfer?.files?.[0];
    if (!f) return;
    selectedFile = f;
    fileEl.value = "";
    updateUi();
  });
}

function inferFormatFromName(name) {
  const lower = String(name || "").toLowerCase();
  if (lower.endsWith(".tar.gz")) return "tgz";
  const idx = lower.lastIndexOf(".");
  if (idx === -1) return null;
  return lower.slice(idx + 1) || null;
}

function prettyBytes(n) {
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}

function parseFilenameFromContentDisposition(cd) {
  const m = /filename="([^"]+)"/i.exec(cd || "");
  return m ? m[1] : null;
}

function suggestName(inputName, to) {
  const base = String(inputName || "file").replace(/[/\\\\]/g, "").replace(/\.[^.]+$/, "");
  return `${base}.${to}`;
}

function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

