// ════════════════════════════════════════════════════════════════════════════
//  core.jsx  —  shared engine for the book views
//  Location: Meta/Obsidian/_datacore/book/core.jsx
//
//  NOTE 1: Datacore evaluates required files as a function body, not an ES
//  module. Exports are the object returned at the bottom — `export` / `import`
//  are a syntax error here.
//
//  NOTE 2: all book data is read from `app.metadataCache`, not from Datacore's
//  page objects. Inside a required module `dc.useCurrentFile()` resolves to the
//  module, not to the note being rendered, which is why every field came back
//  empty. Reading the cache directly also means edits show up immediately
//  instead of waiting for a reindex.
// ════════════════════════════════════════════════════════════════════════════

// ── config ──────────────────────────────────────────────────────────────────
const TIER_COLOR = {
  "S++": "red", "S+": "red", "S": "red",
  "A+": "orange", "A": "orange",
  "B+": "yellow", "B": "yellow",
  "C": "green", "D": "blue", "F": "purple",
};

const STATUS_COLOR = {
  reading: "blue",
  completed: "green", finished: "green", read: "green",
  planned: "purple", "to-read": "purple", backlog: "purple", next: "purple",
  paused: "yellow", "on-hold": "yellow",
  dropped: "red", abandoned: "red",
  reference: "cyan",
};

/**
 * The two things `shelf` and `wood` pick, kept apart because they answer
 * different questions.
 *
 *   shelf  WHAT THE FURNITURE IS. A whole design: case, board, plate, bookend,
 *          end walls, lamp, the blank cover, the spine. "medieval" is the
 *          library this started as; "art deco" is the gold-on-black cinema
 *          foyer. Everything else in the view composes with either.
 *   wood   WHICH BOARD, inside the medieval design only — art deco has no
 *          timber to choose.
 */
const SHELF_STYLES = ["medieval", "art deco"];
const SHELF_MODES = ["oak", "walnut", "concrete", "board", "ebony", "macassar"];

/** The class the style goes on. Unknown values fall back to medieval. */
const styleClass = (s) => (String(s ?? "").toLowerCase() === "art deco" ? "deco" : "medieval");

/**
 * The board a design defaults to when `wood` is not given.
 *
 * Deco is a veneer-and-brass idiom, so its natural default is ebony rather
 * than oak — but the choice stays open either way. Every material works under
 * either design; ebony and macassar simply belong to deco the way oak belongs
 * to the library.
 */
const DEFAULT_WOOD = { deco: "ebony", medieval: "oak" };
const woodFor = (style, wood) => wood ?? DEFAULT_WOOD[styleClass(style)] ?? "oak";

/**
 * Folders never collected into a shelf, however they are tagged. Template notes
 * carry the same `#book` tag by design, so they would otherwise show up as
 * ghost books on every shelf.
 */
const IGNORE_PATHS = ["Meta/Obsidian/Templates/"];

const isIgnored = (p) => IGNORE_PATHS.some((d) => String(p ?? "").startsWith(d));

const READING = ["reading"];
const UPCOMING = ["planned", "to-read", "backlog", "next", "queued"];
const DONE = ["completed", "finished", "read", "done"];

const TIER_RANK = { "S++": 0, "S+": 1, "S": 2, "A+": 3, "A": 4, "B+": 5, "B": 6, "C": 7, "D": 8, "F": 9 };

// ── tiny helpers ────────────────────────────────────────────────────────────
const clamp = (lo, v, hi) => Math.min(hi, Math.max(lo, v));

const tint = (name) => name
  ? { background: `rgba(var(--color-${name}-rgb), 0.12)`, color: `var(--color-${name})` }
  : { background: "var(--background-modifier-hover)", color: "var(--text-muted)" };

const fmtDate = (v) => {
  if (!v) return null;
  if (typeof v?.toFormat === "function") return v.toFormat("dd LLL yyyy");
  const d = new Date(v);
  return isNaN(d.getTime())
    ? String(v)
    : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const hashOf = (s) => {
  let h = 0;
  const str = String(s ?? "");
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
};

/** Deterministic rest-lean for a shelved book, in degrees. Stable per path. */
const tiltFor = (seed, spread = 1.7) => {
  const n = (hashOf(seed) % 1000) / 1000;
  return `${(n * spread * 2 - spread).toFixed(2)}deg`;
};

const baseName = (p) => String(p ?? "").split("/").pop()?.replace(/\.[^.]+$/, "") ?? "";

// ── wikilinks ───────────────────────────────────────────────────────────────
// Raw frontmatter gives us "[[path/to/thing.pdf|Label]]" strings, so we parse
// them ourselves rather than depending on Datacore's Link objects.
const LINK_RE = /^\s*!?\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]\s*$/;

const parseLink = (v) => {
  if (v == null) return null;
  if (typeof v === "object") {
    return v.path ? { path: v.path, subpath: v.subpath ?? null, display: v.display ?? null } : null;
  }
  const m = String(v).match(LINK_RE);
  return m
    ? { path: m[1].trim(), subpath: m[2]?.trim() ?? null, display: m[3]?.trim() ?? null }
    : null;
};

const resolveFile = (linkish, sourcePath) => {
  const l = parseLink(linkish);
  const p = l?.path ?? (typeof linkish === "string" && !LINK_RE.test(linkish) ? linkish : null);
  if (!p) return null;
  return app.metadataCache.getFirstLinkpathDest(p, sourcePath ?? "") ?? null;
};

function NoteLink({ link, sourcePath, children }) {
  const l = parseLink(link);
  if (!l) return <>{link == null ? null : String(link)}</>;
  const label = children ?? l.display ?? baseName(l.path);
  return (
    <a
      class="internal-link"
      href="#"
      onClick={(e) => {
        e.preventDefault();
        app.workspace.openLinkText(
          l.path + (l.subpath ? `#${l.subpath}` : ""),
          sourcePath ?? "",
          e.ctrlKey || e.metaKey,
        );
      }}
    >{label}</a>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  Which note are we rendering for?
//
//  `dc.useCurrentPath()` is reliable inside a ```datacorejsx block but not
//  inside a required module, so views take an explicit `path` prop and only
//  fall back to detection. Anything that looks like a script path is rejected.
// ════════════════════════════════════════════════════════════════════════════
const isScript = (p) => /\.(jsx|tsx|js|ts)$/i.test(String(p ?? ""));

function useNotePath(explicit) {
  const fromDc = typeof dc.useCurrentPath === "function" ? dc.useCurrentPath() : null;
  const candidate = explicit ?? (isScript(fromDc) ? null : fromDc);
  const [active, setActive] = dc.useState(() => app.workspace.getActiveFile()?.path ?? null);

  dc.useEffect(() => {
    if (candidate) return;
    const ref = app.workspace.on("file-open", (f) => setActive(f?.path ?? null));
    return () => app.workspace.offref(ref);
  }, [candidate]);

  return candidate ?? active;
}

/** Raw frontmatter for a note, re-read on every metadataCache change. */
function useFrontmatter(path) {
  const read = () => (path ? app.metadataCache.getCache(path)?.frontmatter ?? {} : {});
  const [fm, setFm] = dc.useState(read);

  dc.useEffect(() => {
    setFm(read());
    const ref = app.metadataCache.on("changed", (file) => {
      if (file?.path === path) setFm(read());
    });
    return () => app.metadataCache.offref(ref);
  }, [path]);

  return fm;
}

// ════════════════════════════════════════════════════════════════════════════
//  Book model
// ════════════════════════════════════════════════════════════════════════════
function useBook(notePath) {
  const path = notePath ?? null;
  const fm = useFrontmatter(path);
  const get = (k) => fm?.[k] ?? null;

  const pages = Number(get("pages")) || 0;
  const progress = Number(get("progress")) || 0;      // pages read
  const status = String(get("status") ?? "").toLowerCase().trim();
  const tier = get("tier");

  // `completed: true` (or a finished status) is a deliberate statement by you.
  // Reaching the last page is only an inference — you may be re-reading.
  // `completed` is explicit and wins both ways; everything else is inference.
  const markedDone =
    get("completed") === true ? true
    : get("completed") === false ? false
    : DONE.includes(status);
  const finished =
    get("completed") === false ? false : (markedDone || (pages > 0 && progress >= pages));

  const pct = pages > 0 ? clamp(0, (progress / pages) * 100, 100) : 0;

  const title = get("title");
  const cover = get("cover");
  const titleLink = parseLink(title);

  return {
    path, fm, get, pages, progress, status, tier,
    markedDone, finished, pct, title, cover, titleLink,
    name: titleLink?.display ?? (typeof title === "string" && !titleLink ? title : null) ?? baseName(path),
    pdf: resolveFile(title, path) ?? resolveFile(cover, path),
    tierColor: TIER_COLOR[tier],
    statusColor: STATUS_COLOR[status],
  };
}

// shared drag latch, so a drop never fires the cover's click handler
let lastDragEnd = 0;
const markDragEnd = () => { lastDragEnd = Date.now(); };

/**
 * Open the book's PDF at the page you're on.
 * Obsidian's PDF view honours a `#page=N` subpath, so `progress` is a real
 * bookmark: click a cover anywhere and you land where you left off.
 */
const openBook = (book, evt, { atPage, force } = {}) => {
  if (!force && Date.now() - lastDragEnd < 250) return;   // a drag isn't a click
  const target = parseLink(book.title)?.path ?? parseLink(book.cover)?.path;
  if (!target) return;
  evt?.preventDefault?.();
  evt?.stopPropagation?.();
  const newTab = !!(evt && (evt.ctrlKey || evt.metaKey || evt.button === 1));
  const p = atPage ?? book.progress;
  const link = /\.pdf$/i.test(target) && p > 0 ? `${target}#page=${p}` : target;
  app.workspace.openLinkText(link, book.path ?? "", newTab);
};

// ════════════════════════════════════════════════════════════════════════════
//  PDF work lives in one place now
//
//  Loading pdf.js, caching documents, reading annotations, rasterising pages
//  AND writing frontmatter are all shared with the paper infobox, so they live
//  in Meta/Obsidian/_datacore/pdf/pdf.jsx rather than being duplicated here.
//
//  `writeFields` in particular used to exist twice, and the two disagreed: this
//  file's copy assigned unconditionally, so a view that wrote a value it had
//  just read triggered a reindex, which re-rendered it, which wrote again. The
//  surviving version compares first and reports whether it actually wrote,
//  which is what breaks that loop.
// ════════════════════════════════════════════════════════════════════════════
const pdf = await dc.require("Meta/Obsidian/_datacore/pdf/pdf.jsx");
const {
  firstPageThumb, annotationProfile, pageHash, useSiteHash, writeFields,
} = pdf;

const writeProgress = (notePath, value, key = "progress") =>
  writeFields(notePath, { [key]: value });

/**
 * Auto-advance `progress` from the furthest annotation, and keep the underline
 * count current. Underlines are the "I do not follow this" mark; the number is
 * written to frontmatter so it is queryable across the vault, but the infobox
 * deliberately does not show it — a book's fore-edge is about how far you got,
 * not about how confused you were.
 *
 * Guards on progress, in order:
 *   • `completed: true` or a finished status → never touch. You may be
 *     re-reading from the beginning, and the old highlights are still in there.
 *   • detected <= stored → never touch. Your manual value wins ties.
 *   • detected beyond the page count → never touch.
 */
function useAnnotations(book, { enabled = true, heatmap = false, buckets = 34, field = "progress" } = {}) {
  const [data, setData] = dc.useState({ last: null, heat: null, total: 0, underlines: 0, explore: 0 });

  dc.useEffect(() => {
    if (!enabled || !book?.pdf) return;
    let alive = true;

    const id = window.setTimeout(async () => {
      const res = await annotationProfile(book.pdf, { profile: heatmap, buckets });
      if (!alive) return;
      setData(res);

      // these track the PDF whatever the reading state
      const patch = {};
      if ((res.underlines ?? 0) !== (Number(book.get("underlines")) || 0)) {
        patch.underlines = res.underlines || null;
      }
      if ((res.explore ?? 0) !== (Number(book.get("explore")) || 0)) {
        patch.explore = res.explore || null;
      }

      const p = res.last;
      const beyondBook = book.pages > 0 && p != null && p > book.pages;
      if (!book.markedDone && p != null && p > book.progress && !beyondBook) {
        patch[field] = p;
      }
      if (Object.keys(patch).length) await writeFields(book.path, patch);
    }, 350);

    return () => { alive = false; window.clearTimeout(id); };
  }, [book?.pdf?.path, book?.progress, book?.markedDone, enabled, heatmap, buckets]);

  return data;
}

// ════════════════════════════════════════════════════════════════════════════
//  Artwork lookup
//
//  One place that answers "where is this book's picture", so the cover, the
//  dominant-colour sampler and the heaps on top of the case cannot drift apart.
//  A PDF is not artwork — it is rasterised separately — so it is filtered out
//  here rather than in three different callers.
// ════════════════════════════════════════════════════════════════════════════
const coverSrc = (book) => {
  const tf = resolveFile(book.cover, book.path);
  return tf && tf.extension !== "pdf" ? app.vault.getResourcePath(tf) : null;
};

const useCoverSrc = (book) =>
  dc.useMemo(() => coverSrc(book), [book.cover, book.path]);

/**
 * A real spine photograph, if the shelf has one to show.
 *
 * Looked up in this order, all cheap path probes — no vault scan:
 *
 *   1. a `spine:` wikilink in the book's frontmatter
 *   2. next to the cover / PDF, any of
 *        <basename> - spine.<ext>   <basename> spine.<ext>
 *        <basename>-spine.<ext>     <basename>_spine.<ext>
 *        spine.<ext>
 *   3. nothing, and the caller draws generated cloth instead
 */
const SPINE_EXT = ["jpg", "jpeg", "png", "webp", "avif"];
const _spineCache = new Map();

function findSpineImage(book) {
  if (!book?.path) return null;
  if (_spineCache.has(book.path)) return _spineCache.get(book.path);

  let found = resolveFile(book.get?.("spine"), book.path);

  if (!found) {
    const anchor = resolveFile(book.cover, book.path) ?? book.pdf;
    if (anchor) {
      const folder = anchor.path.split("/").slice(0, -1).join("/");
      const base = baseName(anchor.path);
      const names = [`${base} - spine`, `${base} spine`, `${base}-spine`, `${base}_spine`, "spine"];
      outer:
      for (const n of names) {
        for (const ext of SPINE_EXT) {
          const f = app.vault.getAbstractFileByPath(folder ? `${folder}/${n}.${ext}` : `${n}.${ext}`);
          if (f) { found = f; break outer; }
        }
      }
    }
  }

  _spineCache.set(book.path, found ?? null);
  return found ?? null;
}

const useSpineImage = (book, enabled = true) =>
  dc.useMemo(() => {
    if (!enabled) return null;
    const f = findSpineImage(book);
    return f ? app.vault.getResourcePath(f) : null;
  }, [enabled, book.path, book.cover]);

// ════════════════════════════════════════════════════════════════════════════
//  Dominant cover colour — used by the generated cloth spine
// ════════════════════════════════════════════════════════════════════════════
const _color = new Map();

const hslFrom = (r, g, b) => {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const mx = Math.max(rn, gn, bn), mn = Math.min(rn, gn, bn), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === rn) h = ((gn - bn) / d) % 6;
    else if (mx === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
  }
  h = (h * 60 + 360) % 360;
  const l = (mx + mn) / 2;
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  return { h, s: s * 100, l: l * 100 };
};

async function dominantColor(src, seed = "") {
  const fallback = () => ({ h: hashOf(seed) % 360, s: 26, l: 27 });
  if (!src) return fallback();
  if (_color.has(src)) return _color.get(src);

  try {
    const img = new Image();
    img.src = src;
    await img.decode();

    const W = 24, H = 36;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, W, H);
    const d = ctx.getImageData(0, 0, W, H).data;

    const bins = new Map();
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const { s, l } = hslFrom(r, g, b);
      if (l > 94 || l < 6) continue;                       // skip paper white / pure black
      const k = `${r >> 6}-${g >> 6}-${b >> 6}`;
      const w = 1 + s / 40;
      const prev = bins.get(k) ?? { w: 0, r: 0, g: 0, b: 0 };
      bins.set(k, { w: prev.w + w, r: prev.r + r * w, g: prev.g + g * w, b: prev.b + b * w });
    }
    if (!bins.size) throw new Error("no usable pixels");

    const top = [...bins.values()].sort((a, b) => b.w - a.w)[0];
    const hsl = hslFrom(top.r / top.w, top.g / top.w, top.b / top.w);
    // 29% is the highest lightness at which white spine text still clears
    // WCAG 4.5:1 for every hue, once the +2% gradient is applied
    const out = { h: hsl.h, s: clamp(14, hsl.s, 52), l: clamp(18, hsl.l, 29) };
    _color.set(src, out);
    return out;
  } catch {
    const out = fallback();
    _color.set(src, out);
    return out;
  }
}

function useCoverColor(book) {
  const [c, setC] = dc.useState(null);
  const src = useCoverSrc(book);

  dc.useEffect(() => {
    let alive = true;
    dominantColor(src, book.path).then((v) => alive && setC(v));
    return () => { alive = false; };
  }, [src, book.path]);

  return c ?? { h: hashOf(book.path) % 360, s: 26, l: 27 };
}

// ════════════════════════════════════════════════════════════════════════════
//  <BookCover /> — image → PDF first page → typeset placeholder
//
//  ONE component draws the artwork everywhere. What is allowed to touch it is
//  an argument, so a caller opts into an effect rather than inheriting whatever
//  the last stylesheet happened to say.
//
//    effects="none"     bare image. No board, no shadow.
//    effects="plain"    image + the drop shadow it casts. NOTHING is painted
//                       over the artwork: no spine gradient, no corner sheen,
//                       no tint, no filter. The pixels you supplied are the
//                       pixels on screen. ← the infobox
//    effects="board"    + the hardcover treatment: spine gradient, corner
//                       sheen and hairline edge, in an overlay ABOVE the image.
//    effects="lit"      board, and the shelf's lamps may grade the artwork
//                       (a brightness/saturation ramp tied to --beam-i). ← the
//                       shelf, where the lighting is the whole point.
//
//  Two named wrappers below spell out the two real uses, so neither caller has
//  to remember which string means what.
//
//  On sharpness. Nothing here sets a scale transform or a compositing hint on
//  the image: a cover drawn at 260px and then scaled to 267.8px is resampled,
//  and a promoted layer rasterises once at the layer's own scale and stays
//  soft. Both read as "the cover went blurry". Callers should also ask for a
//  raster comfortably wider than the box it lands in, and — since Obsidian
//  1.13.7 downsamples with a plain bilinear filter — keep that box at or above
//  FACE_MIN, or the type set on the artwork stops resolving.
// ════════════════════════════════════════════════════════════════════════════
const COVER_FX = new Set(["none", "plain", "board", "lit"]);

/**
 * A book with no artwork, drawn as a book rather than as a placeholder.
 *
 * This is the study's front view: cloth in a colour the path picks, the dark
 * roll of the spine down the left, the page block along the fore-edge, and the
 * title and author set between two rules in the middle. Gilt or silver, again
 * by path, so a shelf of coverless books looks like a shelf rather than a row
 * of the same swatch.
 *
 * A blank cover used to be a flat gradient with the filename on it, which read
 * as a missing image. Nothing here needs a file to exist.
 */
function BlankCover({ book }) {
  const key = hashOf(book.path);
  const author = dc.useMemo(() => {
    const raw = [].concat(book.get?.("author") ?? book.get?.("authors") ?? [])[0];
    const s = String(raw ?? "").replace(/^\[\[|\]\]$/g, "").split("|").pop().trim();
    return s || null;
  }, [book.path]);

  return (
    <div
      class="hc-blank"
      style={{ "--blank-hue": key % 360, "--blank-ink": key % 2 ? "#d9bd7a" : "#c9ced3" }}
    >
      <i class="hc-blank-spine" />
      <i class="hc-blank-edge" />
      <div class="hc-blank-plate">
        <i class="hc-blank-rule" />
        <span class="hc-blank-title">{book.name}</span>
        {author && <span class="hc-blank-author">{author}</span>}
        <i class="hc-blank-rule" />
      </div>
    </div>
  );
}

function BookCover({ book, className = "", width = 360, effects = "plain", onClick, alt }) {
  const fx = COVER_FX.has(effects) ? effects : "plain";
  const [thumb, setThumb] = dc.useState(null);
  const [failed, setFailed] = dc.useState(false);

  const imgSrc = useCoverSrc(book);

  dc.useEffect(() => {
    if (imgSrc && !failed) return;
    if (!book.pdf) return;
    let alive = true;
    firstPageThumb(book.pdf, width).then((u) => alive && setThumb(u));
    return () => { alive = false; };
  }, [imgSrc, failed, book.pdf?.path, width]);

  const src = (!failed && imgSrc) || thumb;
  const handle = (e) => (onClick ? onClick(e) : openBook(book, e));

  return (
    <div
      class={`hc-cover hc-fx-${fx} ${className} ${src ? "" : "is-blank"}`}
      role="button"
      tabIndex={0}
      aria-label={book.progress > 0 ? `Open at page ${book.progress}` : "Open PDF"}
      onClick={handle}
      /* auxclick fires for the right button too, so only take the middle one */
      onAuxClick={(e) => { if (e.button === 1) handle(e); }}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handle(e)}
    >
      {src
        ? <img src={src} alt={alt ?? "Cover"} draggable={false} decoding="async" onError={() => setFailed(true)} />
        : <BlankCover book={book} />}
    </div>
  );
}

/** On a shelf: hardcover board, and the lamps may light it. */
const ShelfCover = (props) => <BookCover {...props} effects="lit" />;

/** In a panel: the artwork exactly as supplied, and the shadow it casts. */
const FlatCover = (props) => <BookCover {...props} effects="plain" />;

// ════════════════════════════════════════════════════════════════════════════
//  Fitting a full-bleed view to the pane
//
//  Why this exists — the scroll bug.
//
//  Obsidian's reading view does not keep the whole note laid out. It measures
//  each top-level section, caches the height, and swaps sections in and out as
//  they approach the viewport. A ```datacorejsx``` block that renders a case
//  several thousand pixels tall breaks that bookkeeping: scroll far enough and
//  the block is recycled, the sizer collapses to the cached (much smaller)
//  height, scrollTop is clamped against the new scrollHeight — and you are back
//  at the top. Which is exactly what "scrolling doesn't stop at the bottom, it
//  jumps back up" is.
//
//  The fix is to stop growing. A full-bleed library is given the pane's own
//  height and scrolls INSIDE itself, so the note is one screen tall, always,
//  and Obsidian's measurement is trivially right. The browser then handles the
//  scrolling natively — it stops at the bottom, because scroll containers do.
//
//  The height is measured off whichever scroller the view is actually sitting
//  in, not off vh, so a split pane, a sidebar leaf and a popout window all get
//  the right number.
// ════════════════════════════════════════════════════════════════════════════
const SCROLLERS = ".markdown-preview-view, .cm-scroller, .view-content";

function useFitHeight(enabled, { min = 380, inset = 18 } = {}) {
  const ref = dc.useRef(null);
  const [h, setH] = dc.useState(null);

  dc.useEffect(() => {
    if (!enabled) { setH(null); return; }
    const el = ref.current;
    const scroller = el?.closest?.(SCROLLERS);
    if (!scroller) return;

    const apply = () => {
      const next = Math.max(min, Math.round(scroller.clientHeight - inset));
      setH((prev) => (prev === next ? prev : next));
    };
    apply();

    // ResizeObserver rather than a window listener: the pane resizes when a
    // split moves or the sidebar opens, neither of which resizes the window.
    const ro = new ResizeObserver(apply);
    ro.observe(scroller);
    return () => ro.disconnect();
  }, [enabled, min, inset]);

  return [ref, h];
}

// ════════════════════════════════════════════════════════════════════════════
//  Looking along a shelf
//
//  A row is often several times wider than the case, and the scrollbar is
//  hidden — so reaching the far end meant a trackpad gesture over a surface
//  that gives no sign it can be scrolled. Put the pointer near either end of
//  the case and the shelf travels that way, faster the closer to the edge you
//  get, the way a map pans.
//
//  Deliberately not a re-render: the whole thing runs on scrollLeft inside one
//  rAF loop, and the loop stops the moment the surface stops moving — so at
//  either end of a shelf, holding the pointer in the corner costs nothing.
// ════════════════════════════════════════════════════════════════════════════
function useEdgeScroll(enabled = true, { zone = 96, speed = 24 } = {}) {
  const ref = dc.useRef(null);

  dc.useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;

    let raf = 0;
    let vx = 0;

    const step = () => {
      raf = 0;
      if (!vx) return;
      const before = el.scrollLeft;
      el.scrollLeft = before + vx;
      // hitting either end is what stops the loop, not a timer
      if (el.scrollLeft !== before) raf = requestAnimationFrame(step);
      else vx = 0;
    };

    const drive = (v) => {
      vx = v;
      if (vx && !raf) raf = requestAnimationFrame(step);
    };

    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      const fromL = e.clientX - r.left;
      const fromR = r.right - e.clientX;
      // eased, so the last few pixels of the gutter are not a jolt
      if (fromL < zone) drive(-speed * (1 - fromL / zone) ** 2);
      else if (fromR < zone) drive(speed * (1 - fromR / zone) ** 2);
      else drive(0);
    };

    const stop = () => {
      drive(0);
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
    };

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", stop);
    // a drag is its own gesture; do not fight it for the scroll position
    el.addEventListener("dragstart", stop);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", stop);
      el.removeEventListener("dragstart", stop);
      stop();
    };
  }, [enabled, zone, speed]);

  return ref;
}

// ════════════════════════════════════════════════════════════════════════════
//  <Styles /> — injected once into <head>, replaced in place when edited.
//  Every selector is namespaced under .hc- / .hcx- / .hcs-, so nothing here
//  can reach a plain <img> or any other element in your notes.
// ════════════════════════════════════════════════════════════════════════════
const STYLE_ID = "book-datacore-styles";

const CSS = `
/* ── shared book vars ─────────────────────────────────────────────────── */
.hc-cover, .hcs-slot {
  --hc-radius: 2px 6px 6px 2px;
  --hc-spine: linear-gradient(to right,
    rgba(0,0,0,0.2), rgba(255,255,255,0.3) 1%, transparent 6%,
    rgba(0,0,0,0.15) 8%, rgba(255,255,255,0.2) 9%, transparent 20%);
  --hc-inner: inset 1px 1px 0 1px rgba(255,255,255,0.2),
              inset 0 0 0 1px rgba(0,0,0,0.1);
  --hc-drop:  -4px 2px 5px 0 rgba(0,0,0,0.5), -9px 9px 22px 0 rgba(0,0,0,0.42);
  --hc-drop-hover: -4px 4px 8px 0 rgba(0,0,0,0.3), -12px 16px 30px 0 rgba(0,0,0,0.3);
}

/* ── the physical book ────────────────────────────────────────────────── */
.hc-cover {
  position: relative; display: block; cursor: pointer;
  border-radius: var(--hc-radius);
  background: var(--background-secondary);
}
/* The artwork is left alone. No filter, no blend mode, no transform and no
   compositing hint live on this element — those belong to the board overlay,
   which paints ON TOP of the image rather than through it. image-rendering
   auto restates the global rule you set for note images, so nothing in here
   can quietly switch a cover to a crisper, aliased resampler. */
.hc-cover img {
  display: block; width: 100%; border-radius: inherit;
  image-rendering: auto;
}
.hc-cover:focus-visible { outline: 2px solid var(--text-accent); outline-offset: 4px; }

/* The shadow is cast BY the book, not painted ON it, so every effect level
   except "none" gets one and the artwork is untouched either way. */
.hc-fx-plain, .hc-fx-board, .hc-fx-lit { box-shadow: var(--hc-drop); }

/* The hardcover treatment, and the only thing in this file that puts anything
   over the artwork. Board and lit ask for it; plain and none do not, which is
   why the infobox now shows the cover you supplied rather than the cover you
   supplied under a 36% radial darkening. It sits ABOVE the lamp tint at
   z-index 4 — the soft-light wash was washing the spine gradient out. */
.hc-fx-board::before, .hc-fx-lit::before {
  content: ""; position: absolute; inset: 0; z-index: 4;
  border-radius: inherit; pointer-events: none;
  background-image:
    var(--hc-spine),
    radial-gradient(122% 92% at 12% 8%, rgba(255,255,255,.17), rgba(0,0,0,.36) 86%);
  box-shadow: var(--hc-inner), inset 0 0 0 1px rgba(255,255,255,.10);
}

/* ── a book with no artwork, drawn front-on ───────────────────────────── */
/* The study's front view rather than a placeholder: cloth, the dark roll of the
   spine down the left, the page block along the fore-edge, and the title set
   between two rules. Nothing here needs an image to exist, so a coverless book
   stands on the shelf looking like the books either side of it. */
.hc-cover.is-blank { aspect-ratio: 2 / 3; }
.hc-blank {
  position: relative; height: 100%; border-radius: inherit; overflow: hidden;
  background:
    repeating-linear-gradient(0deg, rgba(255,255,255,.03) 0 1px, transparent 1px 3px),
    radial-gradient(120% 90% at 12% 8%, rgba(255,255,255,.14), rgba(0,0,0,.35) 85%),
    linear-gradient(160deg,
      hsl(calc(var(--blank-hue) * 1deg) 24% 32%),
      hsl(calc(var(--blank-hue) * 1deg + 22deg) 28% 20%));
}
.hc-blank-spine {
  position: absolute; left: 0; top: 0; bottom: 0; width: 3.4%; min-width: 6px;
  background: linear-gradient(90deg, rgba(0,0,0,.62), rgba(0,0,0,0));
}
.hc-blank-edge {
  position: absolute; right: 0; top: 3px; bottom: 3px; width: 1.9%; min-width: 4px;
  background: repeating-linear-gradient(180deg, #f0e7d1 0 1px, #cfc4a8 1px 2px);
  box-shadow: inset 2px 0 3px rgba(0,0,0,.4);
}
.hc-blank-plate {
  position: absolute; inset: 12% 10% 12% 13%;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 5%; text-align: center;
  color: var(--blank-ink, #d9bd7a); text-shadow: 0 1px 0 rgba(0,0,0,.5);
}
.hc-blank-rule { flex: none; width: 54%; height: 1px; background: currentColor; opacity: .5; }
.hc-blank-title {
  font-family: var(--font-text), Georgia, serif; font-weight: 600; line-height: 1.18;
  font-size: clamp(11px, 1.05vw, 17px);
  display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden;
}
.hc-blank-author {
  font-family: var(--font-interface); font-size: clamp(8px, .62vw, 11px);
  letter-spacing: .24em; text-transform: uppercase; opacity: .72;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;
}

/* ═══ INFOBOX ═════════════════════════════════════════════════════════ */
.hcx {
  /* 270px, the same hard floor the shelf uses. Obsidian 1.13.7 downsamples a
     cover with a plain bilinear filter, and below roughly 270px of rendered
     width the type set on the artwork stops resolving — you get the shape of a
     title rather than a title. The box is the cover plus its gutters, so the
     cover lands on 270 exactly rather than on a percentage that rounds to a
     fractional pixel and resamples. */
  --hcx-cover: 270px;
  float: right; width: 298px;
  margin: .2em 0 1.2em 1.6em;
  font-family: var(--font-interface);
  font-size: var(--font-ui-small);
  line-height: var(--line-height-tight);
  color: var(--text-normal);
}
/* Never squeezed below the floor: at narrow widths it stops floating and takes
   the full column instead. A percentage max-width would have quietly resampled
   the cover on a narrow note, which is the blur this whole rule exists to stop. */
@media (max-width: 760px) {
  .hcx { float: none; width: 100%; margin: 0 0 1.2em 0; }
}

.hcx .hc-cover {
  width: var(--hcx-cover, 270px); max-width: 100%; margin: 0 auto;
  transition: translate .1s ease-out, box-shadow .1s ease-out;
}
/* The lift is a whole-pixel translate, not translateY + scale(1.03). Scaling
   redraws 270px of artwork into 278.1px, and that resample is what turned the
   cover soft on hover — the deeper shadow already carries the lift. Using the
   independent translate property also leaves the transform property free, so
   nothing here fights a theme that sets one. */
.hcx .hc-cover:hover {
  translate: 0 -4px;
  box-shadow: var(--hc-drop-hover);
}

/* ── fore-edge progress + annotation heat ─────────────────────────────── */
.hcx-edge {
  width: calc(var(--hcx-cover, 270px) * .87);
  margin: 15px auto 0; cursor: ew-resize;
}
.hcx-ticks {
  display: flex; gap: 2px; align-items: flex-end; height: 14px;
  padding: 3px 0; margin: -3px 0;
}
.hcx-tick {
  flex: 1; border-radius: .5px; background: var(--background-modifier-border);
  height: 6px; opacity: 1;
  transition: height .16s cubic-bezier(.22,1,.36,1), background-color .16s ease-out, opacity .16s;
}
.hcx-tick.is-read { background: var(--text-accent); }
.hcx-tick.is-cursor { height: 14px !important; background: var(--text-accent); opacity: .45; }
.hcx-tick.has-heat { background: var(--text-accent); }
.hcx-edge:hover .hcx-tick:not(.is-read):not(.is-cursor):not(.has-heat) { height: 14px; opacity: .5; }

.hcx-plabel {
  display: flex; justify-content: space-between; margin-top: 7px;
  font-size: var(--font-ui-smaller); color: var(--text-faint);
  font-variant-numeric: tabular-nums;
}
.hcx-plabel b { color: var(--text-muted); font-weight: var(--font-medium); }
.hcx-ghost { color: var(--text-accent); }
.hcx-auto { color: var(--color-green); }

/* ── text block ───────────────────────────────────────────────────────── */
.hcx-body { margin-top: 1.15em; }
.hcx-title {
  margin: 0; font-family: var(--h3-font); font-weight: var(--h3-weight);
  font-size: var(--h4-size); line-height: 1.25; color: var(--h3-color);
  letter-spacing: var(--h3-letter-spacing);
}
.hcx-title a { color: inherit; text-decoration: none; }
.hcx-title a:hover { text-decoration: underline; text-decoration-thickness: 1px; }
.hcx-sub { margin: 2px 0 6px; color: var(--text-muted); font-style: italic; }
.hcx-authors { margin: 0 0 10px; color: var(--text-muted); }

.hcx-pills { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 12px; }
.hcx-pill {
  padding: 1px 8px; border-radius: var(--radius-s);
  font-size: var(--font-ui-smaller); font-weight: var(--font-medium); white-space: nowrap;
}

.hcx-row {
  display: grid; grid-template-columns: 5.6em 1fr; gap: 8px;
  padding: 4px 0; font-size: var(--font-ui-smaller);
}
.hcx-row + .hcx-row { border-top: 1px solid var(--background-modifier-border); }
.hcx-key { color: var(--text-faint); }
.hcx-val { color: var(--text-muted); word-break: break-word; }
.hcx-val a { color: var(--text-accent); text-decoration: none; }
.hcx-val a:hover { text-decoration: underline; }

.hcx-isbn {
  font-family: var(--font-monospace); font-size: .94em; cursor: pointer;
  border-bottom: 1px dashed var(--background-modifier-border);
  transition: color .1s ease-out;
}
.hcx-isbn:hover { color: var(--text-normal); border-bottom-color: var(--text-faint); }
.hcx-isbn.copied { color: var(--color-green); border-bottom-color: transparent; }

.hcx-links { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 12px; }
.hcx-links a {
  color: var(--text-muted) !important; text-decoration: none !important;
  font-size: var(--font-ui-smaller);
  border-bottom: 1px solid var(--background-modifier-border);
  transition: color .1s ease-out, border-color .1s ease-out;
}
.hcx-links a:hover { color: var(--text-accent) !important; border-bottom-color: var(--text-accent); }
/* rolling release: the one red thing in the box, so it reads as "look at me"
   rather than as another link. --text-error follows the theme. */
.hcx-links a.hcx-rolling {
  color: var(--text-error) !important;
  border-bottom-color: var(--text-error);
  font-weight: var(--font-medium); cursor: pointer;
}
.hcx-links a.hcx-rolling:hover {
  color: var(--text-error) !important; border-bottom-color: var(--text-error);
}

.hcx-blurb {
  margin-top: 12px; padding-top: 10px;
  border-top: 1px solid var(--background-modifier-border);
  color: var(--text-faint); font-size: var(--font-ui-smaller);
  line-height: var(--line-height-normal);
}

/* ═══ SHELF ═══════════════════════════════════════════════════════════ */
/*
 * Four numbers describe the whole case, and shelf.jsx computes all four from
 * the books actually standing in it — see the metrics memo there. Nothing
 * below is a constant that a bigger book would overflow.
 *
 * (No backticks anywhere in this string: it is a template literal, and one
 * would close it. That is worth remembering before adding a comment here.)
 *
 *   --book-w    the reference cover width (never below FACE_MIN)
 *   --shelf-gap book-to-book pitch, a fraction of the cover
 *   --head-h    clear air above the books: where lamps hang and spiders drop
 *   --shelf-h   total row height, headroom included
 *   --lamp-w    the picture light's shade, a fraction of the cover. Every part
 *               of the fixture and the top of the cone are fractions of THIS,
 *               so the light scales as one object with the books.
 */
.hcs {
  --shelf-plank: var(--background-secondary);
  --book-w: 270px;
  --shelf-gap: 30px;
  --head-h: 42px;
  --lamp-w: 56px;
  /* every shelf is this tall, whatever is standing on it */
  --shelf-h: 460px;
  font-family: var(--font-interface);
  padding: 4px 2px 8px;
}

/* full-bleed: the shelf note gives up the readable-line-width and hides the
   rest of the note, so the library gets the whole window */
.markdown-preview-sizer:has(.hcs.is-full),
.cm-sizer:has(.hcs.is-full) {
  max-width: none !important; width: 100% !important;
  padding-left: 24px !important; padding-right: 24px !important;
}
.markdown-preview-sizer:has(.hcs.is-full) > *:not(:has(.hcs.is-full)):not(.markdown-preview-pusher),
.cm-sizer:has(.hcs.is-full) > *:not(:has(.hcs.is-full)) { display: none !important; }

/* The note stays exactly one screen tall and the library scrolls inside itself.
   This is the fix for "scrolling jumps back to the top": Obsidian recycles
   sections of a long note and re-measures them, and a case several thousand
   pixels tall makes that measurement wrong, so scrollTop gets clamped back to
   zero. A view that never grows can never be re-measured wrongly, and the
   browser's own scroll container stops at the bottom the way one should.
   --hcs-vh is measured off the real pane by useFitHeight; the vh is a fallback
   for the frame before that lands. */
.hcs.is-full {
  padding-top: 8px;
  display: flex; flex-direction: column;
  height: var(--hcs-vh, 82vh);
}
/* the case takes the slack; the banner above it keeps its own height */
.hcs.is-full > * { flex: 0 0 auto; }
.hcs.is-full .hcs-case { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }

/* The scrolling surface. Everything that must stay put — the cornice, the
   plinth, the glass, the daylight tint — is painted on .hcs-case, which does
   not move; only the shelves inside it do.
   Both axes scroll on purpose: a row of 270px books is wider than most
   windows, and looking along a shelf is a sideways gesture. */
.hcs-stacks {
  position: relative; flex: 1 1 auto; min-height: 0;
  overflow: auto; overscroll-behavior: contain;
  /* clearance for the heaps above the first shelf and the label plate that
     hangs 4px below the last board — a scroll container clips both otherwise */
  padding: 20px 0 12px;
  /* ONE COLUMN, and every shelf is that column wide.
     A grid column sizes to the widest item and then stretches the rest to it,
     which is the whole trick: shelves used to be width: max-content each, so a
     six-book shelf ended six books along and scrolling out to the end of a
     twenty-book shelf above it left nothing underneath — you were looking past
     the end of the furniture. minmax(100%, max-content) also keeps a case with
     nothing much in it filling the pane. */
  display: grid;
  grid-auto-flow: row;
  grid-template-columns: minmax(100%, max-content);
}
.hcs-stacks > .hcs-section { width: auto; min-width: 0; }

/* ── the case: the whole view is one piece of furniture ───────────────── */
.hcs-case {
  position: relative;
  padding: 30px 34px 30px;
  border-radius: 5px;
  background:
    /* back panel, boarded vertically */
    repeating-linear-gradient(90.6deg,
      rgba(0,0,0,.13) 0 1px, transparent 1px 78px),
    linear-gradient(180deg,
      color-mix(in srgb, var(--case-wood, #3d2b1f) 88%, #fff) 0%,
      var(--case-wood, #3d2b1f) 22%,
      color-mix(in srgb, var(--case-wood, #3d2b1f) 82%, #000) 100%);
  box-shadow:
    inset 0 0 0 1px rgba(0,0,0,.4),
    inset 22px 0 30px -22px rgba(0,0,0,.75),
    inset -22px 0 30px -22px rgba(0,0,0,.75),
    inset 0 26px 34px -26px rgba(0,0,0,.65),
    inset 0 -26px 34px -26px rgba(0,0,0,.5),
    0 22px 44px -20px rgba(0,0,0,.45);
}
/* cornice */
.hcs-case::before {
  content: ""; position: absolute; top: 0; left: -6px; right: -6px; height: 16px;
  border-radius: 4px 4px 2px 2px;
  background: linear-gradient(180deg,
    color-mix(in srgb, var(--wood-face, #b08356) 78%, #fff) 0 2px,
    var(--wood-face, #b08356) 2px 10px,
    color-mix(in srgb, var(--wood-lip, #7a5330) 92%, #000) 10px 100%);
  box-shadow: 0 5px 12px -3px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.3);
}
/* plinth */
.hcs-case::after {
  content: ""; position: absolute; bottom: 0; left: -6px; right: -6px; height: 18px;
  border-radius: 2px 2px 4px 4px;
  background: linear-gradient(180deg,
    color-mix(in srgb, var(--wood-lip, #7a5330) 96%, #fff) 0 2px,
    var(--wood-face, #b08356) 2px 9px,
    color-mix(in srgb, var(--wood-lip, #7a5330) 84%, #000) 9px 100%);
  box-shadow: 0 -3px 10px -4px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.24);
}

.hcs-section { position: relative; margin-bottom: 46px; }
.hcs-section:last-child { margin-bottom: 4px; }

/* ── rack, or bookcase ────────────────────────────────────────────────── */
/*
 * rack=true (the default) is what this has always been: separate boards with
 * air between them, each one its own piece of shelving.
 *
 * rack=false is the study's case — one carcass, compartments stacked straight
 * onto each other, each board doubling as the ceiling of the shelf below it.
 * That is what a bookshelf actually is, and it is a layout change only: the
 * gap goes, the board becomes the divider, the corners square off and the side
 * panels run unbroken past every board instead of stopping short of each one.
 */
.hcs.no-rack .hcs-section { margin-bottom: 0; }
.hcs.no-rack .hcs-section:last-child { margin-bottom: 4px; }
/* just enough padding to hold the board, so the next compartment starts where
   this one's ceiling ends rather than 46px below it */
.hcs.no-rack .hcs-shelf { padding-bottom: 18px; border-radius: 0; }
.hcs.no-rack .hcs-plank { border-radius: 0; }
/* the sides are one panel from top to bottom, and the boards are let into them */
.hcs.no-rack .hcs-wall { bottom: 0; border-radius: 0; }
/* the plate sits on the front edge of the board it names, not below it */
.hcs.no-rack .hcs-label { bottom: -1px; }

/* ── the label plate, screwed to the front edge of the board ──────────── */
/* Plate and button travel together at the near end of the board. They used to
   be pinned to opposite ends, which put "Full shelf" a screen and a half away
   once a row could be longer than the case. */
.hcs-label {
  position: absolute; z-index: 12; left: 24px; bottom: -4px;
  display: flex; align-items: center; gap: 14px;
}
.hcs-plate {
  position: relative;
  display: inline-flex; align-items: baseline; gap: .65em;
  padding: 3px 13px; border-radius: 2px;
  background: linear-gradient(180deg, #e2cc8b 0%, #c9ab5e 42%, #a98c42 62%, #8a6f2f 100%);
  color: #33260c;
  font-family: var(--h3-font); font-size: 11px; font-weight: 700;
  letter-spacing: .1em; text-transform: uppercase; white-space: nowrap;
  text-shadow: 0 1px 0 rgba(255,255,255,.4);
  box-shadow:
    0 2px 4px rgba(0,0,0,.5),
    inset 0 1px 0 rgba(255,255,255,.6),
    inset 0 -1px 0 rgba(0,0,0,.25);
}
/* the two screws */
.hcs-plate::before, .hcs-plate::after {
  content: ""; position: absolute; top: 50%; translate: 0 -50%;
  width: 3px; height: 3px; border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #6d5825, #2e2410);
  box-shadow: 0 1px 0 rgba(255,255,255,.35);
}
.hcs-plate::before { left: 4px; }
.hcs-plate::after  { right: 4px; }
.hcs-plate i {
  font-style: normal; font-weight: 500; font-size: 10px;
  color: rgba(51,38,12,.62); font-variant-numeric: tabular-nums;
}

.hcs-more {
  background: none; border: none; cursor: pointer; padding: 2px 4px;
  color: rgba(255,255,255,.5); font-size: var(--font-ui-smaller); font-family: var(--font-interface);
  letter-spacing: .03em; white-space: nowrap;
  transition: color .12s ease-out;
}
.hcs-more:hover { color: rgba(255,236,205,.95); }

/* ── the end walls ────────────────────────────────────────────────────── */
/* The study's case has a side to it, and a shelf that just runs off the edge of
   the screen never tells you where it stops. A row here can be several times
   the width of the case, so the walls belong to the SHELF, not to the case:
   .hcs-shelf spans the whole run, so these land at the true ends of it and
   scroll into view when you reach them.
   z-index 7 puts them in front of a book standing at rest and behind one you
   have picked up (8 with beams, so the lifted book passes in front). */
.hcs-wall {
  position: absolute; z-index: 7; top: 0; bottom: 16px; pointer-events: none;
  width: calc(var(--book-w) * .052); min-width: 11px;
  background:
    linear-gradient(90deg,
      color-mix(in srgb, var(--wood-lip, #7a5330) 70%, #000) 0 12%,
      var(--wood-face, #b08356) 12% 46%,
      color-mix(in srgb, var(--wood-lip, #7a5330) 88%, #000) 100%);
  box-shadow: 6px 0 16px -6px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,255,255,.22);
}
.hcs-wall.is-l { left: 0; border-radius: 3px 1px 1px 3px; }
.hcs-wall.is-r {
  right: 0; border-radius: 1px 3px 3px 1px; scale: -1 1;
}
/* the shadow the wall throws back along the boards */
.hcs-wall::after {
  content: ""; position: absolute; left: 100%; top: 0; bottom: 0;
  width: calc(var(--book-w) * .09);
  background: linear-gradient(90deg, rgba(0,0,0,.42), rgba(0,0,0,0));
}

/* ── the shelf board ──────────────────────────────────────────────────── */
.hcs-shelf { position: relative; padding-bottom: 30px; border-radius: 8px; transition: background-color .15s ease-out; }
.hcs-shelf.is-drop { background: rgba(var(--color-accent-rgb), .07); }
.hcs-shelf.is-drop .hcs-plank { box-shadow: 0 0 0 1px var(--text-accent), 0 12px 20px -10px rgba(0,0,0,.45); }

/* The headroom is padding on the row and the row's min-height includes it —
   Obsidian sets box-sizing: border-box everywhere, so a row with books and an
   empty row come out the same height, which is what keeps the boards level.
   Every slot is stretched to that full height, so the top of a slot is the top
   of the compartment: lamps and spiders hang from there, not from the book. */
.hcs-row {
  position: relative; z-index: 1;
  display: flex; align-items: stretch; gap: var(--shelf-gap);
  padding: var(--head-h) 26px 0; overflow: visible;
  min-height: var(--shelf-h);
}
.hcs-row.is-wrapped { flex-wrap: wrap; row-gap: 52px; align-items: flex-end; }
.hcs-row.is-wrapped .hcs-slot { align-self: flex-end; }
/* a flat shelf is still a shelf: same height, same headroom */
.hcs-row.is-flat { align-items: flex-end; padding-left: 0; padding-right: 0; }
.hcs-row.is-flat .hcs-piles { flex: 1 1 auto; min-height: 0; }

/* a board with a top surface, a front edge and end caps — not a flat bar */
.hcs-plank {
  position: absolute; left: 0; right: 0; bottom: 0; height: 18px;
  border-radius: 2px 2px 6px 6px;
  background: linear-gradient(180deg,
    color-mix(in srgb, var(--shelf-plank) 74%, #fff) 0 1px,
    color-mix(in srgb, var(--shelf-plank) 92%, #fff) 1px 5px,
    var(--shelf-plank) 5px 12px,
    color-mix(in srgb, var(--shelf-plank) 86%, #000) 12px 100%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.45),
    inset 0 -1px 0 rgba(0,0,0,.14),
    0 12px 20px -10px rgba(0,0,0,.42),
    0 2px 3px rgba(0,0,0,.18);
  transition: box-shadow .15s ease-out;
}
/* ambient occlusion where the books meet the board */
.hcs-plank::before {
  content: ""; position: absolute; left: 0; right: 0; top: -16px; height: 16px;
  background: linear-gradient(180deg, transparent, rgba(0,0,0,.14));
  pointer-events: none;
}
/* darkened ends, so it reads as a board seen slightly from the front */
.hcs-plank::after {
  content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  box-shadow: inset 5px 0 6px -5px rgba(0,0,0,.35), inset -5px 0 6px -5px rgba(0,0,0,.35);
}

/* ── face-out book ────────────────────────────────────────────────────── */
/* Stretched to the compartment and packed to the bottom, so the book stands on
   the board and everything above it — lamp, cone, thread — has a fixed frame to
   hang from. */
.hcs-slot {
  position: relative; flex: 0 0 auto; width: var(--book-w);
  align-self: stretch; display: flex; flex-direction: column; justify-content: flex-end;
  padding-bottom: 4px; overflow: visible;
}
.hcs-slot.is-dragging { opacity: .35; }
.hcs-slot[draggable="true"] { -webkit-user-drag: element; }

/* The artwork wrapper is the thing that lifts and rocks — the cover, the web
   and the ribbon are all inside it, so they travel together. The crack and the
   hairline bar stay outside, because they belong to the board, not the book. */
/* flex: 0 0 auto so a book taller than its compartment overhangs the board
   rather than being quietly squashed to fit it — a squashed cover is a
   resampled cover, which is the blur again. */
.hcs-art {
  position: relative; z-index: 1; flex: 0 0 auto; width: 100%;
  transform-origin: 50% 100%;
  rotate: var(--tilt, 0deg); translate: 0 0;
  /* No translateZ(0) and no backface-visibility here. Both force the book onto
     its own composited layer, which rasterises the cover once at the layer's
     scale and leaves it soft for the rest of the animation — the blur you saw
     on the shelf. The rotate/translate transitions below promote the element
     for exactly as long as they run, which is all the promotion it needs. */
  transition:
    rotate .5s cubic-bezier(.22,1,.36,1),
    translate .2s cubic-bezier(.22,1,.36,1),
    filter .25s ease-out;
}
.hcs-slot::after {
  content: ""; position: absolute; z-index: 0;
  left: 4%; right: 4%; bottom: 0; height: 7px; border-radius: 50%;
  background: radial-gradient(ellipse at center, rgba(0,0,0,.42), transparent 72%);
  filter: blur(2.5px);
  transition: left .22s ease-out, right .22s ease-out, opacity .22s ease-out;
}
.hcs-slot:hover::after { left: 13%; right: 13%; opacity: .55; }

.hcs-slot .hc-cover {
  position: relative; width: 100%;
  transition: box-shadow .2s ease-out, filter .25s ease-out;
}
/* will-change is deliberately absent here: promoting the row on hover pinned
   every cover to a stale raster for as long as the pointer stayed in the row,
   which is the "hovering makes the book blurry" you reported. */

.hcs-slot:hover { z-index: 5; }
/* Lift and straighten — no oscillation. The rest tilt eases out to zero on
   the existing rotate transition, which is the settled look the leaning book
   already had. */
.hcs-slot:hover .hcs-art {
  translate: 0 -9px;
  rotate: 0deg;
}
.hcs-slot:hover .hc-cover { box-shadow: var(--hc-drop-hover); }



/* the progress line on the board, under a book you're reading */
.hcs-mini {
  position: absolute; z-index: 2; left: 8%; right: 8%; bottom: -11px; height: 3px;
  border-radius: 999px; background: rgba(0,0,0,.15); overflow: hidden;
}
.hcs-mini i {
  display: block; height: 100%; border-radius: 999px; background: var(--text-accent);
  transition: width .4s cubic-bezier(.22,1,.36,1);
}


/* ═══ BOARD MATERIALS ═════════════════════════════════════════════════ */
/* Grain runs along the length of the board, the way a sawn plank does —
   long, soft, irregular streaks, never a row of vertical ticks. */

.hcs.mode-oak    { --wood-face: #b08356; --wood-lip: #7a5330; --wood-grain: 0,0,0; --case-wood: #43301f; }
.hcs.mode-walnut { --wood-face: #5c4032; --wood-lip: #38251c; --wood-grain: 0,0,0; --case-wood: #241811; }
/* A painted board has no timber to show, so its end walls take the case's own
   grey rather than the wood fallbacks the base rule carries. */
.hcs.mode-board  { --case-wood: #2f3237; --wood-face: #5c6068; --wood-lip: #34383e; }
/* Two deco veneers. They are ordinary materials — nothing stops oak under art
   deco, or ebony under the library — but these are the two that design
   actually used, so they are the ones it reaches for by default. */
.hcs.mode-ebony    { --wood-face: #2b3036; --wood-lip: #14171a; --wood-grain: 255,255,255; --case-wood: #14171a; }
.hcs.mode-macassar { --wood-face: #6b4a2c; --wood-lip: #33200f; --wood-grain: 0,0,0; --case-wood: #2a1a0e; }
.hcs.mode-board .hcs-case::before,
.hcs.mode-board .hcs-case::after {
  background: linear-gradient(180deg,
    color-mix(in srgb, var(--background-secondary) 92%, #fff) 0 2px,
    var(--background-secondary) 2px 10px,
    color-mix(in srgb, var(--background-secondary) 84%, #000) 10px 100%);
}

.hcs.mode-oak .hcs-plank,
.hcs.mode-walnut .hcs-plank,
.hcs.mode-ebony .hcs-plank,
.hcs.mode-macassar .hcs-plank {
  height: 19px;
  background:
    /* three grain layers at coprime periods so nothing visibly repeats */
    repeating-linear-gradient(178deg,
      rgba(var(--wood-grain), .05) 0 1px, transparent 1px 5px),
    repeating-linear-gradient(181deg,
      rgba(255,255,255,.045) 0 1px, transparent 1px 7px),
    repeating-linear-gradient(179.4deg,
      rgba(var(--wood-grain), .035) 0 2px, transparent 2px 11px),
    linear-gradient(180deg,
      color-mix(in srgb, var(--wood-face) 74%, #fff) 0 1px,
      color-mix(in srgb, var(--wood-face) 91%, #fff) 1px 5px,
      var(--wood-face) 5px 12px,
      color-mix(in srgb, var(--wood-lip) 86%, #fff) 12px 13px,
      var(--wood-lip) 13px 100%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.26),
    inset 0 -1px 0 rgba(0,0,0,.34),
    0 13px 22px -10px rgba(0,0,0,.5),
    0 2px 3px rgba(0,0,0,.24);
}
.hcs.mode-oak .hcs-plank::before,
.hcs.mode-walnut .hcs-plank::before {
  background: linear-gradient(180deg, transparent, rgba(46,26,10,.22));
}

/* ── concrete: a cast slab in a board-formed wall ─────────────────────── */
.hcs.mode-concrete {
  --wood-face: #a8a59c; --wood-lip: #6e6c66; --case-wood: #56544f;
  --agg-dark: rgba(0,0,0,.13); --agg-light: rgba(255,255,255,.10);
}
.hcs.mode-concrete .hcs-plank {
  height: 22px; border-radius: 1px 1px 3px 3px;
  background:
    /* aggregate, three passes at coprime sizes so the speckle never tiles */
    radial-gradient(circle at 21% 34%, var(--agg-dark) 0 1.1px, transparent 1.6px),
    radial-gradient(circle at 68% 71%, var(--agg-light) 0 1px, transparent 1.5px),
    radial-gradient(circle at 45% 12%, var(--agg-dark) 0 .9px, transparent 1.4px),
    /* faint pour mottling */
    linear-gradient(96deg, rgba(255,255,255,.05) 0 22%, transparent 22% 61%, rgba(0,0,0,.05) 61% 100%),
    linear-gradient(180deg,
      #bdbab1 0 2px,
      #b1aea5 2px 6px,
      #a8a59c 6px 14px,
      #8b8981 14px 17px,
      #6e6c66 17px 100%);
  background-size: 37px 19px, 53px 23px, 29px 17px, 260px 100%, 100% 100%;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.34),
    inset 0 -1px 0 rgba(0,0,0,.3),
    0 13px 22px -10px rgba(0,0,0,.45),
    0 2px 3px rgba(0,0,0,.22);
}
/* a chipped front arris, so the slab does not read as extruded plastic */
.hcs.mode-concrete .hcs-plank::after {
  box-shadow: inset 5px 0 6px -5px rgba(0,0,0,.3), inset -5px 0 6px -5px rgba(0,0,0,.3);
  background:
    linear-gradient(203deg, transparent 0 49%, rgba(255,255,255,.16) 49% 52%, transparent 52%) 18% 100% / 26px 4px no-repeat,
    linear-gradient(160deg, transparent 0 48%, rgba(255,255,255,.13) 48% 51%, transparent 51%) 72% 100% / 19px 3px no-repeat;
}
.hcs.mode-concrete .hcs-plank::before {
  background: linear-gradient(180deg, transparent, rgba(24,24,26,.2));
}
/* the case becomes the wall it is cast into: board-form lines and tie holes */
.hcs.mode-concrete .hcs-case {
  background:
    radial-gradient(circle at 50% 50%, rgba(0,0,0,.3) 0 2.5px, rgba(255,255,255,.05) 2.5px 3.4px, transparent 3.6px)
      64px 78px / 168px 132px,
    repeating-linear-gradient(180deg,
      rgba(0,0,0,.16) 0 1px, rgba(255,255,255,.035) 1px 2px, transparent 2px 66px),
    radial-gradient(circle at 30% 60%, rgba(0,0,0,.10) 0 1.2px, transparent 1.8px) 0 0 / 41px 27px,
    linear-gradient(174deg, #605e59 0%, #56544f 44%, #4a4844 100%);
}
.hcs.mode-concrete .hcs-case::before,
.hcs.mode-concrete .hcs-case::after {
  background: linear-gradient(180deg, #b6b3aa 0 2px, #a3a098 2px 10px, #7a7871 10px 100%);
}
.hcs.mode-concrete .hcs-bookend {
  background:
    repeating-linear-gradient(90deg, rgba(0,0,0,.08) 0 1px, transparent 1px 3px),
    linear-gradient(90deg, #3f4245 0%, #5d6165 26%, #878b8f 48%, #6a6e72 62%, #3b3e41 100%);
}
.hcs.mode-concrete .hcs-bookend::after {
  background: linear-gradient(180deg, #8b8f93 0 1px, #62666a 1px 3px, #3d4043 3px 100%);
}
.hcs.mode-concrete .hcs-plate {
  background: linear-gradient(180deg, #cfd3d6 0%, #a9adb1 44%, #8b8f93 64%, #6d7175 100%);
  color: #24282b;
  text-shadow: 0 1px 0 rgba(255,255,255,.35);
}
.hcs.mode-concrete .hcs-crack-dark path { stroke: rgba(0,0,0,.62); }
.hcs.mode-concrete .hcs-crack-lip path { stroke: rgba(255,255,255,.22); }

/* ═══ PROGRESS PATTERNS ═══════════════════════════════════════════════ */

/* ── crack: the board splits under the weight of what you've read ─────── */
/* ── the tipped-in slip ───────────────────────────────────────────────── */
/* travels along the top edge as you advance, and carries the page number */
.hcs-slip {
  position: absolute; z-index: 5; pointer-events: none;
  top: -17px; left: calc(9% + var(--p, 0) * 0.62%);
  width: 31px; height: 27px; rotate: -2.5deg;
  display: flex; align-items: flex-start; justify-content: center; padding-top: 4px;
  border-radius: 1px 1px 0 0;
  background: linear-gradient(180deg, #f7f2e4 0%, #ece5d2 58%, #ddd5bf 100%);
  box-shadow:
    0 2px 4px rgba(0,0,0,.45),
    inset 0 1px 0 rgba(255,255,255,.75),
    inset -1px 0 0 rgba(0,0,0,.06);
  transition: left .5s cubic-bezier(.22,1,.36,1);
}
.hcs-slip i {
  font-style: normal; font-family: var(--font-monospace);
  font-size: 9px; line-height: 1; color: #6d6047; letter-spacing: -.02em;
}

/* ── the dog-ear ──────────────────────────────────────────────────────── */
/* the back of the folded page, plus the shadow it throws on the cover */
.hcs-dogear {
  position: absolute; z-index: 5; top: 0; right: 0; pointer-events: none;
  width: calc(16px + var(--d, 0) * 26px); aspect-ratio: 1;
  border-top-right-radius: 6px;
  background: linear-gradient(225deg,
    #f3ead2 0 43%, #c2b596 45% 50%, transparent 51%);
  box-shadow: -5px 6px 9px rgba(0,0,0,.45);
}

.hcs-crack {
  position: absolute; z-index: 2; pointer-events: none;
  left: -14%; right: -14%; bottom: -14px; height: 15px;
  overflow: visible;
}
.hcs-crack path {
  fill: none; stroke-linecap: round; vector-effect: non-scaling-stroke;
  transition: stroke-dashoffset .6s cubic-bezier(.22,1,.36,1);
}
.hcs-crack-dark path { stroke: rgba(0,0,0,.55); stroke-width: 1.4; }
.hcs-crack-lip  path { stroke: rgba(255,255,255,.16); stroke-width: 1; }
.hcs.mode-board .hcs-crack-dark path { stroke: rgba(0,0,0,.34); }

/* ── ribbon: a satin bookmark down the cover ──────────────────────────── */
.hcs-ribbon {
  position: absolute; z-index: 3; pointer-events: none;
  top: -5px; left: 17%; width: 9px;
  height: calc(9% + var(--p, 0) * .78%);
  border-radius: 1px 1px 0 0;
  background: linear-gradient(90deg,
    #7d1717 0%, #b32c2c 30%, #e05a5a 48%, #c03434 62%, #6d1212 100%);
  clip-path: polygon(0 0, 100% 0, 100% 100%, 50% calc(100% - 6px), 0 100%);
  box-shadow: 1px 0 3px rgba(0,0,0,.4);
  transition: height .5s cubic-bezier(.22,1,.36,1);
}

/* ═══ BOOKEND ═════════════════════════════════════════════════════════ */
/* Aged brass rather than chrome — brushed, warm, and it belongs next to wood. */
/* A third of the way up the board, the way a real one is — it used to take its
   height from --book-w, which meant a 270px-wide book got a 259px bookend. */
.hcs-bookend {
  position: relative; flex: 0 0 auto; align-self: flex-end;
  width: 9px; height: calc(var(--book-w) * .3);
  margin-left: -16px; margin-bottom: 4px; z-index: 2;
  border-radius: 2px 2px 0 0;
  background:
    repeating-linear-gradient(90deg, rgba(0,0,0,.07) 0 1px, transparent 1px 3px),
    linear-gradient(90deg,
      #4b3813 0%, #7d5f24 14%, #ab8a3c 32%, #dcc078 46%,
      #f0e0ac 51%, #c3a352 58%, #8a6a29 76%, #4a3712 100%);
  box-shadow:
    -6px 4px 9px rgba(0,0,0,.5),
    inset 0 1px 0 rgba(255,255,255,.4),
    inset 0 -2px 3px rgba(0,0,0,.35);
}
.hcs-bookend::after {
  content: ""; position: absolute; left: -3px; bottom: 0; width: 46px; height: 5px;
  border-radius: 1px 2px 2px 1px;
  background: linear-gradient(180deg, #d6bb72 0 1px, #a8863a 1px 3px, #6b5220 3px 100%);
  box-shadow: 0 4px 6px -2px rgba(0,0,0,.55);
}
/* the last book rests against it */
.hcs-slot.is-leaning .hcs-art { rotate: 5.5deg; }
.hcs-slot.is-leaning:hover .hcs-art { rotate: 0deg; }

/* ═══ FLAT STACKS ════════════════════════════════════════════════════ */
/* A stack of books seen from the front: each one shows its spine, so the
   titles are readable down the pile the way they are on a real desk. */
.hcs-piles {
  display: flex; align-items: flex-end; gap: 40px; padding: 0 26px;
  width: 100%;
}
.hcs-pile {
  display: flex; flex-direction: column-reverse; align-items: flex-start;
  flex: 0 0 auto; padding-bottom: 4px;
}
.hcs-slab {
  position: relative; display: flex; align-items: center; overflow: hidden;
  width: var(--w, 150px); height: var(--thick, 26px);
  margin-left: calc(var(--jit, 0) * 1px);
  cursor: grab; border-radius: 2px 1px 1px 2px;
  /* Electron wants this spelled out before it will let a styled block be the
     drag source; without it the pointer picks nothing up. */
  -webkit-user-drag: element;
  user-select: none;
  background-color: hsl(var(--h) calc(var(--s) * 1%) calc(var(--l) * 1%));
  background-image:
    repeating-linear-gradient(0deg, rgba(255,255,255,.04) 0 1px, transparent 1px 3px),
    linear-gradient(180deg,
      rgba(255,255,255,.18) 0 2px,
      rgba(255,255,255,.04) 34%,
      rgba(0,0,0,.20) 72%,
      rgba(0,0,0,.42) 100%);
  box-shadow: 0 3px 6px -2px rgba(0,0,0,.85), inset 0 -1px 0 rgba(0,0,0,.45);
  transition: translate .18s cubic-bezier(.22,1,.36,1), box-shadow .18s ease-out;
}
.hcs-slab.is-dragging { opacity: .35; cursor: grabbing; }
.hcs-slab-title {
  flex: 1; min-width: 0; padding: 0 14px 0 12px;
  font-family: var(--font-text), Georgia, serif;
  font-size: 11.5px; font-weight: 600; letter-spacing: .04em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  color: rgba(242,235,217,.94); text-shadow: 0 1px 0 rgba(0,0,0,.65);
}
/* gilt rule at the head, page block at the tail */
.hcs-slab::before {
  content: ""; position: absolute; left: 6px; top: 4px; bottom: 4px; width: 1px;
  background: rgba(240,232,212,.32);
}
.hcs-slab::after {
  content: ""; position: absolute; right: 0; top: 2px; bottom: 2px; width: 5px;
  background: repeating-linear-gradient(0deg, #efeadd 0 1px, #d8d2c4 1px 2px);
  box-shadow: -1px 0 2px rgba(0,0,0,.35);
}
.hcs-pile:hover .hcs-slab:hover {
  translate: 8px 0; z-index: 3;
  box-shadow: 0 5px 10px -2px rgba(0,0,0,.9), inset 0 -1px 0 rgba(0,0,0,.45);
}

/* ═══ POINTER LAMP ════════════════════════════════════════════════════ */
/* One warm light for the whole row, tracking the pointer. Two overlays sit
   above the books: the shade layer multiplies, so distance darkens and cools
   the artwork; the glow layer screens, so the near side picks up tungsten
   warmth. That is what makes the light fall ON the books. */
.hcs.has-lamp .hcs-shelf { isolation: isolate; }
.hcs.has-lamp .hcs-row { --lamp-x: 50%; --lamp-on: 0; }

/* clipped to the row, so the shelf label below is never dimmed */
.hcs-lamp-shade, .hcs-lamp-glow {
  position: absolute; z-index: 8; pointer-events: none;
  inset: 0 -26px 0 -26px;
  transition: opacity .35s ease-out;
}
.hcs-lamp-shade {
  mix-blend-mode: multiply;
  background: radial-gradient(620px 460px at var(--lamp-x, 50%) 4%,
    rgba(255,255,255,1) 0%,
    rgba(214,196,170,.98) 26%,
    rgba(138,124,104,.92) 55%,
    rgba(74,66,56,.9) 82%,
    rgba(52,46,39,.92) 100%);
  opacity: calc(.35 + .55 * var(--lamp-on, 0));
}
.hcs-lamp-glow {
  mix-blend-mode: screen;
  background: radial-gradient(560px 400px at var(--lamp-x, 50%) 0%,
    rgba(255,241,214,.42) 0%,
    rgba(255,206,143,.24) 32%,
    rgba(240,166,88,.08) 62%,
    transparent 88%);
  opacity: calc(.45 + .55 * var(--lamp-on, 0));
}
.hcs-lamp-glow::before {
  content: ""; position: absolute; top: 12px; left: var(--lamp-x, 50%);
  translate: -50% 0; width: 76px; height: 13px; border-radius: 50%;
  background: rgba(255,238,205,.9); filter: blur(8px);
  opacity: var(--lamp-on, 0); transition: opacity .35s ease-out;
}
.hcs.has-lamp .hcs-plank { filter: brightness(.94); }
/* the book you reach for is never dimmed by the room light */
.hcs.has-lamp .hcs-slot:hover { z-index: 9; }

/* after hours: the sign is off, so the case falls dark */
.hcs-case { transition: filter .7s ease; }
.hcs.is-unlit .hcs-case { filter: brightness(.55) saturate(.8); }

/* ═══ DEPTH OF FIELD ══════════════════════════════════════════════════ */
/* Graded by sibling proximity rather than by measuring pointer distance — no
   JS, no layout reads. A brightness falloff rather than a blur: the eye reads
   it as depth just as well, and nothing becomes unreadable. */
.hcs.has-dof .hcs-slot { transition: filter .25s ease-out; }
/* Excluded with :not(:hover) rather than un-blurred by a later rule. :has()
   carries its argument's specificity, so a plain hover rule setting filter to
   none LOSES to the blur selector, and the book you point at stays soft.
   Never selecting it means there is no specificity race to lose. */
.hcs.has-dof .hcs-row:has(.hcs-slot:hover) .hcs-slot:not(:hover) { filter: brightness(.74) saturate(.84); }
.hcs.has-dof .hcs-row .hcs-slot:not(:hover):hover + .hcs-slot,
.hcs.has-dof .hcs-row .hcs-slot:not(:hover):has(+ .hcs-slot:hover) { filter: brightness(.9) saturate(.94); }

/* The doors are a sheen on the front of the case, nothing more. Blurring the
   books behind them cost more legibility than the effect was worth. */

/* ═══ GLASS DOORS ═════════════════════════════════════════════════════ */
/* Two glazed doors meeting on a central stile. One sheen layer over the whole
   case, so the shelves read as one cabinet rather than three stacked rows. */
.hcs-glass {
  position: absolute; inset: 0; z-index: 20; pointer-events: none;
  border-radius: inherit;
  background:
    linear-gradient(104deg,
      transparent 0 16%, rgba(255,255,255,.055) 16% 23%,
      transparent 23% 41%, rgba(255,255,255,.085) 41% 46%,
      transparent 46% 100%),
    linear-gradient(180deg, rgba(196,220,240,.05), rgba(120,150,175,.028));
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.09);
}
.hcs-glass::before {
  content: ""; position: absolute; inset: 7px; border-radius: 2px;
  border: 1px solid rgba(255,255,255,.10);
  box-shadow: inset 0 0 22px rgba(255,255,255,.035);
}
.hcs-glass::after {
  content: ""; position: absolute; top: 7px; bottom: 7px; left: 50%;
  width: 7px; translate: -50% 0; border-radius: 1px;
  background: linear-gradient(90deg,
    rgba(0,0,0,.42), rgba(255,255,255,.16) 42%, rgba(0,0,0,.46));
  box-shadow: 0 0 10px rgba(0,0,0,.45);
}

/* ═══ TIME OF DAY ═════════════════════════════════════════════════════ */
/* Cool at dawn, neutral at noon, lamp-warm after dark. */
.hcs-daylight {
  position: absolute; inset: 0; z-index: 19; pointer-events: none;
  border-radius: inherit;
  background: rgb(var(--day-rgb, 255,252,244));
  opacity: var(--day-a, .05);
  mix-blend-mode: soft-light;
  transition: background 2s linear, opacity 2s linear;
}

/* ═══ BEAM TINT ═══════════════════════════════════════════════════════ */
/* The lamp colour ON the artwork. soft-light keeps the cover's own values and
   shifts only its temperature, which is what makes a cold book look unlit. */
.hcs-tint {
  position: absolute; inset: 0; z-index: 2; pointer-events: none;
  border-radius: inherit;
  background: rgb(var(--beam-rgb, 255,214,158));
  mix-blend-mode: soft-light;
  opacity: calc(.11 + .20 * var(--beam-i, .8));
  transition: background .3s ease-out, opacity .3s ease-out;
}

/* ═══ SPINES ════════════════════════════════════════════════════════ */
/* A real spine photograph if the folder has one (see findSpineImage), and
   otherwise the cloth spine from the study: a capped head, the title set
   vertically, two rules and a printer's mark at the foot. Colour is sampled
   from the cover art, so a turned book and its spine belong to each other. */
.hcs-sp {
  position: relative; flex: 0 0 auto; width: 100%; height: var(--sp-h, 190px);
  display: flex; flex-direction: column; overflow: hidden;
  border-radius: 1px 2px 2px 1px; cursor: pointer;
  background-color: hsl(var(--h) calc(var(--s) * 1%) calc(var(--l) * 1%));
  background-image:
    repeating-linear-gradient(90deg, rgba(255,255,255,.04) 0 1px, transparent 1px 3px),
    linear-gradient(90deg, rgba(0,0,0,.5) 0 4%, rgba(255,255,255,.13) 20%,
                    rgba(255,255,255,.01) 62%, rgba(0,0,0,.46) 100%);
  box-shadow: 0 8px 12px -6px rgba(0,0,0,.9), inset 0 -6px 10px rgba(0,0,0,.45);
}
/* a photographed spine fills the slot; the fore-edge page block still applies */
.hcs-sp.has-art { background-image: none; }
.hcs-sp.has-art img {
  display: block; flex: 1 1 auto; width: 100%; height: 100%; object-fit: cover;
  border-radius: inherit; image-rendering: auto;
}
.hcs-sp.has-art::after {
  content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  background: linear-gradient(90deg,
    rgba(0,0,0,.34) 0 1px,
    rgba(255,255,255,.16) 1px 3px,
    transparent 3px 82%,
    rgba(0,0,0,.22) 82% 100%);
}

.hcs-sp-cap {
  height: 9px; flex: none;
  background: linear-gradient(180deg, rgba(255,255,255,.16), rgba(0,0,0,.25));
  border-bottom: 1px solid rgba(0,0,0,.35);
}
.hcs-sp-body {
  flex: 1; min-height: 0; display: flex; align-items: center;
  justify-content: center; overflow: hidden; padding: 8px 0;
}
.hcs-sp-title {
  writing-mode: vertical-rl; font-family: var(--font-text), Georgia, serif;
  font-weight: 600; font-size: 12px; letter-spacing: .07em;
  color: rgba(240,232,212,.92); white-space: nowrap;
  text-shadow: 0 1px 0 rgba(0,0,0,.55);
}
.hcs-sp-foot {
  flex: none; display: flex; flex-direction: column; align-items: center;
  gap: 3px; padding-bottom: 9px;
}
.hcs-sp-rule { width: 50%; height: 1px; background: rgba(240,232,212,.55); }
.hcs-sp-mark {
  width: 5px; height: 5px; border-radius: 50%;
  border: 1px solid rgba(240,232,212,.5);
}
/* a red ribbon marks whatever is open right now */
/* Inside .hcs-sp, so it hangs from the spine's own head however tall the slot
   is stretched, and set over toward the fore-edge so it never crosses the
   title running down the middle. */
.hcs-sp-ribbon, .hcs-art .hcs-open-ribbon {
  position: absolute; top: -7px; width: 7px; height: 62px; z-index: 6;
  background: linear-gradient(180deg, #b5273a, #7d1523);
  box-shadow: 1px 2px 4px rgba(0,0,0,.55);
  clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 86%, 0 100%);
}
.hcs-sp-ribbon { left: auto; right: 5px; }
.hcs-art .hcs-open-ribbon { left: 22%; height: 86px; }

/* turning a book is a width change, so the row reflows like a real shelf */
.hcs-slot.is-spine { width: var(--sp-w, 32px); }
/* the study's lift: straight up, a degree of roll, and a touch brighter */
.hcs-slot.is-spine .hcs-sp {
  transform-origin: bottom right;
  transition: transform .45s cubic-bezier(.2,.8,.2,1), filter .45s ease;
}
.hcs-slot.is-spine:hover { z-index: 6; }
.hcs-slot.is-spine:hover .hcs-sp {
  transform: translateY(-16px) rotate(-1deg);
  filter: brightness(1.22);
}
/* the last spines lean into the bookend rather than standing to attention */
.hcs-slot.is-spine.lean-1 .hcs-sp { transform: rotate(7deg); transform-origin: bottom right; }
.hcs-slot.is-spine.lean-2 .hcs-sp { transform: rotate(4deg); transform-origin: bottom right; }
.hcs-slot.is-spine.lean-1:hover .hcs-sp,
.hcs-slot.is-spine.lean-2:hover .hcs-sp { transform: translateY(-16px) rotate(2deg); }
.hcs-slot { transition: width .4s cubic-bezier(.2,.8,.2,1); }

/* ═══ THE PILE ON TOP ═════════════════════════════════════════════════ */
/* Overflow is a fact about the shelf, not a UI affordance — the books that do
   not fit lie in a heap on the top of the case. */
.hcs-toppile {
  position: absolute; left: 0; right: 0; top: -14px; height: 0;
  display: flex; align-items: flex-end; justify-content: flex-end;
  gap: 30px; padding: 0 46px; z-index: 3; pointer-events: none;
}
.hcs-topstack {
  position: relative; display: flex; flex-direction: column-reverse;
  pointer-events: auto; rotate: var(--lean, -1.5deg); transform-origin: bottom center;
}
.hcs-topslab {
  position: relative; width: var(--w, 92px); height: var(--thick, 12px);
  margin-left: calc(var(--jit, 0) * 1px);
  overflow: hidden; cursor: pointer; border-radius: 1px 2px 2px 1px;
  transform: skewX(-15deg); transform-origin: bottom left;
  box-shadow: 0 2px 3px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.18);
  transition: translate .18s cubic-bezier(.22,1,.36,1);
}
.hcs-topslab img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: center 24%; }
.hcs-topslab-blank { width: 100%; height: 100%; background: hsl(calc(var(--blank-hue) * 1deg) 22% 30%); }
.hcs-topslab::after {
  content: ""; position: absolute; right: 0; top: 0; bottom: 0; width: 3px;
  background: repeating-linear-gradient(180deg, #efeadd 0 1px, #d8d2c4 1px 2px);
}
.hcs-topstack:hover .hcs-topslab:hover { translate: 7px 0; }

/* ═══ THE RAIL ════════════════════════════════════════════════════════ */
/* Every slot sits above the rail, so no head is ever covered. */
.hcs.beams .hcs-slot { z-index: 4; }
.hcs.beams .hcs-slot:hover { z-index: 8; }

/* One lamp per book, every head hanging from a single rail at one height —
   the fixture, cone and drifting motes are the study's spotlight, but there
   is no fixed point on the shelf: each book has its own. Slots are stretched
   to the row height by the base rule, so every head hangs level. */
.hcs.beams .hcs-row { position: relative; }

/* Behind the lamps. At z-index 5 it out-stacked every slot that was not
   hovered — the hovered book jumped to 5 and cleared it, and the rest of the
   row had their heads painted over by the bar they hang from. */
/* Across the stems, wherever the headroom puts them. It used to be pinned at
   20px, which was most of the way down a shallow compartment and a tenth of
   the way down a deep one. */
.hcs-rail {
  position: absolute; z-index: 3; pointer-events: none;
  left: 8px; right: 8px; top: calc(var(--head-h) * .12); height: 5px; border-radius: 3px;
  background: linear-gradient(180deg, #6d6459 0 1px, #4a433a 1px 3px, #2b2620 3px 100%);
  box-shadow: 0 2px 4px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.16);
}

/* One anchor for the whole fixture. The head and the cone are both centred on
   this zero-width column, so the lamp is always exactly where its beam
   begins — they are positioned against the same box, not against the slot. */
.hcs-lampunit {
  position: absolute; z-index: 6; pointer-events: none;
  left: 50%; top: 0; width: 0; height: 100%;
}

/* ── the fixture: stem, shade, and an LED that takes the reading colour ─────
 *
 * SIZE AND PLACEMENT, both taken from the study rather than from constants.
 *
 * The study hangs a 40px shade over a 141px cover in a compartment with 43px
 * of air above a 214px book. Those are RATIOS, and they are what got copied
 * here — not the pixels, which belong to a case less than half this one's size:
 *
 *   shade width   0.28 x the cover      -> --lamp-w, set by the metrics memo
 *   fixture drop  0.93 x the shade      -> stem + shade + bulb
 *   head air      0.20 x the tallest book, so the fixture fills it the way the
 *                 study's does instead of floating in a third of it
 *
 * A 34px shade over a 270px cover was the old number kept while the furniture
 * grew around it: a reading light the size of a doorbell.
 *
 * Everything below is a fraction of --lamp-w, so the whole fixture scales as
 * one object and the bulb always sits where the cone begins.
 */
.hcs-lamphead {
  position: absolute; left: 0; translate: -50% 0;
  top: calc(-1 * var(--head-h) + 4px);
  width: var(--lamp-w, 56px);
  --br: var(--beam-rgb); --bi: var(--beam-i);
}
.hcs-lamphead i {
  display: block; margin: 0 auto;
  width: calc(var(--lamp-w, 56px) * .40); height: calc(var(--lamp-w, 56px) * .30);
  background: linear-gradient(90deg, #585d63, #a9afb5 45%, #4f545a);
}
/* THE SHADE'S CURVE, and why it needs the slash.
 *
 * The study's shade is 40x22 with border-radius: 3px 3px 11px 11px — square
 * corners, so the same radius each way. Restated as a single list of
 * percentages that is no longer true: a percentage radius resolves against the
 * WIDTH horizontally and against the HEIGHT vertically, and this box is roughly
 * 76x42, so one number per corner gives two different radii and the scoop along
 * the bottom comes out barely bent. 28% of 42px is 12px where the study wants
 * 21px, which is the flat-bottomed shade.
 *
 * The two-axis form is the fix: horizontal radii before the slash, vertical
 * after. 3/40 and 3/22, 11/40 and 11/22 — the study's own proportions, and now
 * they hold at any --lamp-w.
 *
 * (Art deco never showed this because it throws the radius away entirely and
 * cuts its shade with a clip-path polygon instead.)
 */
.hcs-lamphead b {
  display: block; width: 100%; height: calc(var(--lamp-w, 56px) * .55);
  border-radius: 7.5% 7.5% 27.5% 27.5% / 13.5% 13.5% 50% 50%;
  background: linear-gradient(90deg, #41464c, #9ba1a7 38%, #5b6066 70%, #2f3338);
  box-shadow: 0 4px 10px rgba(0,0,0,.7), inset 0 -2px 4px rgba(0,0,0,.6);
}
.hcs-lamphead u {
  display: block; margin: calc(var(--lamp-w, 56px) * -.05) auto 0;
  width: calc(var(--lamp-w, 56px) * .65); height: calc(var(--lamp-w, 56px) * .125);
  /* two-axis again, for the same reason as the shade above: the study's
     0 0 6px 6px on a 26x5 bulb is 23% across and a full half-round down */
  border-radius: 0 0 23% 23% / 0 0 50% 50%;
  background: rgb(var(--br));
  box-shadow: 0 0 calc(var(--lamp-w, 56px) * .36) calc(var(--lamp-w, 56px) * .1)
              rgba(var(--br), calc(.7 * var(--bi)));
  transition: background .3s ease-out, box-shadow .3s ease-out;
}
.hcs-slot:hover .hcs-lamphead { --br: var(--beam-rgb-h); --bi: var(--beam-i-h); }

/* ── the cone ─────────────────────────────────────────────────────────── */
/* Width comes from the book: --cone-w is CONE_RATIO x the cover, so a fat
   volume gets a proportionally wider pool and the spread stays believable at
   any book size. It is now wider than the book-to-book pitch, so each lamp
   spills onto its neighbours — a row of picture lights does overlap, and the
   alternative was a stripe of light down each book with dark bands between.
   The apex is narrow (6% of the cone) because that is the bulb; the old 10%
   read as a slab of light leaving the fixture rather than a point source. */
/* Starts at the bulb, which is --fix-h down from the compartment ceiling — the
   fixture's own height, not the 40px constant that used to leave a gap under a
   big shade and cut into the shade under a small one.
   The apex is the study's 14% rather than 6%: a point source under a shade
   this size read as a laser, and a picture light does throw from a slot. */
.hcs-beam {
  --fix-h: calc(var(--lamp-w, 56px) * .93);
  position: absolute; left: 0; translate: -50% 0;
  top: calc(-1 * var(--head-h) + var(--fix-h));
  width: var(--cone-w, 300px);
  height: calc(100% + var(--head-h) - var(--fix-h));
  clip-path: polygon(43% 0, 57% 0, 100% 100%, 0 100%);
  background: linear-gradient(180deg,
    rgba(var(--br), calc(.46 * var(--bi))) 0%,
    rgba(var(--br), calc(.16 * var(--bi))) 46%,
    rgba(var(--br), calc(.04 * var(--bi))) 76%,
    transparent 100%);
  mix-blend-mode: screen;
  filter: blur(2.5px);
  --br: var(--beam-rgb); --bi: var(--beam-i);
  transition: opacity .28s ease-out, filter .28s ease-out;
}
.hcs-beam.is-hover { --br: var(--beam-rgb-h); --bi: var(--beam-i-h); opacity: 0; }
/* On hover the cone steps back rather than piling on — the point of picking a
   book up is to read it, so the artwork wins over the lighting. */
.hcs.beams .hcs-slot:hover .hcs-beam.is-hover { opacity: .5; }
.hcs.beams .hcs-slot:hover .hcs-beam { opacity: .38; filter: blur(3.5px); }

/* motes drifting down through the beam */
.hcs-beam i {
  position: absolute; border-radius: 50%; width: 3px; height: 3px;
  background: rgba(255,248,225,.9);
}
.hcs-beam i:nth-child(1) { left: 46%; top: 10%; animation: hcs-mote 9s linear infinite; }
.hcs-beam i:nth-child(2) { left: 53%; top: 24%; width: 2px; height: 2px; animation: hcs-mote2 12s linear infinite 2s; }
.hcs-beam i:nth-child(3) { left: 40%; top: 6%;  width: 2px; height: 2px; animation: hcs-mote 14s linear infinite 5s; }
@keyframes hcs-mote  { 0%{translate:0 0;opacity:0} 15%{opacity:.7} 100%{translate:14px 120px;opacity:0} }
@keyframes hcs-mote2 { 0%{translate:0 0;opacity:0} 20%{opacity:.55} 100%{translate:-18px 140px;opacity:0} }
@media (prefers-reduced-motion: reduce) {
  .hcs:not(.has-motion) .hcs-beam i { animation: none; opacity: .4; }
}

/* the pool the lamp casts on the board */
/* 0.84 of the cone, the way the study's 210px pool sits under its 250px cone —
   the pool is where the light LANDS, so it is narrower than the cone is wide. */
.hcs-pool {
  position: absolute; z-index: 2; pointer-events: none;
  left: 50%; translate: -50% 0; bottom: -2px;
  width: calc(var(--cone-w, 300px) * .84); height: calc(var(--cone-w, 300px) * .11);
  border-radius: 50%;
  mix-blend-mode: screen; filter: blur(4px);
  background: radial-gradient(closest-side,
    rgba(var(--beam-rgb), calc(.42 * var(--beam-i))), transparent);
  transition: background .3s ease-out;
}
.hcs-slot:hover .hcs-pool {
  background: radial-gradient(closest-side,
    rgba(var(--beam-rgb-h), calc(.46 * var(--beam-i-h))), transparent);
}

/* ── solo: with no progress to report, the rail idles low and only the book
   you reach for is lit. Everything else falls back into the dark. ───────── */
.hcs.spot-solo .hcs-row:has(.hcs-slot:hover) .hcs-slot:not(:hover) .hcs-art {
  filter: brightness(.42) saturate(.62);
}
.hcs.spot-solo .hcs-row:has(.hcs-slot:hover) .hcs-slot:not(:hover) .hcs-beam,
.hcs.spot-solo .hcs-row:has(.hcs-slot:hover) .hcs-slot:not(:hover) .hcs-pool { opacity: .22; }
.hcs.spot-solo .hcs-row:has(.hcs-slot:hover) .hcs-plank { filter: brightness(.6); }
.hcs.spot-solo .hcs-plank { transition: filter .3s ease-out; }

/* ── what the light does to the artwork ───────────────────────────────── */
/* Scoped to hc-fx-lit, which only the shelf asks for. The infobox draws the
   same component with effects="plain" and is therefore untouched by every
   rule below, however the shelf is configured. */
.hcs.beams .hc-fx-lit img {
  /* capped at 1.0: a white cover pushed past white clips to paper and the
     title disappears. The lamp is carried by the cone, not by the artwork. */
  filter:
    brightness(calc(.86 + .14 * var(--beam-i, .8)))
    saturate(calc(.93 + .10 * var(--beam-i, .8)));
  transition: filter .28s ease-out;
}
/* Hovered, the cover is shown exactly as it is — same fidelity as the
   infobox. No tint, no grade, no blur. */
/* Hover lifts the book a little, the way the study does — but with a
   soft-light wash rather than a brightness filter. brightness() drives white
   past white and eats the title; soft-light raises midtones and leaves
   highlights almost untouched, so a pale cover stays readable. */
.hcs.beams .hcs-slot:hover .hc-fx-lit img { filter: saturate(1.05); }
.hcs .hcs-slot:hover .hcs-tint {
  background: rgb(255, 244, 224);
  opacity: .20;
}

/* ═══ ART DECO ════════════════════════════════════════════════════════ */
/*
 * shelf="art deco". A whole design rather than a palette swap: gold on near
 * black, stepped rules instead of mouldings, chamfered corners in place of
 * rounded ones, and the sunburst fan as the case's own mark.
 *
 * It comes last in the sheet on purpose. The wood modes and this are both one
 * class deep on .hcs, so they tie on specificity and source order decides —
 * which is what lets shelf="art deco" quietly win however wood is set.
 *
 * The sheen is one gradient reused everywhere metal appears, so every gilt
 * edge in the case catches the light from the same direction. Two SVGs carry
 * the geometry: the fan, and the stepped corner (one file, mirrored for the
 * right-hand side).
 */
.hcs.deco {
  --deco-gold: #e3c24a;
  --deco-gold-deep: #8f7326;
  --deco-ink: #14171a;
  --gold-sheen: linear-gradient(150deg, #e3c24a 0%, #e8c953 26%, #eedc8f 45%, #f7efc9 51%, #e5c65b 80%);
  --gold-sheen-deep: linear-gradient(150deg, #8f7326, #e3c24a 50%, #8f7326);
  /* The board stays brass whatever the timber — it is the signature of the
     design, not a material choice. Everything else in the carcass takes
     --case-wood / --wood-face from the mode-* block above, so the wood
     argument is real here too: deco is veneer AND brass, not brass alone.
     (No backticks in this string — it is a template literal.) */
  --shelf-plank: #c8a63a;
  --deco-fan: url("data:image/svg+xml,%3Csvg width='13.533353mm' height='13.665177mm' viewBox='0 0 13.533353 13.665177' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3CclipPath clipPathUnits='userSpaceOnUse' id='c'%3E%3Crect style='fill:%23ffffff;stroke:none' width='13.533353' height='13.665177' x='86.292633' y='113.41824' /%3E%3C/clipPath%3E%3C/defs%3E%3Cg transform='translate(-86.292633,-113.41824)'%3E%3Cg clip-path='url(%23c)' style='fill:none;stroke:%23000000;stroke-width:0.264999'%3E%3Cpath d='m 93.059653,127.08343 a 6.766336,6.766336 0 0 1 6.766336,-6.76634' /%3E%3Cpath d='m 86.293106,120.31709 a 6.766336,6.766336 0 0 1 6.766336,6.76634' /%3E%3Cpath d='m 86.29772,120.31709 a 6.766336,6.766336 0 0 1 6.766336,-6.76633 6.766336,6.766336 0 0 1 6.766336,6.76633' /%3E%3Cpath d='m 93.059874,127.1504 c -0.01,-1.5182 0.319616,-3.03719 0.987396,-4.44032 1.087733,-2.28553 2.979917,-4.06856 5.289083,-5.02655' /%3E%3Cpath d='m 93.059133,127.15011 c -0.01822,-4.33881 1.731996,-8.53918 4.893523,-11.58816' /%3E%3Cpath d='m 93.059678,127.12677 c -0.0045,-4.49797 0.69305,-8.97012 2.068264,-13.25456' /%3E%3Cpath d='m 93.05944,127.14092 c 0.01,-1.5182 -0.319616,-3.03719 -0.987396,-4.44032 -1.087733,-2.28553 -2.979917,-4.06856 -5.289083,-5.02655' /%3E%3Cpath d='m 93.060181,127.14063 c 0.01822,-4.33881 -1.731996,-8.53918 -4.893523,-11.58816' /%3E%3Cpath d='m 93.059636,127.11729 c 0.0045,-4.49797 -0.69305,-8.97012 -2.068264,-13.25456' /%3E%3Cpath d='M 93.059651,127.08342 V 113.55076' /%3E%3Cpath d='m 86.292873,120.39394 c -0.01,-1.5182 0.319616,-3.03719 0.987396,-4.44032 1.087733,-2.28553 2.979917,-4.06856 5.289083,-5.02655' /%3E%3Cpath d='m 86.292132,120.39365 c -0.01822,-4.33881 1.731996,-8.53918 4.893523,-11.58816' /%3E%3Cpath d='m 86.292677,120.37031 c -0.0045,-4.49797 0.69305,-8.97012 2.068264,-13.25456' /%3E%3Cpath d='M 86.29265,120.32696 V 106.7943' /%3E%3Cpath d='m 99.82532,120.38446 c 0.01,-1.5182 -0.319616,-3.03719 -0.987396,-4.44032 -1.087733,-2.28553 -2.979917,-4.06856 -5.289083,-5.02655' /%3E%3Cpath d='m 99.826061,120.38417 c 0.01822,-4.33881 -1.731996,-8.53918 -4.893523,-11.58816' /%3E%3Cpath d='m 99.825516,120.36083 c 0.0045,-4.49797 -0.69305,-8.97012 -2.068264,-13.25456' /%3E%3Cpath d='M 99.825531,120.32696 V 106.7943' /%3E%3Cpath d='m 86.293329,133.91673 c -0.01,-1.5182 0.319616,-3.03719 0.987396,-4.44032 1.087733,-2.28553 2.979917,-4.06856 5.289083,-5.02655' /%3E%3Cpath d='m 86.292588,133.91644 c -0.01822,-4.33881 1.731996,-8.53918 4.893523,-11.58816' /%3E%3Cpath d='m 86.293133,133.8931 c -0.0045,-4.49797 0.69305,-8.97012 2.068264,-13.25456' /%3E%3Cpath d='M 86.293106,133.84975 V 120.31709' /%3E%3Cpath d='m 99.825778,133.90725 c 0.01,-1.5182 -0.319616,-3.03719 -0.987396,-4.44032 -1.087733,-2.28553 -2.979917,-4.06856 -5.289083,-5.02655' /%3E%3Cpath d='m 99.826519,133.90696 c 0.01822,-4.33881 -1.731996,-8.53918 -4.893523,-11.58816' /%3E%3Cpath d='m 99.825974,133.88362 c 0.0045,-4.49797 -0.69305,-8.97012 -2.068264,-13.25456' /%3E%3Cpath d='M 99.825989,133.84975 V 120.31709' /%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
  --deco-corner: url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg transform='translate(-40.612917,-83.589496)'%3E%3Cg transform='matrix(-0.30334715,0,0,0.30338915,92.930632,58.413673)' style='fill:none;stroke:%23000000;stroke-width:1.7443;'%3E%3Cpath d='M 171.59602,116.47005 A 32.748245,32.748245 0 0 1 138.84811,83.879621' /%3E%3Cpath d='M 171.61279,121.24895 A 37.527149,37.527149 0 0 1 134.06919,83.8863' /%3E%3Cpath d='m 40.612917,89.673823 125.163343,-10e-7 V 214.83716' /%3E%3Cpath d='M 154.16388,83.854096 V 101.28619 H 128.32241' /%3E%3Cpath d='m 84.85534,89.673823 v 4.818481 h 50.79229' /%3E%3Cpath d='M 171.59598,149.44348 V 83.854099 l -65.58938,-1e-6' /%3E%3Cpath d='m 171.59598,101.2862 h -17.43209 v 25.84147' /%3E%3Cpath d='m 165.77626,170.59474 h -4.81848 v -50.79229' /%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
}

/* ── the case: lacquer and pinstripes, chamfered rather than rounded ───── */
.hcs.deco .hcs-case {
  border-radius: 0;
  background:
    repeating-linear-gradient(90deg, rgba(227,194,74,.05) 0 1px, transparent 1px 54px),
    linear-gradient(180deg,
      color-mix(in srgb, var(--case-wood, #14171a) 84%, #fff),
      var(--case-wood, #14171a) 60%,
      color-mix(in srgb, var(--case-wood, #14171a) 82%, #000));
  box-shadow:
    0 0 0 1px rgba(227,194,74,.28),
    inset 0 1px 0 rgba(227,194,74,.22),
    inset 26px 0 34px -26px rgba(0,0,0,.85),
    inset -26px 0 34px -26px rgba(0,0,0,.85),
    0 26px 50px -20px rgba(0,0,0,.6);
}
/* cornice and plinth are flat gilt bands: deco has no mouldings to round */
.hcs.deco .hcs-case::before {
  height: 12px; border-radius: 0; background: var(--gold-sheen);
  box-shadow: 0 4px 12px -2px rgba(0,0,0,.7);
}
.hcs.deco .hcs-case::after {
  height: 14px; border-radius: 0; background: var(--gold-sheen-deep);
  box-shadow: 0 -4px 12px -3px rgba(0,0,0,.6);
}
/* the stepped corners, one drawing mirrored. Painted on the case, which does
   not scroll, so they stay at the corners of the furniture. */
.hcs-corner {
  position: absolute; z-index: 14; top: 13px; width: 40px; height: 40px;
  display: none; pointer-events: none;
  background-image: var(--gold-sheen);
  -webkit-mask-image: var(--deco-corner); mask-image: var(--deco-corner);
  -webkit-mask-size: contain; mask-size: contain;
  -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat;
  opacity: .8;
}
.hcs.deco .hcs-corner { display: block; }
.hcs-corner.is-l { left: 0; }
.hcs-corner.is-r { right: 0; scale: -1 1; }

/* ── the board: a gilt band, hatched ──────────────────────────────────── */
.hcs.deco .hcs-plank {
  height: 15px; border-radius: 0;
  background:
    repeating-linear-gradient(90deg, rgba(0,0,0,.26) 0 1px, transparent 1px 8px),
    var(--gold-sheen);
  box-shadow: 0 8px 18px rgba(0,0,0,.65), inset 0 -1px 0 rgba(0,0,0,.35);
}
.hcs.deco .hcs-plank::before {
  top: -18px; height: 18px;
  background: linear-gradient(180deg, transparent, rgba(0,0,0,.3));
}
.hcs.deco .hcs-plank::after { display: none; }

/* the compartment itself: lacquered, hairlined, edged in gold */
.hcs.deco .hcs-row {
  background:
    repeating-linear-gradient(90deg, rgba(227,194,74,.04) 0 1px, transparent 1px 38px),
    radial-gradient(120% 90% at 34% 0%, rgba(255,240,205,.09), rgba(0,0,0,0) 60%),
    linear-gradient(
      color-mix(in srgb, var(--case-wood, #14171a) 92%, #000),
      color-mix(in srgb, var(--case-wood, #14171a) 88%, #fff) 70%,
      color-mix(in srgb, var(--case-wood, #14171a) 88%, #000));
  box-shadow: inset 0 10px 24px rgba(0,0,0,.8), inset 0 0 0 1px rgba(227,194,74,.14);
}

/* ── end walls: the timber, with a gilt inner edge ────────────────────── */
.hcs.deco .hcs-wall {
  border-radius: 0;
  background: linear-gradient(90deg,
    var(--wood-lip, #14171a) 0 46%,
    var(--wood-face, #2b3036) 46% 74%,
    var(--deco-gold-deep) 74% 88%,
    var(--deco-gold) 88% 100%);
  box-shadow: 8px 0 18px -6px rgba(0,0,0,.9);
}

/* ── the plate: a chamfered tag, gold on black ────────────────────────── */
.hcs.deco .hcs-plate {
  border-radius: 0; padding: 3px 15px;
  background: var(--deco-ink); color: var(--deco-gold);
  clip-path: polygon(8px 0, calc(100% - 8px) 0, 100% 100%, 0 100%);
  letter-spacing: .26em; text-shadow: none;
  box-shadow: 0 2px 6px rgba(0,0,0,.6), inset 0 0 0 1px rgba(227,194,74,.4);
}
.hcs.deco .hcs-plate::before, .hcs.deco .hcs-plate::after { display: none; }
.hcs.deco .hcs-plate i { color: rgba(227,194,74,.6); }
.hcs.deco .hcs-more:hover { color: var(--deco-gold); }

/* ── bookend ──────────────────────────────────────────────────────────── */
.hcs.deco .hcs-bookend {
  border-radius: 0; width: 11px;
  background: var(--gold-sheen);
  box-shadow: -6px 4px 10px rgba(0,0,0,.6);
}
.hcs.deco .hcs-bookend::after {
  border-radius: 0; background: var(--gold-sheen-deep);
}

/* ── spines: rules and a lozenge instead of a printer's dot ───────────── */
.hcs.deco .hcs-sp { border-radius: 0; }
.hcs.deco .hcs-sp-rule { height: 2px; background: rgba(227,194,74,.8); }
.hcs.deco .hcs-sp-title {
  font-family: var(--font-interface); font-weight: 500;
  text-transform: uppercase; letter-spacing: .14em; color: rgba(240,222,168,.95);
}
.hcs.deco .hcs-sp-mark {
  border-radius: 0; border: none; width: 7px; height: 7px;
  background: rgba(227,194,74,.7);
  clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
}

/* ── a coverless book, deco ───────────────────────────────────────────── */
/* Same front view, different press: the cloth goes dark and desaturated, the
   ink goes gold, and the rules step. */
.hcs.deco .hc-blank {
  background:
    repeating-linear-gradient(0deg, rgba(255,255,255,.03) 0 1px, transparent 1px 3px),
    radial-gradient(120% 90% at 12% 8%, rgba(255,255,255,.12), rgba(0,0,0,.42) 85%),
    linear-gradient(160deg,
      hsl(calc(var(--blank-hue) * 1deg) 30% 17%),
      hsl(calc(var(--blank-hue) * 1deg + 18deg) 34% 10%));
}
.hcs.deco .hc-blank-plate { color: var(--deco-gold); }
.hcs.deco .hc-blank-rule { height: 2px; opacity: .8; }
.hcs.deco .hc-blank-title {
  font-family: var(--font-interface); font-weight: 500;
  text-transform: uppercase; letter-spacing: .05em;
}

/* ── the fixture, in brass ────────────────────────────────────────────── */
.hcs.deco .hcs-rail { background: var(--gold-sheen-deep); border-radius: 0; }
.hcs.deco .hcs-lamphead i { background: var(--gold-sheen-deep); }
.hcs.deco .hcs-lamphead b {
  border-radius: 0; background: var(--gold-sheen);
  clip-path: polygon(14% 0, 86% 0, 100% 100%, 0 100%);
}

/* the fan, ghosted into the empty run at the end of a shelf */
.hcs.deco .hcs-empty::after {
  content: ""; position: absolute; right: 22%; bottom: 16px;
  width: 120px; height: 120px; pointer-events: none;
  background-image: var(--gold-sheen);
  -webkit-mask-image: var(--deco-fan); mask-image: var(--deco-fan);
  -webkit-mask-size: contain; mask-size: contain;
  -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat;
  opacity: .07;
}
`;

function Styles() {
  dc.useEffect(() => {
    let el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement("style");
      el.id = STYLE_ID;
      document.head.appendChild(el);
    }
    if (el.textContent !== CSS) el.textContent = CSS;
  }, []);
  return null;
}

// ════════════════════════════════════════════════════════════════════════════
//  exports
// ════════════════════════════════════════════════════════════════════════════
return {
  // config
  TIER_COLOR, STATUS_COLOR, READING, UPCOMING, DONE, TIER_RANK,
  SHELF_MODES, SHELF_STYLES, DEFAULT_WOOD, styleClass, woodFor,
  IGNORE_PATHS, isIgnored,
  // helpers
  clamp, tint, fmtDate, hashOf, tiltFor, baseName, parseLink, resolveFile,
  // model
  useNotePath, useFrontmatter, useBook, openBook,
  // writes
  writeFields, writeProgress, markDragEnd,
  // pdf
  firstPageThumb, annotationProfile, useAnnotations,
  // rolling releases
  pageHash, useSiteHash,
  // artwork
  coverSrc, useCoverSrc, findSpineImage, useSpineImage, dominantColor, useCoverColor,
  // layout
  useFitHeight, useEdgeScroll,
  // components
  BookCover, ShelfCover, FlatCover, BlankCover, NoteLink, Styles,
};
