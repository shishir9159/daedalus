// ════════════════════════════════════════════════════════════════════════════
//  pdf.jsx  —  the shared PDF engine
//  Location: Meta/Obsidian/_datacore/pdf/pdf.jsx
//
//  Everything that touches a PDF, for the paper infobox and the book views
//  alike: loading pdf.js, caching documents, reading annotations, rasterising
//  pages.
//
//  It is also the one way out to the network (netGet / netJson) and the one
//  way a PDF comes in (fetchPdf / fetchArxivPdf), shared by the infoboxes and
//  the populate blocks, so a paper downloads the same whether it is new or an
//  update.
//
//  ── HIGHLIGHT COLOURS ─────────────────────────────────────────────────────
//  Hardcoded and matched exactly — pdf.js round-trips the stored floats
//  through Math.round(c * 255), so an exact lookup is reliable. Any other
//  colour classifies as null: it counts toward the highlight total but is not
//  filed under a colour.
//
//    yellow   RGB(255,193,0)     information
//    green    RGB(6,138,28)      term or analogy
//    orange   RGB(255,98,0)      a little tricky
//    red      RGB(219,52,37)     important or hard
//    explore  RGB(204,204,204)   reference, already looked at
//    visited  RGB(170,170,170)   reference, still to read
//
//  Underline is not a colour: it is the "I do not follow this" mark, counted
//  separately and written to frontmatter as `underlines`.
//
//  NOTE: never declare a local named `h` in this file — it is the JSX pragma.
// ════════════════════════════════════════════════════════════════════════════

const VENDOR = "Meta/Obsidian/_datacore/vendor";
// timeouts, retries and API keys (config.jsx requires nothing, so no cycle)
const { CONFIG } = await dc.require("Meta/Obsidian/_datacore/populate/config.jsx");

// ── pdf.js ──────────────────────────────────────────────────────────────────
//  Obsidian only publishes `pdfjsLib` once its own PDF view has been
//  constructed. Three ways in, cheapest first:
//
//    1. the global, if Obsidian has already built its viewer
//    2. a vendored ES build dropped in Meta/Obsidian/_datacore/vendor/
//       (pdf.min.mjs / pdf.mjs / pdf.min.js / pdf.js) — a plain dynamic import
//       off the vault's own resource URL, so it costs one fetch and is cached
//    3. failing both, keep watching: the moment a PDF is opened anywhere the
//       global appears and every mounted infobox renders itself (usePdfjsReady)
//
//  Nothing here blocks a render; the click-through to the PDF works without pdf.js.
let _pdfjs = null;
let _vendorTry = null;

const pdfjsGlobal = () => globalThis.pdfjsLib ?? globalThis.pdfjsDistBuildPdf ?? null;

const VENDOR_NAMES = ["pdf.min.mjs", "pdf.mjs", "pdf.min.js", "pdf.js"];
const WORKER_NAMES = ["pdf.worker.min.mjs", "pdf.worker.mjs", "pdf.worker.min.js", "pdf.worker.js"];

async function importVendored() {
  const ad = app.vault.adapter;
  if (typeof ad?.getResourcePath !== "function") return null;
  const has = async (p) => (typeof ad.exists === "function" ? ad.exists(p) : true);

  for (const name of VENDOR_NAMES) {
    const p = `${VENDOR}/${name}`;
    try {
      if (!(await has(p))) continue;
      const mod = await import(/* webpackIgnore: true */ ad.getResourcePath(p));
      const lib = mod?.getDocument ? mod : mod?.default?.getDocument ? mod.default : null;
      if (!lib) continue;
      // Its own worker, if one was dropped alongside: the main-thread fallback locks
      // the UI through a long annotation scan.
      if (lib.GlobalWorkerOptions && !lib.GlobalWorkerOptions.workerSrc) {
        for (const w of WORKER_NAMES) {
          const wp = `${VENDOR}/${w}`;
          if (await has(wp)) { lib.GlobalWorkerOptions.workerSrc = ad.getResourcePath(wp); break; }
        }
      }
      return lib;
    } catch { /* not there, or not an ES build — try the next name */ }
  }
  return null;
}

async function loadPdfjs() {
  if (_pdfjs) return _pdfjs;
  const g = pdfjsGlobal();
  if (g) return (_pdfjs = g);
  _vendorTry ??= importVendored().catch(() => null);
  const vendored = await _vendorTry;
  if (vendored) return (_pdfjs = vendored);
  const late = pdfjsGlobal();
  if (late) return (_pdfjs = late);
  throw new Error("pdf.js not available — open any PDF once, or drop a build in " + VENDOR);
}

/**
 * True once pdf.js can be had. Re-checks on a slow timer, so a preview appears
 * once any PDF opens elsewhere; gives up after two minutes.
 */
function usePdfjsReady() {
  const [ready, setReady] = dc.useState(() => !!(_pdfjs || pdfjsGlobal()));

  dc.useEffect(() => {
    if (ready) return;
    let alive = true;
    let tries = 0;
    const id = window.setInterval(() => {
      if (_pdfjs || pdfjsGlobal()) { setReady(true); window.clearInterval(id); return; }
      if (++tries > 120) window.clearInterval(id);
    }, 1000);
    // the vendored build is worth one attempt even before anything asks to render
    loadPdfjs().then(() => alive && setReady(true)).catch(() => { });
    return () => { alive = false; window.clearInterval(id); };
  }, [ready]);

  return ready;
}

// ── the palette ─────────────────────────────────────────────────────────────
const HIGHLIGHTS = [
  { key: "yellow", rgb: [255, 193, 0], label: "information" },
  { key: "orange", rgb: [255, 98, 0], label: "tricky" },
  { key: "red", rgb: [219, 52, 37], label: "important" },
  { key: "green", rgb: [6, 138, 28], label: "term" },
  { key: "visited", rgb: [170, 170, 170], label: "ref visited" },
  { key: "explore", rgb: [204, 204, 204], label: "ref to read" },
];

/**
 * What a highlight looks like on screen: the pen's RGB is only for matching,
 * and display goes through Obsidian's palette, legible in any theme.
 */
const HL_SWATCH = {
  yellow: "var(--color-yellow)",
  orange: "var(--color-orange)",
  red: "var(--color-red)",
  green: "var(--color-green)",
  visited: "var(--text-muted)",
  explore: "var(--text-faint)",
  other: "var(--text-faint)",
};

const swatchFor = (key) => HL_SWATCH[key] ?? HL_SWATCH.other;

const HL_BY_KEY = Object.fromEntries(HIGHLIGHTS.map((c) => [c.key, c]));
const COLOR_ORDER = HIGHLIGHTS.map((c) => c.key);

const toHex = (c) =>
  "#" + Array.from(c).map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

/** hex -> key, built once from the table above. */
const HL_BY_HEX = Object.fromEntries(HIGHLIGHTS.map((c) => [toHex(c.rgb), c.key]));

/** Exact lookup. Returns null for a colour that is not one of the six. */
function classifyColor(c) {
  if (!c) return null;
  // pdf.js hands back 0-255; a 0-1 triple would come from somewhere else
  const scaled = c[0] <= 1 && c[1] <= 1 && c[2] <= 1
    ? [c[0] * 255, c[1] * 255, c[2] * 255]
    : [c[0], c[1], c[2]];
  return HL_BY_HEX[toHex(scaled)] ?? null;
}

// ── link plumbing ───────────────────────────────────────────────────────────
function parseLink(v) {
  if (v == null) return null;
  if (typeof v === "object") return v.path ?? v.link ?? null;
  const m = String(v).match(/^!?\[\[([^\]|#]+)/);
  return m ? m[1].trim() : String(v).trim() || null;
}

function resolvePdf(linkish, sourcePath) {
  const raw = parseLink(linkish);
  if (!raw) return null;
  const hit =
    app.metadataCache.getFirstLinkpathDest(raw, sourcePath ?? "") ??
    app.vault.getAbstractFileByPath(raw) ??
    null;
  // getAbstractFileByPath happily hands back a TFolder, and a link to a note
  // that merely mentions a PDF resolves to the note. Insist on a real file.
  if (!hit || !hit.stat || String(hit.extension ?? "").toLowerCase() !== "pdf") return null;
  return hit;
}

// ── document cache ──────────────────────────────────────────────────────────
// Keyed on path + mtime, so an edited PDF invalidates itself.
const DOCS = new Map();
const DOC_CAP = 6;

async function getDoc(file) {
  const key = `${file.path}:${file.stat.mtime}`;
  const hit = DOCS.get(key);
  if (hit) { DOCS.delete(key); DOCS.set(key, hit); return hit; }

  const pdfjs = await loadPdfjs();
  const buf = await app.vault.readBinary(file);
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise;
  DOCS.set(key, doc);
  while (DOCS.size > DOC_CAP) {
    const oldest = DOCS.keys().next().value;
    try { DOCS.get(oldest)?.destroy?.(); } catch { }
    DOCS.delete(oldest);
  }
  return doc;
}

// ── annotations ─────────────────────────────────────────────────────────────
const STATS = new Map();

/**
 * Every highlight counts on its own, so one that wraps onto two lines is two marks.
 */
async function readPdfStats(file) {
  const key = `${file.path}:${file.stat.mtime}`;
  if (STATS.has(key)) return STATS.get(key);

  const doc = await getDoc(file);
  const pages = doc.numPages;
  const marks = [];

  for (let p = 1; p <= pages; p++) {
    const page = await doc.getPage(p);
    let annots = [];
    try { annots = await page.getAnnotations(); } catch { /* damaged page */ }
    for (const a of annots) {
      if (a.subtype !== "Highlight" && a.subtype !== "Underline") continue;
      const rgb = a.color ? Array.from(a.color) : null;
      marks.push({
        page: p,
        kind: a.subtype,
        color: a.subtype === "Highlight" ? classifyColor(rgb) : null,
        hex: rgb ? toHex(rgb) : null,
        text: a.contentsObj?.str?.trim() || "",
        at: a.modificationDate ?? a.creationDate ?? null,
      });
    }
  }

  const highlights = marks.filter((m) => m.kind === "Highlight");
  const underlines = marks.filter((m) => m.kind === "Underline");

  // Per-colour tallies, in palette order. Unrecognised colours are grouped
  // under "other" so the total always adds up.
  const byColorMap = new Map();
  for (const m of highlights) {
    const key = m.color ?? "other";
    let e = byColorMap.get(key);
    if (!e) byColorMap.set(key, (e = {
      color: key, label: HL_BY_KEY[key]?.label ?? "other",
      hex: m.hex, n: 0, pages: new Set(),
    }));
    e.n++;
    e.pages.add(m.page);
    if (!e.hex && m.hex) e.hex = m.hex;
  }
  const byColor = Array.from(byColorMap.values())
    .map((e) => ({ ...e, pages: Array.from(e.pages).sort((a, b) => a - b) }))
    .sort((a, b) => {
      const ai = COLOR_ORDER.indexOf(a.color), bi = COLOR_ORDER.indexOf(b.color);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);   // "other" sorts last
    });

  // per page: how many marks, and which colour dominates
  const byPage = Array.from({ length: pages }, (_, i) => ({
    page: i + 1, n: 0, colors: {}, hexes: {}, top: null, hex: null,
  }));
  for (const m of highlights) {
    const slot = byPage[m.page - 1];
    if (!slot) continue;
    const key = m.color ?? "other";
    slot.n++;
    slot.colors[key] = (slot.colors[key] ?? 0) + 1;
    if (m.hex && !slot.hexes[key]) slot.hexes[key] = m.hex;
    if (!slot.top || slot.colors[key] > slot.colors[slot.top]) slot.top = key;
  }
  for (const s of byPage) s.hex = s.top ? (s.hexes[s.top] ?? null) : null;

  const touched = byPage.filter((p) => p.n > 0).length;
  const out = {
    pages, byColor, byPage,
    total: highlights.length,
    underlines: underlines.length,
    furthest: marks.length ? Math.max(...marks.map((m) => m.page)) : 0,
    coverage: pages ? touched / pages : 0,
    lastTouched: marks.reduce((acc, m) => (m.at && m.at > acc ? m.at : acc), ""),
  };
  STATS.set(key, out);
  return out;
}

/**
 * The furthest page carrying a mark, and optionally the per-bucket density the
 * book's fore-edge draws. Cached in localStorage against mtime, so the scan
 * runs once per edit of the PDF rather than once per note open.
 */
const LS_KEY = "pdf:annotations";
const lsRead = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "{}"); } catch { return {}; } };
const lsWrite = (o) => { try { localStorage.setItem(LS_KEY, JSON.stringify(o)); } catch { } };

async function annotationProfile(file, { profile = false, buckets = 34 } = {}) {
  const empty = { last: null, heat: null, total: 0, underlines: 0, explore: 0 };
  if (!file) return empty;

  const key = `${file.path}:${file.stat?.mtime}|${profile ? buckets : 0}`;
  const cache = lsRead();
  if (key in cache) return cache[key];

  try {
    const s = await readPdfStats(file);
    let heat = null;
    if (profile) {
      heat = new Array(buckets).fill(0);
      for (const p of s.byPage) {
        if (!p.n) continue;
        const i = Math.min(buckets - 1, Math.floor(((p.page - 1) / s.pages) * buckets));
        heat[i] += p.n;
      }
    }
    const out = {
      last: s.furthest || null, heat, total: s.total, underlines: s.underlines,
      // references you marked "still to read" — a to-do, so the book views
      // write it to frontmatter. It was being asked for and never returned.
      explore: s.byColor.find((c) => c.color === "explore")?.n ?? 0,
    };
    cache[key] = out;
    const keys = Object.keys(cache);
    if (keys.length > 150) keys.slice(0, keys.length - 150).forEach((k) => delete cache[k]);
    lsWrite(cache);
    return out;
  } catch (e) {
    console.warn("[pdf] annotation scan failed", file?.path, e);
    return empty;
  }
}

// ── rasterising ─────────────────────────────────────────────────────────────
const IMGS = new Map();
const IMG_CAP = 24;

async function renderPage(file, pageNo, width) {
  const w = Math.round(width);
  const key = `${file.path}:${file.stat.mtime}:${pageNo}:${w}`;
  if (IMGS.has(key)) return IMGS.get(key);

  const doc = await getDoc(file);
  const n = Math.min(Math.max(1, pageNo | 0), doc.numPages);
  const page = await doc.getPage(n);
  const base = page.getViewport({ scale: 1 });
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
  const viewport = page.getViewport({ scale: (w * dpr) / base.width });

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  // white behind the page: scientific PDFs are often transparent-backed, and a
  // dark theme would otherwise render black text on black
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;

  const url = canvas.toDataURL("image/jpeg", 0.86);
  IMGS.set(key, url);
  while (IMGS.size > IMG_CAP) IMGS.delete(IMGS.keys().next().value);
  return url;
}

/** Page one, for a book with no cover image of its own. */
const firstPageThumb = (file, width = 360) =>
  renderPage(file, 1, width).catch(() => null);

/**
 * Drop every cached read of one PDF. The caches are keyed on path:mtime, but a
 * mounted component still holds the old entries when arXiv replaces a file.
 */
function forgetPdf(path) {
  if (!path) return;
  const pre = `${path}:`;
  for (const k of [...DOCS.keys()]) {
    if (!k.startsWith(pre)) continue;
    try { DOCS.get(k)?.destroy?.(); } catch { }
    DOCS.delete(k);
  }
  for (const k of [...STATS.keys()]) if (k.startsWith(pre)) STATS.delete(k);
  for (const k of [...IMGS.keys()]) if (k.startsWith(pre)) IMGS.delete(k);
  const cache = lsRead();
  let touched = false;
  for (const k of Object.keys(cache)) if (k.startsWith(pre)) { delete cache[k]; touched = true; }
  if (touched) lsWrite(cache);
}

// ── frontmatter ─────────────────────────────────────────────────────────────
// Writes only keys whose value changed, and reports whether it wrote, which
// keeps an auto-updating infobox out of a write -> reindex -> write loop.
async function writeFields(path, patch) {
  const f = app.vault.getAbstractFileByPath(path);
  if (!f) return false;
  let wrote = false;
  await app.fileManager.processFrontMatter(f, (fm) => {
    for (const k of Object.keys(patch)) {
      const v = patch[k];
      if (JSON.stringify(fm[k] ?? null) === JSON.stringify(v ?? null)) continue;
      if (v === undefined || v === null || v === "") delete fm[k];
      else fm[k] = v;
      wrote = true;
    }
  });
  return wrote;
}

// ── talking to the network ──────────────────────────────────────────────────
/**
 * Getting bytes cross-origin from app://obsidian.md, where `fetch` needs the
 * host's CORS header (Semantic Scholar sends one; arXiv does not). Three
 * transports, best first:
 *
 *   requestUrl   Obsidian's own, no CORS. "obsidian" only resolves inside a
 *                plugin bundle, so it is borrowed off a loaded plugin's exports.
 *   node http(s) window.require is Electron's; a Node request has no origin
 *                and no preflight. Desktop only.
 *   fetch        the fallback, fine for hosts that send the header.
 *
 * On mobile only fetch exists, so cross-origin callers ask
 * `netCanCrossOrigin()` first and do nothing if it says no.
 */
let NET = null;

/**
 * arxiv.org answers 403 to a User-Agent that looks like a script. This runs in
 * Electron, so a desktop browser string is accurate.
 */
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function netProbe() {
  if (NET) return NET;
  NET = { requestUrl: null, node: null };

  // requestUrl, off any plugin that happens to re-export the module
  try {
    const r = globalThis.require;
    const mod = r ? r("obsidian") : null;
    if (typeof mod?.requestUrl === "function") NET.requestUrl = mod.requestUrl;
  } catch { /* not resolvable this way; expected */ }

  // Node's http/https, straight out of Electron
  try {
    const r = globalThis.require;
    const https = r ? r("https") : null;
    const http = r ? r("http") : null;
    if (https?.request && http?.request) NET.node = { https, http };
  } catch { /* mobile, or node integration off */ }

  return NET;
}

/** Can we reach a host that sends no CORS headers? */
function netCanCrossOrigin() {
  const n = netProbe();
  return !!(n.requestUrl || n.node);
}

/** Back-compat: the old name, still handing back requestUrl when it exists. */
function obsidianRequest() {
  return netProbe().requestUrl;
}

/**
 * One GET over Node, following redirects by hand (arxiv.org/pdf/… bounces at
 * least once). Bytes only; the caller decides whether it wanted text.
 */
function nodeGet(url, { headers = {}, hops = 5 } = {}) {
  return new Promise((resolve, reject) => {
    const n = netProbe().node;
    if (!n) return reject(new Error("no node transport"));
    const lib = url.startsWith("http://") ? n.http : n.https;
    const req = lib.request(
      url,
      { method: "GET", headers: { "User-Agent": USER_AGENT, Accept: "*/*", ...headers } },
      (res) => {
        const code = res.statusCode ?? 0;
        if (code >= 300 && code < 400 && res.headers.location && hops > 0) {
          res.resume();                                    // drain, or the socket hangs
          nodeGet(new URL(res.headers.location, url).toString(), { headers, hops: hops - 1 })
            .then(resolve, reject);
          return;
        }
        // Collected as bytes and joined once at the end, so the PDF survives intact.
        const chunks = [];
        let size = 0;
        res.on("data", (c) => { const u = new Uint8Array(c); chunks.push(u); size += u.length; });
        res.on("end", () => {
          const bytes = new Uint8Array(size);
          let at = 0;
          for (const c of chunks) { bytes.set(c, at); at += c.length; }
          resolve({ status: code, bytes });
        });
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    req.end();
  });
}

/**
 * GET a URL through whichever transport is available.
 *
 * Returns { status, text, arrayBuffer } or null. `crossOrigin: true` means the
 * host sends no CORS headers: if no transport can bypass that, return null
 * rather than let fetch fail loudly. `binary: true` asks for the bytes and
 * skips the text decode (on the fetch path, the only way to an arrayBuffer).
 *
 * Callers must check the status: arXiv says 403 with a well-formed body.
 *
 * `timeout` (ms, 0 = none) gives up on a host that never answers; `retries`
 * goes again on 429 / 5xx / no answer, backing off 0.6 s, 2.4 s, 5.4 s.
 */
async function netGet(url, { crossOrigin = false, binary = false, headers, timeout = 0, retries = 0 } = {}) {
  if (crossOrigin && !netCanCrossOrigin()) return null;    // would only be a CORS error
  let res = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt) await new Promise((r) => window.setTimeout(r, 600 * attempt * attempt));
    res = await netOnce(url, { crossOrigin, binary, headers, timeout });
    if (res && res.status !== 429 && res.status < 500) return res;
  }
  return res;
}

const withTimeout = (promise, ms) => !ms ? promise : Promise.race([
  promise,
  new Promise((_, reject) => window.setTimeout(() => reject(new Error(`no answer in ${ms} ms`)), ms)),
]);

async function netOnce(url, { crossOrigin, binary, headers, timeout }) {
  const n = netProbe();
  const decode = (buf) => (buf ? new TextDecoder("utf-8").decode(new Uint8Array(buf)) : "");
  try {
    if (n.requestUrl) {
      const res = await withTimeout(n.requestUrl({ url, throw: false, headers }), timeout);
      return { status: res.status, text: binary ? "" : res.text, arrayBuffer: res.arrayBuffer };
    }
    if (n.node) {
      const res = await withTimeout(nodeGet(url, { headers }), timeout);
      return {
        status: res.status,
        text: binary ? "" : decode(res.bytes.buffer),
        arrayBuffer: res.bytes.buffer,
      };
    }
    if (crossOrigin) return null;
    const res = await withTimeout(fetch(url, headers ? { headers } : undefined), timeout);
    return {
      status: res.status,
      text: binary ? "" : await res.text(),
      arrayBuffer: binary ? await res.arrayBuffer() : null,
    };
  } catch (e) {
    console.warn("[pdf] request failed", url, e);
    return null;
  }
}

/** netGet, parsed. null for no answer, an error status or a body that is not JSON. */
async function netJson(url, opts = {}) {
  const res = await netGet(url, opts);
  if (!res || res.status >= 400 || !res.text) return null;
  try { return JSON.parse(res.text); } catch { return null; }
}

/**
 * One paper from Semantic Scholar, by arXiv id: the populate block's metadata
 * and the infobox's citation count both come through here.
 *
 * Without a key every caller on earth shares one anonymous pool, and it is
 * often spent: 429 for every request, minutes on end, so retrying does not
 * help. The key is read from Obsidian's keychain, under the ID
 * net.semanticScholarSecret names in populate/config.jsx. Sends CORS headers,
 * so this works on mobile too.
 *
 * Returns { json, reason }: json null on any failure, reason saying which.
 */
async function semanticScholar(arxivId, fields) {
  const id = String(arxivId ?? "").replace(/^arxiv:\s*/i, "").replace(/v\d+$/i, "").trim();
  if (!id) return { json: null, reason: "no arXiv id" };
  const secret = CONFIG.net.semanticScholarSecret;
  let key = null;
  try { key = secret ? app.secretStorage?.getSecret(secret) : null; } catch { }   // older Obsidian: no keychain
  const res = await netGet(`https://api.semanticscholar.org/graph/v1/paper/arXiv:${id}?fields=${fields}`, {
    headers: key ? { "x-api-key": key } : undefined, retries: CONFIG.net.retries, timeout: CONFIG.net.timeoutMs,
  });
  let json = null;
  if (res && res.status < 400) try { json = JSON.parse(res.text); } catch { }
  if (json && !json.error) return { json, reason: null };
  const reason = !res ? "Semantic Scholar did not answer"
    : res.status === 429 ? (key ? "Semantic Scholar is rate-limiting your key"
      : `Semantic Scholar's shared quota is spent (429), and Obsidian's keychain has no "${secret}" secret holding your key`)
    : res.status === 404 ? "Semantic Scholar does not know this paper"
    : `Semantic Scholar answered ${res.status}`;
  console.warn("[pdf]", reason, id);
  return { json: null, reason };
}

/**
 * Latest version number on arXiv, or null.
 *
 * Matching /abs/…v(\d+) picks the entry, not the feed's own <id>. One request
 * and a regex, only when both `arxiv` and `arxiv-version` are set.
 */
async function arxivLatestVersion(arxivId) {
  const id = String(arxivId ?? "").replace(/^arxiv:\s*/i, "").replace(/v\d+$/i, "").trim();
  if (!id) return null;
  const url = `https://export.arxiv.org/api/query?id_list=${id}`;
  const res = await netGet(url, { crossOrigin: true });
  if (!res) { console.warn("[pdf] arXiv version check got no answer for", id); return null; }
  if (res.status >= 400) { console.warn("[pdf] arXiv version check answered", res.status, "for", id); return null; }
  const m = res.text?.match(/<id>https?:\/\/arxiv\.org\/abs\/[^<]+v(\d+)<\/id>/);
  return m ? Number(m[1]) : null;
}

/**
 * Is this actually a PDF, or an error page with a 200 on it?
 *
 * %PDF is normally the first four bytes; a few producers leave junk in front of
 * it, so the first 32 are searched rather than only offset zero.
 */
function looksLikePdf(buf) {
  if (!buf || buf.byteLength < 1024) return false;
  const head = new Uint8Array(buf, 0, Math.min(64, buf.byteLength));
  for (let i = 0; i + 3 < Math.min(32, head.length); i++) {
    if (head[i] === 0x25 && head[i + 1] === 0x50 && head[i + 2] === 0x44 && head[i + 3] === 0x46) return true;
  }
  return false;
}

const folderOf = (file) => (file.parent?.path && file.parent.path !== "/" ? `${file.parent.path}/` : "");

/**
 * Keep the copy that is about to be replaced, as `Name.v6.pdf` beside it: a
 * PDF like any other, annotations and all. Copied, not renamed: a rename
 * rewrites links, so `paper:` would follow the old copy. Never over a file.
 */
async function keepOldVersion(file, name, tag) {
  const stem = `${folderOf(file)}${name}.${tag}`;
  let target = `${stem}.pdf`;
  for (let n = 2; n < 50 && await app.vault.adapter.exists(target); n++) target = `${stem}-${n}.pdf`;
  await app.vault.createBinary(target, await app.vault.readBinary(file));
  return target;
}

/**
 * A PDF off the web, checked to be one. `crossOrigin` as for netGet: true
 * unless the host is known to send CORS headers.
 *
 * Returns { ok, buf, url, reason }.
 */
async function fetchPdf(url, { crossOrigin = true, timeout = 90000 } = {}) {
  if (!url) return { ok: false, buf: null, url, reason: "no URL" };
  if (crossOrigin && !netCanCrossOrigin()) {
    return { ok: false, buf: null, url, reason: "no transport can reach that host from here (mobile?)" };
  }
  const res = await netGet(url, {
    crossOrigin, binary: true, timeout, retries: 1, headers: { Accept: "application/pdf,*/*" },
  });
  const host = String(url).replace(/^https?:\/\/([^/]+).*$/, "$1");
  if (!res) return { ok: false, buf: null, url, reason: `${host} did not answer` };
  if (res.status >= 400) return { ok: false, buf: null, url, reason: `${host} answered ${res.status} — it may be rate-limiting` };
  const buf = res.arrayBuffer;
  if (!buf) return { ok: false, buf: null, url, reason: "the response carried no bytes" };
  if (!looksLikePdf(buf)) {
    return { ok: false, buf: null, url, reason: `what came back is not a PDF (${buf.byteLength} bytes) — probably a holding page` };
  }
  return { ok: true, buf, url, reason: null };
}

/**
 * vN of a paper, straight from arxiv.org; no version means the latest. The one
 * way a paper is fetched, whether it is new (paper/populate.jsx) or moving on
 * (replaceArxivPdf, behind the infobox's Update button).
 */
async function fetchArxivPdf(arxivId, version = null) {
  const id = String(arxivId ?? "").replace(/^arxiv:\s*/i, "").replace(/v\d+$/i, "").trim();
  if (!id) return { ok: false, buf: null, url: null, reason: "no arXiv id on this note" };
  return fetchPdf(`https://arxiv.org/pdf/${id}${version ? `v${version}` : ""}`, { crossOrigin: true });
}

/**
 * Pull vN of a paper down and write it over the file already in the vault.
 * `name` is the note's: the old version is kept as `<name>.v6.pdf` and the
 * new one ends up as `<name>.pdf` (renamed in its folder, links following,
 * unless that name is taken). The version numbers are the note's `arxiv` and
 * `arxiv-version`, never the file name.
 *
 * Returns { ok, reason, backup, renamed }: renamed is { from, to } or null.
 * Every failure says which it was, to the caller (for the button) and to the
 * console.
 */
async function replaceArxivPdf(file, arxivId, version, { haveVersion = null, name = null } = {}) {
  const fail = (reason) => {
    console.warn("[pdf] arXiv update failed —", reason, { paper: file?.path, arxivId, version });
    return { ok: false, reason, backup: null, renamed: null };
  };

  if (!file) return fail("no PDF resolved from this note");
  const got = await fetchArxivPdf(arxivId, version);
  if (!got.ok) return fail(got.reason);
  const buf = got.buf;
  const base = name || file.basename;

  let backup = null;
  try {
    backup = await keepOldVersion(file, base, haveVersion ? `v${haveVersion}` : "previous");
  } catch (e) {
    // not fatal, but the old copy is about to go, so say so
    console.warn("[pdf] could not keep a backup of", file.path, e);
  }

  try {
    await app.vault.modifyBinary(file, buf);
  } catch (e) {
    console.warn("[pdf] could not write", file.path, e);
    return { ok: false, reason: "the vault refused the write", backup, renamed: null };
  }
  // a mounted component still holds the old cache entries
  forgetPdf(file.path);

  let renamed = null;
  const to = `${folderOf(file)}${base}.pdf`;
  if (to !== file.path && !app.vault.getAbstractFileByPath(to)) {
    const from = file.path;
    try {
      await app.fileManager.renameFile(file, to);
      renamed = { from, to: file.path };
    } catch (e) {
      console.warn("[pdf] updated, but could not rename", from, "to", to, e);
    }
  }
  return { ok: true, reason: null, backup, renamed };
}

/**
 * Has the paper moved on? Runs once, after paint, and only when the note
 * knows which version it holds.
 */
function useArxivUpdate(arxivId, haveVersion, enabled = true) {
  const [latest, setLatest] = dc.useState(null);
  const have = Number(String(haveVersion ?? "").replace(/^v/i, "")) || null;

  dc.useEffect(() => {
    if (!enabled || !arxivId || !have || !netCanCrossOrigin()) return;
    let alive = true;
    const id = window.setTimeout(async () => {
      const v = await arxivLatestVersion(arxivId);
      if (alive && v != null) setLatest(v);
    }, 1200);
    return () => { alive = false; window.clearTimeout(id); };
  }, [arxivId, have, enabled]);

  return { latest, have, stale: latest != null && have != null && latest > have };
}

// ── a tiny fingerprint of a web page, for rolling-release books ─────────────
/**
 * Ten characters, always — `[0-9a-z]{10}`, zero-padded so the width in
 * frontmatter never moves. Two independent 32-bit rolls, each truncated to 25
 * bits and packed into one 50-bit integer: exact in a JS number, and never an
 * eleventh base-36 digit.
 */
const HASH_LEN = 10;
const HASH_SHAPE = /^[0-9a-z]{10}$/;

function shortHash(s) {
  const str = String(s ?? "");
  let a = 0x811c9dc5, b = 0x2fd0f9c9;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    a = Math.imul(a ^ c, 16777619) >>> 0;
    b = (Math.imul(b + c, 2246822519) ^ (b >>> 13)) >>> 0;
  }
  a = (a ^ str.length) >>> 0;
  const MASK = 0x1ffffff;                                  // 25 bits
  const packed = (a & MASK) * 33554432 + (b & MASK);
  return packed.toString(36).padStart(HASH_LEN, "0");
}

/**
 * Not a checksum of the bytes, which a rotating ad or build id would never let
 * settle: the markup is stripped of everything that moves on its own, then
 * rolled up. One request and some string work, off a timer after paint (see
 * useSiteHash).
 */
async function pageHash(url) {
  if (!url) return null;
  try {
    const res = await netGet(url, { crossOrigin: true });
    if (!res || (res.status && res.status >= 400)) return null;
    const text = res.text;
    if (!text) return null;
    const cleaned = String(text)
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/\b[0-9a-f]{8,}\b/gi, "")           // build ids, cache busters
      .replace(/\bnonce="[^"]*"/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    return cleaned ? shortHash(`${cleaned.length}:${cleaned}`) : null;
  } catch (e) {
    console.warn("[pdf] page fingerprint failed", url, e);
    return null;
  }
}

/**
 * For a book with `rolling-release: true`: compare a fingerprint of `site`
 * against the one stored in `hash`. Different means the edition moved.
 *
 * It only reports; nothing is downloaded or replaced.
 */
function useSiteHash(url, stored, enabled) {
  const [now, setNow] = dc.useState(null);
  // An older-shaped hash counts as none, so the first run quietly records today's.
  const known = HASH_SHAPE.test(String(stored ?? "")) ? String(stored) : null;

  dc.useEffect(() => {
    if (!enabled || !url || !netCanCrossOrigin()) return;
    let alive = true;
    const id = window.setTimeout(async () => {
      const v = await pageHash(url);
      if (alive && v) setNow(v);
    }, 1500);
    return () => { alive = false; window.clearTimeout(id); };
  }, [url, enabled]);

  return {
    now,
    // no stored hash yet means "nothing to compare", not "out of date"
    changed: !!(now && known && now !== known),
    firstRun: !!(now && !known),
  };
}

// ── citations, from Semantic Scholar ────────────────────────────────────────
/**
 * Looked up by arXiv id and cached into `citations:`, only when that is empty.
 */
async function fetchCitations(arxivId) {
  const { json } = await semanticScholar(arxivId, "citationCount");
  return Number.isFinite(json?.citationCount) ? json.citationCount : null;
}

// ── hooks ───────────────────────────────────────────────────────────────────
function usePdfStats(file) {
  const [state, setState] = dc.useState({ loading: !!file, error: null, data: null });
  const ready = usePdfjsReady();
  const sig = file ? `${file.path}:${file.stat.mtime}` : "";

  dc.useEffect(() => {
    if (!file) { setState({ loading: false, error: null, data: null }); return; }
    if (!ready) { setState({ loading: true, error: null, data: null }); return; }
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    readPdfStats(file)
      .then((data) => alive && setState({ loading: false, error: null, data }))
      .catch((e) => alive && setState({ loading: false, error: e, data: null }));
    return () => { alive = false; };
  }, [sig, ready]);

  return state;
}

function usePageImage(file, pageNo, width) {
  const [url, setUrl] = dc.useState(null);
  const [err, setErr] = dc.useState(null);
  const ready = usePdfjsReady();
  const sig = file ? `${file.path}:${file.stat.mtime}:${pageNo}:${width}` : "";

  dc.useEffect(() => {
    if (!file || !ready) { setUrl(null); return; }
    let alive = true;
    renderPage(file, pageNo, width)
      .then((u) => alive && (setUrl(u), setErr(null)))
      .catch((e) => alive && (setErr(e), setUrl(null)));
    return () => { alive = false; };
  }, [sig, ready]);

  return { url, error: err, ready };
}

/** Cited-by count, fetched once and then read from frontmatter. */
function useCitations(arxivId, cached, notePath) {
  const [n, setN] = dc.useState(cached ?? null);

  dc.useEffect(() => {
    if (cached != null && cached !== "") { setN(Number(cached)); return; }
    if (!arxivId || !notePath) return;
    let alive = true;
    fetchCitations(arxivId).then((v) => {
      if (!alive || v == null) return;
      setN(v);
      writeFields(notePath, { citations: v }).catch(() => { });
    });
    return () => { alive = false; };
  }, [arxivId, cached, notePath]);

  return n;
}

function openAt(file, page, sourcePath, evt) {
  if (!file) return;
  const newLeaf = !!(evt && (evt.metaKey || evt.ctrlKey));
  app.workspace.openLinkText(`${file.path}#page=${page}`, sourcePath ?? "", newLeaf);
}

return {
  loadPdfjs, usePdfjsReady, getDoc, forgetPdf,
  HIGHLIGHTS, HL_BY_KEY, HL_BY_HEX, COLOR_ORDER, classifyColor, toHex,
  HL_SWATCH, swatchFor,
  obsidianRequest, netGet, netJson, netCanCrossOrigin, looksLikePdf,
  fetchPdf, fetchArxivPdf, arxivLatestVersion, replaceArxivPdf, useArxivUpdate, semanticScholar,
  pageHash, shortHash, HASH_LEN, useSiteHash,
  parseLink, resolvePdf,
  readPdfStats, annotationProfile, renderPage, firstPageThumb, writeFields,
  fetchCitations, useCitations,
  usePdfStats, usePageImage, openAt,
};
