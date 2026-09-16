// ════════════════════════════════════════════════════════════════════════════
//  pdf.jsx  —  the shared PDF engine
//  Location: Meta/Obsidian/_datacore/pdf/pdf.jsx
//
//  Everything that touches a PDF lives here: loading pdf.js, caching documents,
//  reading annotations, rasterising pages. Both the paper infobox and the book
//  views require this rather than each carrying their own copy.
//
//  ── HIGHLIGHT COLOURS ─────────────────────────────────────────────────────
//  Hardcoded, matched exactly. No hue bands, no saturation floor, no nearest
//  neighbour: a highlight is one of these six RGB values or it is not one of
//  them at all. pdf.js round-trips the stored float triple through
//  Math.round(c * 255), so 255/193/0 comes back as exactly 255,193,0 and an
//  exact lookup is reliable.
//
//  Anything else classifies as null. It still counts toward the highlight
//  total — you made the mark — but it is not filed under a colour, so an
//  unexpected pen shows up as unaccounted rather than being quietly folded
//  into whichever swatch happened to be nearest.
//
//    yellow   RGB(255,193,0)     information
//    green    RGB(6,138,28)      term or analogy
//    orange   RGB(255,98,0)      a little tricky
//    red      RGB(219,52,37)     important or hard
//    explore  RGB(204,204,204)   reference, already looked at
//    visited  RGB(170,170,170)   reference, still to read
//
//  Underline is not a colour — it is the "I do not follow this" mark, counted
//  separately and written to frontmatter as `underlines`.
//
//  NOTE: never declare a local named `h` in this file — it is the JSX pragma.
// ════════════════════════════════════════════════════════════════════════════

const VENDOR = "Meta/Obsidian/_datacore/vendor";

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
//  Nothing here ever blocks a render. The preview is a bonus; the click-through
//  to the PDF works whether or not pdf.js is around.
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
      // Point it at its own worker if one was dropped alongside. Without this
      // pdf.js falls back to a "fake worker" on the main thread, which still
      // renders but locks the UI while it does — fine for one cover, not for a
      // 400-page annotation scan.
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
 * True once pdf.js can be had. Re-checks on a slow timer while it cannot, so a
 * note that was opened before any PDF renders its preview the moment one is
 * opened elsewhere — no reload, no reopening the note. Gives up after two
 * minutes rather than leaving a timer running for the session.
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
    loadPdfjs().then(() => alive && setReady(true)).catch(() => {});
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
 * What a highlight looks like ON SCREEN, as opposed to in the PDF.
 *
 * The RGB values above are what the pen actually wrote and are used only for
 * matching. Painting those same values into the infobox means a highlighter
 * yellow chosen for white paper landing on a dark panel, which is harsh in
 * some themes and invisible in others. Display goes through Obsidian's own
 * palette instead, so it is legible in whatever theme is running.
 */
const HL_SWATCH = {
  yellow:  "var(--color-yellow)",
  orange:  "var(--color-orange)",
  red:     "var(--color-red)",
  green:   "var(--color-green)",
  visited: "var(--text-muted)",
  explore: "var(--text-faint)",
  other:   "var(--text-faint)",
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
 * Every highlight counts on its own. A reader that writes one annotation per
 * visual line therefore reports one per line, which is what you asked for:
 * a highlight that wraps is two marks, because you dragged over two lines.
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
 * Drop every cached read of one PDF.
 *
 * All three caches are keyed on path:mtime, so an edited file normally
 * invalidates itself. Replacing a file from arXiv is the one case where the
 * new bytes land while the old entries are still the ones a mounted component
 * is holding, so that path clears them by hand.
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
// Writes only keys whose value actually changed, and reports whether it wrote.
// That check is what keeps an auto-updating infobox out of a
// write -> reindex -> rerender -> write loop.
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
 * Getting bytes from a host that has never heard of us.
 *
 * The page runs on app://obsidian.md, so anything cross-origin needs the server
 * to opt in with Access-Control-Allow-Origin. Semantic Scholar does. arXiv's
 * export API does not, and neither does a random publisher's book page — plain
 * `fetch` there fails at the browser, before a request is ever made.
 *
 * Three transports, best first:
 *
 *   requestUrl   Obsidian's own, no CORS at all. `require("obsidian")` inside a
 *                plugin is NOT window.require — it is a loader-local function
 *                Obsidian passes into the plugin bundle, and "obsidian" is not
 *                a resolvable module anywhere else. So this is only reachable
 *                by borrowing it off a loaded plugin's exports; when that works
 *                it is the cleanest option.
 *   node http(s) window.require IS Electron's require, and builtins always
 *                resolve. A Node request is not a browser request, so there is
 *                no origin and no preflight. Desktop only.
 *   fetch        the fallback, and fine for hosts that send the header.
 *
 * On mobile only the last one exists, which is why cross-origin callers below
 * ask `netCanCrossOrigin()` first and simply do nothing rather than firing a
 * request the console will paint red.
 */
let NET = null;

/**
 * arxiv.org turns away a request whose User-Agent looks like a script — that
 * is the whole of "Update to v7 failed with nothing in the console". The old
 * header said "Obsidian", arXiv answered 403 with a short HTML page, and the
 * only test on the way back was `byteLength < 1024`, which a 403 page passes.
 * The page runs inside Electron, so a desktop browser string is what this
 * actually is rather than a disguise.
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
 * One GET over Node, following redirects by hand — arxiv.org/pdf/… bounces at
 * least once, and Node, unlike fetch, does not chase it for you.
 *
 * Bytes only. Decoding a 3MB PDF into a string on the way past cost a copy and
 * bought nothing, so the caller decides whether it wanted text.
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
        // Collected as bytes and joined by hand rather than through Buffer:
        // a PDF must survive the trip intact, and string concatenation would
        // mangle it. One copy at the end.
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
 * host is known not to send CORS headers: if no transport can bypass that,
 * return null instead of asking fetch to fail loudly. `binary: true` asks for
 * the bytes and skips the text decode; on the fetch path (mobile) it is the
 * only way to get an arrayBuffer at all.
 *
 * The status is always handed back. Callers are expected to look at it: arXiv
 * says 403 with a perfectly well-formed body, and a body is not a yes.
 */
async function netGet(url, { crossOrigin = false, binary = false, headers } = {}) {
  const n = netProbe();
  const decode = (buf) => (buf ? new TextDecoder("utf-8").decode(new Uint8Array(buf)) : "");
  try {
    if (n.requestUrl) {
      const res = await n.requestUrl({ url, throw: false, headers });
      return { status: res.status, text: binary ? "" : res.text, arrayBuffer: res.arrayBuffer };
    }
    if (n.node) {
      const res = await nodeGet(url, { headers });
      return {
        status: res.status,
        text: binary ? "" : decode(res.bytes.buffer),
        arrayBuffer: res.bytes.buffer,
      };
    }
    if (crossOrigin) return null;                          // would only be a CORS error
    const res = await fetch(url, headers ? { headers } : undefined);
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

/**
 * Latest version number on arXiv, or null.
 *
 * The Atom feed's own <id> is the query URL and carries no /abs/, so matching
 * on /abs/…v(\d+) picks the entry rather than the feed. Cheap: one request,
 * no parsing beyond a regex, and only ever called when both `arxiv` and
 * `arxiv-version` are already set.
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

/**
 * Keep the copy that is about to be replaced.
 *
 * COPIED rather than renamed, deliberately. A rename through fileManager
 * rewrites every link that points at the file, so the note's own `paper:`
 * would follow the old version out of the way and the infobox would end up
 * reading the backup. This leaves the paper exactly where the note expects it
 * and parks the previous bytes beside it as `Name.v6.pdf.bk` — an extension
 * Obsidian does not index, so it stays out of the file list and out of search
 * while still being one rename away from usable.
 */
async function keepOldCopy(file, tag) {
  const dir = file.parent?.path && file.parent.path !== "/" ? `${file.parent.path}/` : "";
  const stem = file.name.replace(/\.pdf$/i, "");
  const label = tag ? `.${tag}` : "";
  const ad = app.vault.adapter;
  let target = `${dir}${stem}${label}.pdf.bk`;
  for (let n = 2; n < 50 && await ad.exists(target); n++) target = `${dir}${stem}${label}-${n}.pdf.bk`;
  await ad.writeBinary(target, await app.vault.readBinary(file));
  return target;
}

/**
 * Pull vN of a paper down and write it over the file already in the vault.
 *
 * Returns { ok, reason, backup } rather than a bare boolean. Every way this can
 * fail says which one it was, to the caller (so the button can show it) and
 * to the console.
 */
async function replaceArxivPdf(file, arxivId, version, { haveVersion = null } = {}) {
  const fail = (reason) => {
    console.warn("[pdf] arXiv update failed —", reason, { paper: file?.path, arxivId, version });
    return { ok: false, reason, backup: null };
  };

  const id = String(arxivId ?? "").replace(/^arxiv:\s*/i, "").replace(/v\d+$/i, "").trim();
  if (!file) return fail("no PDF resolved from this note");
  if (!id) return fail("no arXiv id on this note");
  if (!netCanCrossOrigin()) return fail("no transport can reach arxiv.org from here (mobile?)");

  const url = `https://arxiv.org/pdf/${id}v${version}`;
  const res = await netGet(url, {
    crossOrigin: true, binary: true, headers: { Accept: "application/pdf,*/*" },
  });

  if (!res) return fail("arxiv.org did not answer");
  if (res.status >= 400) return fail(`arXiv answered ${res.status} — it may be rate-limiting`);
  const buf = res.arrayBuffer;
  if (!buf) return fail("the response carried no bytes");
  if (!looksLikePdf(buf)) {
    return fail(`what came back is not a PDF (${buf.byteLength} bytes) — probably a holding page`);
  }

  let backup = null;
  try {
    backup = await keepOldCopy(file, haveVersion ? `v${haveVersion}` : null);
  } catch (e) {
    // Not fatal on its own, but it does mean the old copy is about to go, so
    // say so rather than losing it quietly.
    console.warn("[pdf] could not keep a backup of", file.path, e);
  }

  try {
    await app.vault.modifyBinary(file, buf);
  } catch (e) {
    console.warn("[pdf] could not write", file.path, e);
    return { ok: false, reason: "the vault refused the write", backup };
  }

  // Every cache is keyed on path:mtime and the new bytes carry a new one, but
  // a mounted component is still holding the old entries — drop them here so
  // no caller has to remember to.
  forgetPdf(file.path);
  return { ok: true, reason: null, backup };
}

/**
 * Has the paper moved on? Runs once, after paint, and only when the note
 * already knows which version it holds — there is nothing to compare against
 * otherwise.
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
 * TEN CHARACTERS, always — `[0-9a-z]{10}`, zero-padded so the width never
 * moves. It goes into frontmatter you have to look at, and the old
 * "length.hash" form ran to twelve and changed width from book to book.
 *
 * Two independent 32-bit rolls, each truncated to 25 bits and packed into one
 * 50-bit integer — comfortably inside the 53 bits a JS number carries exactly,
 * and 36^10 is 3.6e15, so 50 bits can never need an eleventh digit. Collisions
 * at 2^50 are not a concern for "did this one page change".
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
 * Not a checksum of the bytes — a page with a rotating ad or a build id would
 * never settle. The markup is stripped of everything that moves on its own and
 * then rolled up, which is stable enough that a real edition change moves it
 * and a page reload does not.
 *
 * Nothing here touches the vault or the DOM: it is one request and some string
 * work, called off a timer after paint (see useSiteHash), so opening a book
 * never waits on a web server.
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
 * It only ever reports. Nothing is downloaded and nothing is replaced — the
 * book is a file you keep, so the most this can do is put a word on screen.
 */
function useSiteHash(url, stored, enabled) {
  const [now, setNow] = dc.useState(null);
  // A hash written by an older version was a different shape entirely, so it
  // can only ever disagree with a new one. Treat it as no hash at all: the
  // first run quietly records today's, instead of crying "new release" once
  // for every book in the vault.
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
 * Looked up by arXiv id and cached into `citations:`. Only fetched when the
 * field is empty, so a note that already knows its count never hits the
 * network — and the number survives going offline.
 */
async function fetchCitations(arxivId) {
  const id = String(arxivId ?? "").replace(/^arxiv:\s*/i, "").replace(/v\d+$/i, "").trim();
  if (!id) return null;
  const url = `https://api.semanticscholar.org/graph/v1/paper/arXiv:${id}?fields=citationCount`;
  // Semantic Scholar does send CORS headers, so this one works on every
  // transport, mobile included — hence no `crossOrigin` flag.
  try {
    const res = await netGet(url);
    if (!res || (res.status && res.status >= 400)) return null;
    const json = JSON.parse(res.text);
    return Number.isFinite(json?.citationCount) ? json.citationCount : null;
  } catch {
    return null;                      // offline, rate-limited, or blocked
  }
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
  obsidianRequest, netGet, netCanCrossOrigin, looksLikePdf,
  arxivLatestVersion, replaceArxivPdf, useArxivUpdate,
  pageHash, shortHash, HASH_LEN, useSiteHash,
  parseLink, resolvePdf,
  readPdfStats, annotationProfile, renderPage, firstPageThumb, writeFields,
  fetchCitations, useCitations,
  usePdfStats, usePageImage, openAt,
};
