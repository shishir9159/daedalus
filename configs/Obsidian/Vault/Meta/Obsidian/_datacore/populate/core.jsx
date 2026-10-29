// ════════════════════════════════════════════════════════════════════════════
//  core.jsx  —  shared plumbing for the populate blocks
//  Location: Meta/Obsidian/_datacore/populate/core.jsx
//
//  Vault, frontmatter, string and byte helpers for paper/populate.jsx and
//  book/populate.jsx. The network is pdf.jsx's (netGet / netJson / fetchPdf),
//  the same transports the infoboxes use, re-exported here for convenience.
//
//  NOTE 1: Datacore evaluates a required file as a function body, not an ES
//  module. Exports are the object returned at the bottom.
//
//  NOTE 2: never declare a local named `h` in this file — it is the JSX pragma.
// ════════════════════════════════════════════════════════════════════════════

const pdf = await dc.require("Meta/Obsidian/_datacore/pdf/pdf.jsx");
const { CONFIG } = await dc.require("Meta/Obsidian/_datacore/populate/config.jsx");

const { netGet, netJson, netCanCrossOrigin, fetchPdf, fetchArxivPdf, looksLikePdf, resolvePdf } = pdf;

// ── runtime ─────────────────────────────────────────────────────────────────
/** A toast when Obsidian's Notice can be had, the console otherwise. */
function notify(msg, ms = 5000) {
  let N = globalThis.Notice;
  if (typeof N !== "function") {
    try { N = globalThis.require?.("obsidian")?.Notice; } catch { N = null; }
  }
  if (typeof N === "function") new N(msg, ms);
  else console.log("[populate]", msg);
}

/** One run per note at a time, even with it open in two panes. Keyed on the
 *  TFile, which keeps its identity through the rename a run may do. */
const BUSY = new WeakSet();

async function exclusive(file, fn) {
  if (BUSY.has(file)) return { ok: false, notes: ["already populating this note"] };
  BUSY.add(file);
  try { return await fn(); } finally { BUSY.delete(file); }
}

// ── vault ───────────────────────────────────────────────────────────────────
const fileAt = (path) => app.vault.getAbstractFileByPath(path) ?? null;

function parentFolder(path) {
  const i = String(path).lastIndexOf("/");
  return i < 0 ? "" : path.slice(0, i);
}

const joinPath = (folder, name) => (folder ? `${folder}/${name}` : name);

async function ensureFolder(folder) {
  if (!folder || fileAt(folder)) return;
  try { await app.vault.createFolder(folder); } catch { /* raced, or already there */ }
}

/** Windows- and Obsidian-safe file name. */
function sanitizeFileName(name) {
  return String(name ?? "")
    .replace(/[\\/:*?"<>|#^[\]]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^\.+|\.+$/g, "")
    .trim()
    .slice(0, 180);
}

async function saveBinary(folder, filename, arrayBuffer, { overwrite = false } = {}) {
  const path = joinPath(folder, filename);
  const existing = fileAt(path);
  if (existing && !overwrite) return { file: existing, created: false, reused: true };
  if (existing) {
    await app.vault.modifyBinary(existing, arrayBuffer);
    return { file: existing, created: false, updated: true };
  }
  await ensureFolder(folder);
  const file = await app.vault.createBinary(path, arrayBuffer);
  return { file, created: true };
}

/** Link text for frontmatter: the shortest unambiguous [[...]], or the vault's style. */
function linkTo(targetFile, sourcePath, alias = null) {
  if (CONFIG.linkStyle === "vault") {
    try {
      const l = app.fileManager.generateMarkdownLink(targetFile, sourcePath, undefined, alias ?? undefined);
      if (l) return l.replace(/^!/, "");
    } catch { /* fall through to a plain wikilink */ }
  }
  const name = targetFile.extension === "md" ? targetFile.basename : targetFile.name;
  let linkpath = targetFile.path;
  try {
    const dest = app.metadataCache.getFirstLinkpathDest(name, sourcePath);
    if (dest && dest.path === targetFile.path) linkpath = name;
  } catch { /* keep the full path */ }
  if (targetFile.extension === "md") linkpath = linkpath.replace(/\.md$/, "");
  return alias ? `[[${linkpath}|${alias}]]` : `[[${linkpath}]]`;
}

// ── which notes may be touched ──────────────────────────────────────────────
const isPlaceholder = (name) =>
  CONFIG.placeholderTitles.some((p) => String(name ?? "").toLowerCase().startsWith(p.toLowerCase()));

/** { ok, file } — or why not: the note is missing, or it is a template. */
function guardPath(path) {
  const file = path ? fileAt(path) : null;
  if (!file) return { ok: false, code: "no-file", message: "this note is not in the vault yet" };
  for (const folder of CONFIG.inertFolders) {
    const root = folder.replace(/\/$/, "");
    if (path === root || path.startsWith(root + "/")) {
      return { ok: false, code: "template", file, message: "template — the box works once a note is made from it" };
    }
  }
  return { ok: true, code: "ok", file };
}

/**
 * `file`, renamed to `basename` in its own folder with its extension kept.
 * Links to it follow, through renameFile. Never over another file.
 */
async function renameTo(file, basename) {
  const name = sanitizeFileName(basename);
  if (!name) return null;
  const to = joinPath(parentFolder(file.path), `${name}.${file.extension}`);
  if (to === file.path) return null;
  if (fileAt(to)) return { skipped: `kept the name "${file.name}": ${name}.${file.extension} already exists here` };
  const from = file.path;
  await app.fileManager.renameFile(file, to);
  return { from, to: file.path };
}

/**
 * A note still called "Untitled" takes the name of what it holds — the title
 * without its subtitle, which has a key of its own. A colon left in becomes
 * " - ", which the paper infobox's splitTitle still reads as the subtitle.
 */
async function renameFromTitle(file, title) {
  if (!CONFIG.renameUntitled || !title || !isPlaceholder(file.basename)) return null;
  return renameTo(file, String(title).replace(/\s*:\s+/g, " - "));
}

/** What a note's PDF or cover is called: the note's name, or the title while
 *  the note is still "Untitled" because its rename was skipped. */
const assetName = (file, title) =>
  sanitizeFileName(isPlaceholder(file.basename) && title ? title : file.basename);

// ── a PDF that is already here ──────────────────────────────────────────────
const isPdf = (f) => !!f?.stat && String(f.extension ?? "").toLowerCase() === "pdf";

/** Does any note other than `exceptPath` link to `target`? */
function linkedElsewhere(target, exceptPath) {
  for (const [src, dests] of Object.entries(app.metadataCache.resolvedLinks ?? {})) {
    if (src !== exceptPath && dests?.[target.path]) return true;
  }
  return false;
}

/**
 * The PDF a note should own, when it is already in the vault — the note's own
 * folder first:
 *   1. the one `link` points at (a typed `paper:`, a `title:` link)
 *   2. one beside the note called any of `names`
 *   3. the one PDF beside the note that `match` accepts (named after the arXiv id)
 *   4. the only PDF in a folder holding no other note: the empty folder the
 *      template was used in
 *   5. one called any of `names` anywhere else in the vault
 * 2–4 pass over PDFs another note links to, and 3–4 give up when more than
 * one qualifies. → { file, how, shared } | null; `shared` = another note links it.
 */
function findOwnPdf(note, { link = null, names = [], match = null } = {}) {
  const found = (file, how) => ({ file, how, shared: linkedElsewhere(file, note.path) });

  const linked = link ? resolvePdf(link, note.path) : null;
  if (linked) return found(linked, "linked");

  const folder = parentFolder(note.path);
  const here = app.vault.getFiles().filter((f) => parentFolder(f.path) === folder);
  const free = here.filter((f) => isPdf(f) && !linkedElsewhere(f, note.path));

  const named = free.find((f) => names.includes(f.name));
  if (named) return found(named, "named");
  if (match) {
    const hits = free.filter(match);
    if (hits.length === 1) return found(hits[0], "matched");
  }
  const otherNotes = here.some((f) => f.extension === "md" && f.path !== note.path);
  if (!otherNotes && free.length === 1) return found(free[0], "alone");

  for (const name of names) {
    const hit = name ? app.metadataCache.getFirstLinkpathDest(name, note.path) : null;
    if (isPdf(hit)) return found(hit, "named");
  }
  return null;
}

/**
 * findOwnPdf, then the PDF renamed to `basename` — unless another note links
 * it too. → { file, how, was, renamed, skipped } | null; `was` is its old name.
 */
async function claimPdf(note, basename, opts) {
  const own = findOwnPdf(note, opts);
  if (!own) return null;
  const was = own.file.name;
  const r = own.shared ? null : await renameTo(own.file, basename);
  return {
    ...own,
    was,
    renamed: !!r?.to,
    skipped: own.shared ? `kept the name "${was}": another note links it` : r?.skipped ?? null,
  };
}

// ── frontmatter ─────────────────────────────────────────────────────────────
/** undefined / null / "" / [] / [""] all count as "not filled in yet". */
function isBlank(v) {
  if (v === undefined || v === null) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0 || v.every(isBlank);
  return false;
}

const frontmatterOf = (file) => app.metadataCache.getFileCache(file)?.frontmatter ?? {};

/**
 * Write values into the note, never over anything already typed. Assigning to
 * an existing key keeps its place, which is why the templates ship every key
 * empty. `force` names keys that are written regardless (the id the run was
 * started from, a YAML-mangled isbn).
 */
async function patchFrontmatter(file, values, { force = [] } = {}) {
  const current = frontmatterOf(file);
  const forced = new Set(force);
  const plan = {}, skipped = [];

  for (const [k, v] of Object.entries(values)) {
    if (v === undefined || isBlank(v)) continue;
    const present = Object.prototype.hasOwnProperty.call(current, k);
    if (!present && !CONFIG.addMissingKeys && !forced.has(k)) { skipped.push([k, "key absent from note"]); continue; }
    if (present && !isBlank(current[k]) && !forced.has(k)) { skipped.push([k, "already set"]); continue; }
    if (present && String(current[k]) === String(v)) { skipped.push([k, "unchanged"]); continue; }
    plan[k] = v;
  }

  const keys = Object.keys(plan);
  if (keys.length) {
    await app.fileManager.processFrontMatter(file, (fm) => {
      for (const k of keys) fm[k] = plan[k];
    });
  }
  return { plan, applied: keys, skipped };
}

// ── the block itself ────────────────────────────────────────────────────────
const FENCE = /^[ \t]{0,3}(`{3,})[ \t]*datacorejsx[^\n]*\n[\s\S]*?^[ \t]{0,3}\1[ \t]*\r?(?:\n|$)/gm;

/** A datacorejsx block calling `module` with `<Component path={…} />`. */
const blockFor = (module, component) => [
  "```datacorejsx",
  `const { ${component} } = await dc.require("Meta/Obsidian/_datacore/${module}");`,
  `return function View() { return <${component} path={dc.useCurrentPath()} />; };`,
  "```",
  "",
].join("\n");

/**
 * Swap the datacorejsx block whose source mentions `marker` for `replacement`
 * — or just remove it, when the note already holds a block mentioning
 * `replacementMarker`. Every other block (an infobox) is left alone.
 */
async function swapCodeBlock(file, marker, replacement = "", replacementMarker = null) {
  let swapped = 0;
  const rewrite = (data) => {
    swapped = 0;
    const blocks = data.match(new RegExp(FENCE.source, "gm")) ?? [];
    const already = !!replacementMarker && blocks.some((b) => b.includes(replacementMarker));
    const out = data.replace(new RegExp(FENCE.source, "gm"), (block) => {
      if (!block.includes(marker)) return block;
      swapped++;
      return swapped === 1 && replacement && !already ? replacement : "";
    });
    return swapped ? out.replace(/\n{3,}/g, "\n\n") : data;
  };
  if (typeof app.vault.process === "function") await app.vault.process(file, rewrite);
  else await app.vault.modify(file, rewrite(await app.vault.read(file)));
  return swapped;
}

/** A finished run: the populate block goes, the infobox takes its place. */
function finish(file, kind, marker) {
  const infobox = `${kind}/infobox.jsx`;
  return swapCodeBlock(file, marker, CONFIG.swapForInfobox ? blockFor(infobox, "Infobox") : "", infobox);
}

// ── text ────────────────────────────────────────────────────────────────────
const squish = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

function asciiFold(s) {
  return String(s ?? "")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l").replace(/Ł/g, "L")
    .replace(/ø/g, "o").replace(/Ø/g, "O")
    .replace(/đ/g, "d").replace(/Đ/g, "D")
    .replace(/ß/g, "ss").replace(/æ/g, "ae").replace(/œ/g, "oe")
    .replace(/[’']/g, "");
}

function stripHtml(s) {
  return squish(String(s ?? "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/&[lr]rm;|[‎‏]/g, ""));
}

/** Deduped case-insensitively, blanks dropped, first spelling kept. */
function uniq(arr) {
  const seen = new Set(), out = [];
  for (const x of arr ?? []) {
    const v = squish(x);
    const k = v.toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k); out.push(v);
  }
  return out;
}

const normTitle = (s) => asciiFold(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const escapeRe = (s) => String(s ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * "BERT: Pre-training of Deep Bidirectional Transformers" →
 * { title: "BERT", subtitle: "Pre-training of Deep Bidirectional Transformers" },
 * split at the first ": ". A subtitle the source keeps separately wins, and
 * comes off the title if it was repeated there.
 */
function splitSubtitle(full, given = null) {
  const t = squish(full), sub = squish(given);
  const m = t.match(/^(.+?)\s*:\s+(.+)$/);
  if (sub) return { title: (m && m[2].toLowerCase() === sub.toLowerCase() ? m[1] : t) || null, subtitle: sub };
  return m ? { title: m[1], subtitle: m[2] } : { title: t || null, subtitle: null };
}

function lastName(fullName) {
  const parts = squish(fullName).split(" ").filter(Boolean);
  if (parts.length < 2) return parts[0] ?? "";
  const particles = new Set(["van", "von", "de", "del", "della", "di", "da", "der", "den", "ter", "le", "la", "bin", "ibn"]);
  let i = parts.length - 1;
  while (i > 0 && particles.has(parts[i - 1].toLowerCase())) i--;
  return parts.slice(i).join(" ");
}

const CITEKEY_STOP = new Set([
  "a", "an", "the", "on", "of", "in", "for", "and", "to", "from", "at", "by",
  "with", "into", "over", "via", "is", "are", "be", "as", "or", "toward", "towards",
]);

/** vaswani2017attention */
function makeCitekey(authors, year, title) {
  const surname = asciiFold(lastName((authors ?? [])[0] ?? "")).toLowerCase().replace(/[^a-z]/g, "");
  const word = asciiFold(title ?? "").toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ").split(/\s+/)
    .find((w) => w.length > 2 && !CITEKEY_STOP.has(w)) ?? "";
  if (!surname || !year) return null;
  return surname + year + word;
}

/** "2017-06-12T17:57:34Z" → "2017-06-12". null for year- or month-only values. */
function isoDate(v) {
  if (!v) return null;
  const s = String(v).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  if (/^\d{4}(-\d{1,2})?$/.test(s)) return null;
  const d = new Date(s);
  if (isNaN(d.valueOf())) return null;
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function yearOf(v) {
  const m = String(v ?? "").match(/(1[5-9]\d{2}|20\d{2})/);
  return m ? Number(m[1]) : null;
}

// ── bytes ───────────────────────────────────────────────────────────────────
/** Pixel dimensions straight out of the bytes: no DOM, no Image(). */
function imageSize(buffer) {
  const b = new Uint8Array(buffer);
  if (b.length < 24) return null;

  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    const dv = new DataView(buffer);
    return { ext: "png", width: dv.getUint32(16), height: dv.getUint32(20) };
  }
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) {
    return { ext: "gif", width: b[6] | (b[7] << 8), height: b[8] | (b[9] << 8) };
  }
  if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42) {
    const tag = String.fromCharCode(b[12], b[13], b[14], b[15]);
    if (tag === "VP8X") {
      return {
        ext: "webp",
        width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)),
        height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)),
      };
    }
    if (tag === "VP8 ") {
      return { ext: "webp", width: (b[26] | (b[27] << 8)) & 0x3fff, height: (b[28] | (b[29] << 8)) & 0x3fff };
    }
    if (tag === "VP8L") {
      const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
      return { ext: "webp", width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    return { ext: "webp", width: 0, height: 0 };
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
      const len = (b[i + 2] << 8) | b[i + 3];
      const isSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSOF) return { ext: "jpg", height: (b[i + 5] << 8) | b[i + 6], width: (b[i + 7] << 8) | b[i + 8] };
      if (len < 2) break;
      i += 2 + len;
    }
    return { ext: "jpg", width: 0, height: 0 };
  }
  return null;
}

/** Best-effort page count from raw PDF bytes. Fails soft on object-stream PDFs. */
function pdfPageCount(buffer) {
  const b = new Uint8Array(buffer);
  let s = "";
  for (let i = 0; i < b.length; i += 8192) {
    s += String.fromCharCode.apply(null, b.subarray(i, Math.min(i + 8192, b.length)));
  }
  let best = 0;
  for (const m of s.matchAll(/\/Type\s*\/Pages[\s\S]{0,800}?\/Count\s+(\d+)/g)) best = Math.max(best, Number(m[1]));
  if (!best) for (const m of s.matchAll(/\/Count\s+(\d+)[\s\S]{0,300}?\/Type\s*\/Pages/g)) best = Math.max(best, Number(m[1]));
  if (!best) best = (s.match(/\/Type\s*\/Page[^s]/g) || []).length;
  return best > 0 && best < 20000 ? best : null;
}

// ── isbn ────────────────────────────────────────────────────────────────────
function isbn13Check(d12) {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(d12[i]) * (i % 2 ? 3 : 1);
  return String((10 - (sum % 10)) % 10);
}

function isbn10Check(d9) {
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(d9[i]) * (10 - i);
  const c = (11 - (sum % 11)) % 11;
  return c === 10 ? "X" : String(c);
}

function isbnCheckOk(raw) {
  const s = String(raw ?? "").toUpperCase().replace(/[^0-9X]/g, "");
  if (s.length === 10) return /^\d{9}[\dX]$/.test(s) && isbn10Check(s.slice(0, 9)) === s[9];
  if (s.length === 13) return /^\d{13}$/.test(s) && isbn13Check(s.slice(0, 12)) === s[12];
  return false;
}

/**
 * YAML turns `isbn: 0262039249` into the number 262039249 and drops the
 * leading zero. Re-pad until the check digit validates.
 */
function recoverIsbn(raw) {
  const s = String(raw ?? "").trim();
  const digits = s.toUpperCase().replace(/[^0-9X]/g, "");
  if (isbnCheckOk(digits)) return digits;
  for (const target of [10, 13]) {
    if (digits.length < target && target - digits.length <= 2) {
      const padded = digits.padStart(target, "0");
      if (isbnCheckOk(padded)) return padded;
    }
  }
  return digits;
}

/** A checksummed ISBN-10 or -13 → both forms (979- has no ISBN-10). */
function normalizeIsbn(raw) {
  const s = String(raw ?? "").toUpperCase().replace(/[^0-9X]/g, "");
  if (!isbnCheckOk(s)) return { isbn10: null, isbn13: null };
  if (s.length === 10) {
    const core = "978" + s.slice(0, 9);
    return { isbn10: s, isbn13: core + isbn13Check(core) };
  }
  if (s.startsWith("978")) {
    const d9 = s.slice(3, 12);
    return { isbn10: d9 + isbn10Check(d9), isbn13: s };
  }
  return { isbn10: null, isbn13: /^979/.test(s) ? s : null };
}

/** "978-0262039246", the frontmatter style. */
const formatIsbn13 = (isbn13) =>
  isbn13 && isbn13.length === 13 ? `${isbn13.slice(0, 3)}-${isbn13.slice(3)}` : isbn13 ?? null;

return {
  CONFIG,
  // network and links, from pdf.jsx
  netGet, netJson, netCanCrossOrigin, fetchPdf, fetchArxivPdf, looksLikePdf, resolvePdf,
  // runtime
  notify, exclusive,
  // vault
  fileAt, parentFolder, joinPath, ensureFolder, sanitizeFileName, saveBinary, linkTo,
  isPlaceholder, guardPath, renameTo, renameFromTitle, assetName,
  // a PDF already here
  isPdf, linkedElsewhere, findOwnPdf, claimPdf,
  // frontmatter
  isBlank, frontmatterOf, patchFrontmatter,
  // the block
  blockFor, swapCodeBlock, finish,
  // text
  squish, asciiFold, stripHtml, uniq, normTitle, escapeRe, splitSubtitle,
  lastName, makeCitekey, isoDate, yearOf,
  // bytes
  imageSize, pdfPageCount,
  // isbn
  isbnCheckOk, recoverIsbn, normalizeIsbn, formatIsbn13,
};
