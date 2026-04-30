const fileEl = document.getElementById("file");
const dropEl = document.getElementById("drop");
const toEl = document.getElementById("to");
const converterEl = document.getElementById("converter");
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
  statusEl.textContent = "Uploading…";

  const form = new FormData();
  form.append("file", selectedFile, selectedFile.name);
  form.append("to", toEl.value);
  if (converterEl.value) form.append("converter", converterEl.value);

  const res = await fetch("/api/jobs", { method: "POST", body: form });
  const data = await res.json();
  if (!data.ok) {
    statusEl.textContent = data.error || "Failed to start job";
    convertEl.disabled = false;
    return;
  }
  const jobId = data.job.id;
  statusEl.textContent = `Converting… (${jobId})`;

  const final = await pollJob(jobId);
  if (final.status !== "succeeded") {
    statusEl.textContent = final.error ? `Failed: ${final.error}` : `Finished: ${final.status}`;
    convertEl.disabled = false;
    return;
  }

  statusEl.textContent = `Done (${final.converterId}). Downloading…`;
  window.location.href = `/api/jobs/${jobId}/download`;
  setTimeout(() => {
    statusEl.textContent = "Ready.";
    convertEl.disabled = false;
  }, 800);
});

async function loadCaps() {
  const res = await fetch("/api/capabilities");
  caps = await res.json();

  capsEl.textContent = JSON.stringify(caps, null, 2);

  populateTargets(null);

  // Populate converters that are available
  converterEl.innerHTML = `<option value="">Auto</option>`;
  for (const c of caps.converters) {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.availability?.ok ? c.label : `${c.label} (missing)`;
    opt.disabled = !c.availability?.ok;
    converterEl.appendChild(opt);
  }

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

async function pollJob(jobId) {
  for (;;) {
    const res = await fetch(`/api/jobs/${jobId}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "job fetch failed");
    const job = data.job;
    if (job.status === "queued" || job.status === "running") {
      await sleep(750);
      continue;
    }
    return job;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function prettyBytes(n) {
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}

function inferFormatFromName(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".tar.gz")) return "tgz";
  const idx = lower.lastIndexOf(".");
  if (idx === -1) return null;
  return lower.slice(idx + 1) || null;
}

function populateTargets(from) {
  if (!caps) return;
  const formatsById = new Map(caps.formats.map((f) => [f.id, f]));

  let targetIds = null;
  if (from) {
    const set = new Set();
    for (const c of caps.converters || []) {
      if (!c.availability?.ok) continue;
      for (const p of c.pairs || []) {
        if (p.from === from) set.add(p.to);
      }
    }
    targetIds = [...set].sort();
  }

  const idsToShow = targetIds && targetIds.length ? targetIds : caps.formats.map((f) => f.id);

  toEl.innerHTML = "";
  for (const id of idsToShow) {
    const f = formatsById.get(id);
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = f ? `${f.label} (${f.id})` : id;
    toEl.appendChild(opt);
  }
}
