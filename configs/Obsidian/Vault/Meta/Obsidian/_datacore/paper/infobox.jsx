// ════════════════════════════════════════════════════════════════════════════
//  infobox.jsx  —  the paper infobox
//  Location: Meta/Obsidian/_datacore/paper/infobox.jsx
//
//    ```datacorejsx
//    const { Infobox } = await dc.require("Meta/Obsidian/_datacore/paper/infobox.jsx");
//    return function View() { return <Infobox path={dc.useCurrentPath()} />; };
//    ```
//
//  The book infobox's sibling, and it borrows that one's palette: pills are
//  theme colours tinted at 12%, not hardcoded hex, so it follows whatever
//  theme you are running. Two things differ, because a paper is not a book —
//  the cover is a rasterised page rather than a jpg, and reading progress is a
//  poor summary of a document you read out of order, so what you get instead
//  is what you marked and where.
//
//  Options
//    width       600   render width of the page image, px
//    maxHeight   900   cap on the page image
//    topPages     12   how many marked pages the strip shows
//    autoStats  true   write pages / progress / coverage / highlights /
//                      underlines / explore back to frontmatter after each read
//
//  Frontmatter it reads
//    paper / pdf        link to the PDF          (title: is accepted too)
//    arxiv              id, with or without the "arXiv:" prefix
//    arxiv-version      which version you hold — set this and the box will
//                       check arXiv once, quietly, and offer an Update button
//                       top right if a newer one exists. Without it, no check
//                       is made at all.
//    subtitle           overrides the part of the filename after the colon
//
//  Relations — every one of these is a LIST of links:
//    builds-on · extends · compare-with · refutes · superseded-by · prereq
//    related            the unqualified one: papers that belong with this one
//                       without you having to say how.
//
//        related:
//          - "[[Layer Normalization]]"
//          - "[[The Annotated Transformer]]"
//
//  A relation left in place but not filled in comes through as [""], and is
//  treated as absent — no key, no empty row.
//
//  There is no `topics:` property: topics are the note's TAGS, minus the ones
//  that say what kind of note it is (#paper and friends). One place to write
//  them, and they stay clickable everywhere else in the vault.
//
//  The page preview needs pdf.js. Obsidian only publishes it once its own PDF
//  view has been built, so a fresh session may have no picture at first — the
//  panel is clickable regardless, and the preview appears by itself the moment
//  a PDF is opened anywhere. Drop a pdf.js ES build in
//  Meta/Obsidian/_datacore/vendor/ to skip the wait entirely.
//
//  There is no need for `title:` either. The filename is the title, and text
//  after a colon — or " - ", or an em dash, since Obsidian will not put a colon
//  in a filename on Windows — is read as the subtitle. Keep `title:` only if it
//  is doing its other job, pointing at the PDF.
//
//  All PDF work lives in Meta/Obsidian/_datacore/pdf/pdf.jsx.
//
//  NOTE: never declare a local named `h` in this file — it is the JSX pragma.
// ════════════════════════════════════════════════════════════════════════════

const pdf = await dc.require("Meta/Obsidian/_datacore/pdf/pdf.jsx");
const {
  resolvePdf, parseLink, usePdfStats, usePageImage, useCitations,
  writeFields, openAt, swatchFor, useArxivUpdate, replaceArxivPdf, forgetPdf,
} = pdf;

// ── palette ─────────────────────────────────────────────────────────────────
// Theme colour NAMES, resolved through Obsidian's own --color-* variables, the
// same way the book infobox does it. Nothing here is a literal hex.
const TIER_COLOR = {
  "S+++": "red", "S++": "red", "S+": "red", S: "orange",
  "A+": "orange", A: "yellow", "B+": "yellow", B: "green",
  C: "blue", D: "purple", F: "purple",
};

const STATUS_COLOR = {
  reading: "blue", queued: "purple", planned: "purple",
  skimmed: "yellow", paused: "yellow",
  read: "green", done: "green", completed: "green",
  shelved: "cyan", reference: "cyan", dropped: "red",
};

const tint = (name) => name
  ? { background: `rgba(var(--color-${name}-rgb), 0.12)`, color: `var(--color-${name})` }
  : { background: "var(--background-modifier-hover)", color: "var(--text-muted)" };

const KIND_LABEL = {
  conference: "conference", journal: "journal", workshop: "workshop",
  preprint: "preprint", "tech-report": "tech report", thesis: "thesis",
};

/**
 * Highlight colours come from the THEME, via pdf.jsx's swatchFor().
 *
 * The pen colours in the PDF are chosen to sit on white paper under a reader's
 * backlight. Repainting those literal values into a panel means a highlighter
 * yellow burning a hole in a dark theme and a pale grey vanishing into a light
 * one. What the bar needs to carry is "which colour was this", not "what
 * wavelength" — so the identity is matched exactly against the pen (that is
 * what HL_BY_HEX in pdf.jsx does) and only the display goes through
 * --color-yellow and friends.
 */

/** Tags that describe the note's type rather than its subject. */
const NON_TOPIC_TAGS = new Set(["paper", "papers", "book", "note", "literature"]);

/**
 * The filename is the title; anything after a colon is the subtitle.
 *
 * Obsidian will not let a filename contain ":" on Windows, so a real vault
 * writes the break as " - " or an em dash instead — all three are accepted.
 * An explicit `subtitle:` still wins, and so does an explicit `title:` for the
 * odd case where the file is named something shorter than the paper is.
 */
function splitTitle(name) {
  const m = String(name ?? "").match(/^(.*?)\s*(?::|\s[—–-]\s)\s*(.+)$/);
  return m ? { title: m[1].trim(), sub: m[2].trim() } : { title: String(name ?? ""), sub: null };
}

const num = (v) =>
  typeof v === "number" ? v : v == null ? null : Number(String(v).replace(/[^0-9.]/g, "")) || null;

const compact = (n) =>
  n == null ? null
    : n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M"
    : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, "") + "k"
    : String(n);

/** "this year", "last year", "7 years ago" — a date tells you less than a gap. */
function yearsAgo(published, yearField) {
  const y = yearField ? Number(yearField)
    : published ? new Date(String(published)).getFullYear() : null;
  if (!Number.isFinite(y)) return null;
  const d = new Date().getFullYear() - y;
  if (d <= 0) return "this year";
  if (d === 1) return "last year";
  return `${d} years ago`;
}

function bibtex(get, name) {
  const authors = [].concat(get("author") ?? get("authors") ?? [])
    .map((a) => String(a?.display ?? a)).join(" and ");
  const key = get("citekey") || String(name).toLowerCase().replace(/[^a-z0-9]+/g, "");
  const venue = get("venue") ?? get("journal") ?? get("conference");
  const arxiv = String(get("arxiv") ?? "").replace(/^arxiv:\s*/i, "");
  const rows = [
    ["title", get("title") ? String(get("title")).replace(/\[\[|\]\]/g, "") : name],
    ["author", authors || null],
    ["year", get("year") ?? (get("published") ? new Date(String(get("published"))).getFullYear() : null)],
    ["booktitle", venue],
    ["doi", get("doi")],
    ["eprint", arxiv || null],
    ["archivePrefix", arxiv ? "arXiv" : null],
  ].filter((r) => r[1] != null && r[1] !== "");
  return `@inproceedings{${key},\n` +
    rows.map(([k, v]) => `  ${k} = {${v}}`).join(",\n") + "\n}";
}

// ── small pieces ────────────────────────────────────────────────────────────
function NoteLink({ link, sourcePath }) {
  const target = parseLink(link);
  if (!target) return null;
  const label =
    (typeof link === "object" && link ? link.display : null) ??
    String(link ?? "").match(/\|([^\]]+)\]\]/)?.[1] ??
    target.split("/").pop().replace(/\.(md|pdf)$/i, "");
  return (
    <a
      class="internal-link pcx-link"
      href={target}
      onClick={(e) => {
        e.preventDefault();
        app.workspace.openLinkText(target, sourcePath ?? "", e.metaKey || e.ctrlKey);
      }}
    >{label}</a>
  );
}

function useNote(path) {
  const rev = dc.useIndexUpdates();
  return dc.useMemo(() => {
    const cache = path ? (app.metadataCache.getCache(path) ?? {}) : {};
    const fm = cache.frontmatter ?? {};
    const get = (k) => {
      const v = fm[k];
      if (v == null || v === "") return null;
      return v?.value !== undefined ? v.value : v;
    };
    // Tags come from both places Obsidian keeps them: the frontmatter list and
    // the ones written inline in the body. Deduped, hash stripped.
    const tags = Array.from(new Set(
      [
        ...(cache.tags ?? []).map((t) => t?.tag),
        ...[].concat(fm.tags ?? fm.tag ?? []),
      ]
        .map((t) => String(t ?? "").replace(/^#/, "").trim())
        .filter(Boolean)
    ));
    return { fm, get, tags, name: path?.split("/").pop()?.replace(/\.md$/, "") ?? "" };
  }, [path, rev]);
}

// ── the infobox ─────────────────────────────────────────────────────────────
function Infobox({ path, width = 600, maxHeight = 900, topPages = 12, autoStats = true }) {
  const currentPath = dc.useCurrentPath();
  const notePath = path ?? currentPath;
  const note = useNote(notePath);
  const get = note.get;

  const file = dc.useMemo(
    () => resolvePdf(get("paper") ?? get("pdf") ?? get("title"), notePath),
    [notePath, get("paper"), get("pdf"), get("title")]
  );

  const { loading, error, data } = usePdfStats(file);

  const figure = num(get("figure"));
  const img = usePageImage(file, figure ?? 1, width);
  const [copied, setCopied] = dc.useState(null);
  const written = dc.useRef("");

  const arxiv = String(get("arxiv") ?? "").replace(/^arxiv:\s*/i, "") || null;
  const cites = useCitations(arxiv, get("citations"), notePath);

  // ── has the paper moved on? ──────────────────────────────────────────────
  // Deliberately cheap and deliberately conditional: one request, a regex, and
  // only when the note already records which version it holds. Without
  // `arxiv-version` there is nothing to compare against, so nothing is asked —
  // opening a paper should not quietly become a network event.
  const { latest, have, stale } =
    useArxivUpdate(arxiv, get("arxiv-version"), !!arxiv && !!file);
  const [updating, setUpdating] = dc.useState(null);   // null | "busy" | "done" | "failed"
  const [why, setWhy] = dc.useState(null);             // why it failed, or where the old copy went

  const doUpdate = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (updating === "busy" || !file || !arxiv || latest == null) return;
    setUpdating("busy");
    setWhy(null);

    // The previous PDF is copied aside as `Name.v6.pdf.bk` before the new bytes
    // land, so a replacement that turns out to be worse than what it replaced
    // is one rename away from being undone.
    const res = await replaceArxivPdf(file, arxiv, latest, { haveVersion: have });

    if (res.ok) {
      // Written back in the shape you wrote it in: a note that says `v7` gets
      // `v8`, one that says `7` gets `8`. Round-tripping "v7" into the number 7
      // would quietly rewrite your frontmatter the first time this ran.
      const marked = /^\s*v/i.test(String(get("arxiv-version") ?? ""));
      await writeFields(notePath, { "arxiv-version": marked ? `v${latest}` : latest })
        .catch(() => {});
      // replaceArxivPdf already dropped the cached document, stats and page
      // image; this is the mounted component's own copy of the same call, kept
      // so the panel re-reads the file it is looking at right now.
      forgetPdf(file.path);
      setWhy(res.backup ? `previous copy kept as ${res.backup.split("/").pop()}` : null);
      setUpdating("done");
    } else {
      // The reason travels to the tooltip AND to the console. Failing with
      // neither is what made this impossible to diagnose the first time.
      setWhy(res.reason ?? "unknown");
      setUpdating("failed");
      window.setTimeout(() => setUpdating(null), 8000);
    }
  };

  // ── write the derived numbers back ───────────────────────────────────────
  // Counts only: how much you marked, how far you got, how much of the paper
  // you touched. No per-colour keys — the colours are a reading signature, not
  // something to query on.
  dc.useEffect(() => {
    if (!autoStats || !data || !notePath || !file) return;
    const sig = `${file.path}:${file.stat?.mtime}:${data.total}:${data.underlines}`;
    if (written.current === sig) return;
    written.current = sig;

    const patch = {
      pages: data.pages,
      progress: data.furthest,
      coverage: Math.round(data.coverage * 100),
      highlights: data.total,
      underlines: data.underlines || null,
      // references still to read — a to-do, so it belongs in frontmatter
      explore: data.byColor.find((c) => c.color === "explore")?.n || null,
    };
    // clear the per-colour keys an older version wrote
    for (const k of Object.keys(note.fm)) if (k.startsWith("hl-")) patch[k] = null;
    if ("annotated" in note.fm) patch.annotated = null;
    if ("highlight-legend" in note.fm) patch["highlight-legend"] = null;
    writeFields(notePath, patch).catch(() => {});
  }, [notePath, file?.path, file?.stat?.mtime, data?.total, autoStats]);

  // ── the marked pages worth showing ───────────────────────────────────────
  // A 40-page paper cannot fit one tick per page in a 460px box and stay
  // legible, and a tick per page is not what you want to know anyway. Take the
  // busiest `topPages`, then put them back in page order so the strip still
  // reads left to right through the paper.
  const strip = dc.useMemo(() => {
    if (!data?.byPage) return null;
    const marked = data.byPage.filter((p) => p.n > 0);
    if (!marked.length) return null;
    const top = marked.slice().sort((a, b) => b.n - a.n).slice(0, topPages);
    const max = Math.max(...top.map((p) => p.n));
    return top.sort((a, b) => a.page - b.page).map((p) => ({ ...p, dens: p.n / max }));
  }, [data, topPages]);

  // References marked "still to read" — the one colour whose count is a to-do
  // rather than a description of what you already did.
  const unexplored = dc.useMemo(
    () => data?.byColor?.find((c) => c.color === "explore")?.n ?? 0,
    [data]
  );

  const copy = (text, tag) => async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(String(text));
      setCopied(tag);
      setTimeout(() => setCopied(null), 1400);
    } catch {}
  };

  const val = (v) =>
    v == null || (typeof v !== "object" && String(v).trim() === "") ? null
      : (typeof v === "object" || String(v).includes("[["))
        ? <NoteLink link={v} sourcePath={notePath} />
        : String(v);

  /**
   * Render a frontmatter list as "a · b · c", dropping the blanks.
   *
   * This is why `related:` looked broken. A relation written out in the
   * template but not yet filled in arrives as [""] — a one-item array, so the
   * old code declared the relation present and then rendered a separator with
   * nothing on either side. Emptiness is decided AFTER the items are resolved,
   * so a list of blanks is the same as no list at all.
   */
  const joined = (items, sep = " · ") => {
    const parts = [].concat(items ?? []).map(val).filter(Boolean);
    return parts.length ? parts.flatMap((el, i) => (i ? [sep, el] : [el])) : null;
  };

  const Row = ({ label, children }) =>
    children == null || children === "" ? null : (
      <div class="pcx-row"><span class="pcx-key">{label}</span><span class="pcx-val">{children}</span></div>
    );

  const authors = [].concat(get("author") ?? get("authors") ?? []);
  const affil = [].concat(get("affiliation") ?? []);
  const venue = get("venue") ?? get("conference") ?? get("journal");
  const year = get("year") ?? (get("published") ? new Date(String(get("published"))).getFullYear() : null);
  const tier = get("tier"), status = get("status");

  // no PDF button — the page image above is the way in
  const links = [
    ["arXiv", arxiv ? `https://arxiv.org/abs/${arxiv}` : null],
    ["Code", get("code")],
    ["Blog", get("blog")],
    ["Site", get("site")],
    ["Reviews", get("reviews") ?? get("openreview")],
  ].filter((l) => !!l[1]);

  // `related` is the unqualified one: a list of papers that belong together
  // without you having to say how. It sits last, after the relations that make
  // a claim. Every one of these is a LIST in frontmatter:
  //
  //   related:
  //     - "[[Layer Normalization]]"
  //     - "[[The Annotated Transformer]]"
  //
  // Resolved here rather than at render time, so a relation whose items are all
  // blank counts as absent and the whole block disappears when nothing is set.
  const RELATIONS = [
    ["builds on", "builds-on"], ["extends", "extends"], ["compare", "compare-with"],
    ["refutes", "refutes"], ["superseded by", "superseded-by"], ["prereq", "prereq"],
    ["related", "related"],
  ];
  const rels = RELATIONS
    .map(([label, key]) => ({ label, key, items: joined(get(key)) }))
    .filter((r) => r.items);

  // Topics are tags, not a parallel `topics:` list — one place to write them,
  // and they stay clickable everywhere else in the vault. The tag that says
  // "this note is a paper" is not a topic, so it and its kin are dropped.
  const heading = splitTitle(note.name);
  const topics = note.tags.filter((t) => !NON_TOPIC_TAGS.has(t.toLowerCase()));
  const openTag = (t) => (e) => {
    e.preventDefault();
    app.workspace.openLinkText("#" + t, notePath ?? "", false);
  };

  return (
    <>
      <Styles />
      <div class="pcx">
        <div class="pcx-sheet">
          {/* Top right, and only when there is something to say. Theme colours
              throughout — accent while it is worth pressing, green once the new
              copy is down, error red if arXiv would not hand it over. */}
          {(stale || updating) && (
            <a
              href="#"
              class={"pcx-update" + (updating ? ` is-${updating}` : "")}
              title={
                updating === "done" ? `Now holding v${latest}${why ? ` · ${why}` : ""}`
                  : updating === "failed" ? `Could not update: ${why ?? "unknown"}`
                  : `You have v${have}, arXiv is at v${latest} — click to replace the PDF. The copy you have is kept as .pdf.bk`
              }
              onClick={doUpdate}
            >
              {updating === "busy" ? "Updating…"
                : updating === "done" ? `v${latest}`
                : updating === "failed" ? "Failed — hover"
                : `Update to v${latest}`}
            </a>
          )}

          {img.url ? (
            <img
              src={img.url}
              class="pcx-page"
              style={{ maxWidth: width + "px", maxHeight: maxHeight + "px" }}
              title={figure ? `page ${figure} — click to open the PDF` : "click to open the PDF"}
              onClick={(e) => openAt(file, figure ?? 1, notePath, e)}
            />
          ) : (
            /* The preview is a bonus; the way in is not. Whether pdf.js has
               turned up or not, if there is a PDF behind this note the panel
               opens it, placeholder or not. `ready` is false until pdf.js
               exists, which it does from the moment any PDF is opened
               anywhere; then the image appears on its own. */
            <div
              class={"pcx-page pcx-empty" + (file ? " is-openable" : "")}
              style={{ width: width + "px", maxHeight: maxHeight + "px" }}
              role={file ? "button" : undefined}
              tabIndex={file ? 0 : undefined}
              title={file ? `${file.name} — click to open` : undefined}
              onClick={file ? (e) => openAt(file, figure ?? 1, notePath, e) : undefined}
              onKeyDown={file
                ? (e) => (e.key === "Enter" || e.key === " ") && openAt(file, figure ?? 1, notePath, e)
                : undefined}
            >
              {!file ? "no `paper:` link"
                : error ? "preview unavailable — click to open the PDF"
                : !img.ready ? "waiting for pdf.js — click to open the PDF"
                : "rendering…"}
            </div>
          )}
        </div>

        {/* ── what you marked, and where ─────────────────────────────── */}
        {strip && (
          <div class="pcx-marks">
            <div class="pcx-pages">
              {strip.map((p) => (
                <span
                  key={p.page}
                  class="pcx-pg"
                  title={`p${p.page} · ${p.n} highlight${p.n === 1 ? "" : "s"}`}
                  onClick={(e) => openAt(file, p.page, notePath, e)}
                >
                  <i style={{
                    height: `${6 + 16 * p.dens}px`,
                    background: swatchFor(p.top),
                  }} />
                  <b>{p.page}</b>
                </span>
              ))}
            </div>

            <div class="pcx-plabel">
              <span><b>{data.total}</b> highlight{data.total === 1 ? "" : "s"}
                {data.underlines ? <> · <b>{data.underlines}</b> underlined</> : null}
              </span>
              <span>
                {Math.round(data.coverage * 100)}% of pages marked
                {unexplored > 0 && <> · <b>{unexplored}</b> to explore</>}
              </span>
            </div>
          </div>
        )}

        {/* ── the body ───────────────────────────────────────────────── */}
        <div class="pcx-body">
          {/* The filename is the title. `title:` stays useful as the pointer to
              the PDF, so it is not read as a heading unless it is plain text. */}
          <h3 class="pcx-title">{heading.title}</h3>
          {(get("subtitle") ?? heading.sub) && (
            <div class="pcx-sub">{get("subtitle") ?? heading.sub}</div>
          )}

          {joined(authors.slice(0, 8)) && (
            <div class="pcx-authors">
              {joined(authors.slice(0, 8))}
              {authors.length > 8 && <span class="pcx-dim"> +{authors.length - 8}</span>}
            </div>
          )}

          {loading && <div class="pcx-loading">reading annotations…</div>}
          {error && <div class="pcx-err">{String(error.message ?? error)}</div>}

          {/* Metadata first, judgement after — tier and status are your notes
              about the paper, not part of its citation. */}
          <Row label="Affiliation">{joined(affil)}</Row>
          <Row label="Venue">
            {venue ? <>{venue}{year ? ` ${year}` : ""}
              {get("venue-kind") && <span class="pcx-dim"> · {KIND_LABEL[get("venue-kind")] ?? get("venue-kind")}</span>}
            </> : null}
          </Row>
          <Row label="Published">{yearsAgo(get("published"), get("year"))}</Row>
          <Row label="Cited by">{compact(num(cites))}</Row>
          <Row label="Course">{val(get("course"))}</Row>

          <div class="pcx-pills">
            {tier && <span class="pcx-pill" style={tint(TIER_COLOR[tier])}>{tier}</span>}
            {status && <span class="pcx-pill" style={tint(STATUS_COLOR[status])}>{status}</span>}
            {topics.slice(0, 6).map((t) => (
              <a
                key={t}
                href="#"
                class="pcx-pill pcx-topic"
                style={tint(null)}
                title={`#${t}`}
                onClick={openTag(t)}
              >{t}</a>
            ))}
          </div>

          {rels.length > 0 && (
            <div class="pcx-rels">
              {rels.map((r) => (
                <div class="pcx-rel" key={r.key}>
                  <span class="pcx-relkey">{r.label}</span>
                  <span class="pcx-relval">{r.items}</span>
                </div>
              ))}
            </div>
          )}

          {/* the links sit immediately above the claim, so the last thing you
              read in the box is the sentence the paper is actually making */}
          <div class="pcx-links">
            {links.map((l) => (
              <a key={l[0]} href={l[1]} target="_blank" rel="noopener">{l[0]}</a>
            ))}
            <a
              href="#"
              class={"pcx-cite" + (copied === "bib" ? " copied" : "")}
              title="Copy BibTeX"
              onClick={(e) => { e.preventDefault(); copy(bibtex(get, note.name), "bib")(e); }}
            >{copied === "bib" ? "Copied" : "Cite"}</a>
          </div>

          {(get("claim") || get("blurb") || get("abstract")) && (
            <div class="pcx-blurb">{get("claim") ?? get("blurb") ?? get("abstract")}</div>
          )}
        </div>
      </div>
    </>
  );
}

// ── styles ──────────────────────────────────────────────────────────────────
const STYLE_ID = "paper-datacore-styles";

const CSS = `
.pcx {
  border: 1px solid var(--background-modifier-border); border-radius: 10px;
  overflow: hidden; background: var(--background-primary-alt);
  font-family: var(--font-interface); font-size: .86em;
}
.pcx-sheet {
  position: relative; display: flex; flex-direction: column; align-items: center;
  padding: 14px 14px 10px; background: var(--background-secondary);
}
/* height auto + max-height lets a portrait page scale down proportionally
   rather than being letterboxed */
.pcx-page {
  display: block; max-width: 100%; height: auto; border-radius: 4px; cursor: pointer;
  box-shadow: 0 2px 10px rgba(0,0,0,.28), 0 0 0 1px var(--background-modifier-border);
  transition: transform .12s ease, box-shadow .12s ease;
}
/* A whole-pixel translate, not translateY inside transform: a transform on an
   <img> puts it on its own composited layer, which rasterises the page once at
   the layer's scale and leaves it soft for as long as the pointer is on it. */
.pcx-page:hover {
  translate: 0 -1px;
  box-shadow: 0 6px 18px rgba(0,0,0,.34), 0 0 0 1px var(--background-modifier-border);
}
.pcx-empty {
  display: grid; place-items: center; aspect-ratio: 8.5/11; padding: 0 24px;
  text-align: center; line-height: 1.5;
  color: var(--text-faint); background: var(--background-primary); cursor: default;
}
/* There is a PDF behind this note even though there is no picture of it yet */
.pcx-empty.is-openable {
  cursor: pointer; color: var(--text-muted);
  border: 1px dashed var(--background-modifier-border); border-radius: 4px;
  transition: color .12s ease-out, border-color .12s ease-out;
}
.pcx-empty.is-openable:hover { color: var(--text-accent); border-color: var(--text-accent); }
.pcx-empty.is-openable:focus-visible { outline: 2px solid var(--text-accent); outline-offset: 3px; }
.pcx-dim { color: var(--text-faint); }

/* ── the arXiv update button ──────────────────────────────────────────── */
/* Top right of the page image, floating over the sheet. Every colour is a
   theme variable, so it reads as a control in whatever theme is running
   rather than as a coloured rectangle someone pasted in. */
.pcx-update {
  position: absolute; top: 10px; right: 10px; z-index: 3;
  padding: 3px 10px; border-radius: 6px;
  font-size: .82em; font-weight: var(--font-medium); text-decoration: none;
  color: var(--text-on-accent); background: var(--interactive-accent);
  box-shadow: 0 2px 8px rgba(0,0,0,.28);
  transition: background .14s ease-out, opacity .14s ease-out;
}
.pcx-update:hover { background: var(--interactive-accent-hover); }
.pcx-update.is-busy { opacity: .7; pointer-events: none; }
.pcx-update.is-done {
  color: var(--text-normal); background: var(--background-modifier-success);
  pointer-events: none;
}
.pcx-update.is-failed { color: var(--text-on-accent); background: var(--text-error); }

/* ── what you marked ──────────────────────────────────────────────────── */
.pcx-marks {
  padding: 11px 14px 9px; background: var(--background-primary);
  border-top: 1px solid var(--background-modifier-border);
}
/* the busiest pages, back in page order */
.pcx-pages { display: flex; align-items: flex-end; gap: 6px; margin-top: 11px; }
.pcx-pg {
  flex: 1 1 0; min-width: 0; display: flex; flex-direction: column;
  align-items: center; gap: 3px; cursor: pointer;
}
.pcx-pg i {
  width: 100%; border-radius: 2px; transition: transform .12s ease;
  box-shadow: inset 0 0 0 1px rgba(0,0,0,.16);
}
.pcx-pg b {
  font-size: 9.5px; font-weight: 400; color: var(--text-faint);
  font-variant-numeric: tabular-nums;
}
.pcx-pg:hover i { transform: scaleY(1.14); }
.pcx-pg:hover b { color: var(--text-normal); }

.pcx-plabel {
  display: flex; justify-content: space-between; margin-top: 9px;
  color: var(--text-muted); font-size: .9em; font-variant-numeric: tabular-nums;
}
.pcx-plabel b { color: var(--text-normal); font-weight: var(--font-medium); }

/* ── body ─────────────────────────────────────────────────────────────── */
.pcx-body { padding: 12px 14px 14px; }
.pcx-title {
  margin: 0 0 2px; font-family: var(--h3-font); font-weight: var(--h3-weight);
  font-size: 1.18em; line-height: 1.25; color: var(--h3-color);
}
.pcx-title a { color: inherit; text-decoration: none; }
.pcx-title a:hover { text-decoration: underline; }
.pcx-sub { color: var(--text-muted); margin-bottom: 4px; font-style: italic; }
.pcx-authors { color: var(--text-muted); font-size: .92em; margin-bottom: 10px; line-height: 1.5; }

.pcx-row { display: flex; gap: 10px; padding: 3px 0; line-height: 1.5; }
.pcx-row + .pcx-row { border-top: 1px solid var(--background-modifier-border); }
.pcx-key { flex: 0 0 92px; color: var(--text-faint); }
.pcx-val { flex: 1; min-width: 0; color: var(--text-muted); }
.pcx-val a, .pcx-link { color: var(--text-accent); text-decoration: none; }
.pcx-val a:hover { text-decoration: underline; }

.pcx-pills { display: flex; flex-wrap: wrap; gap: 5px; margin: 11px 0 0; }
.pcx-pill {
  padding: 1px 8px; border-radius: var(--radius-s);
  font-size: .84em; font-weight: var(--font-medium); white-space: nowrap;
}
/* topics are tags, so they behave like tags: click one and the search opens */
.pcx-topic { font-weight: 400; text-decoration: none; cursor: pointer; }
.pcx-topic::before { content: "#"; opacity: .45; }
.pcx-topic:hover { color: var(--text-accent) !important; }

.pcx-links { display: flex; flex-wrap: wrap; gap: 6px; margin: 11px 0 0; }
.pcx-links a {
  padding: 2px 10px; border-radius: 6px; font-size: .86em; text-decoration: none;
  background: var(--background-modifier-hover); color: var(--text-muted);
  transition: color .12s ease-out;
}
.pcx-links a:hover { color: var(--text-accent); }
.pcx-cite { cursor: pointer; }
.pcx-cite.copied { color: var(--color-green) !important; }

.pcx-rels { margin-top: 11px; padding-top: 9px; border-top: 1px dashed var(--background-modifier-border); }
.pcx-rel { display: flex; gap: 10px; padding: 1px 0; line-height: 1.5; }
.pcx-relkey { flex: 0 0 92px; color: var(--text-faint); font-size: .92em; }
.pcx-relval { flex: 1; min-width: 0; font-size: .92em; }

/* --text-faint is placeholder contrast; the claim is the one sentence in here
   you actually want to read, so it gets body colour and a little more size. */
.pcx-blurb {
  margin-top: 11px; padding-top: 9px;
  color: var(--text-normal); font-size: 1.02em; line-height: 1.6;
  border-top: 1px dashed var(--background-modifier-border);
}
.pcx-loading { color: var(--text-faint); font-size: .88em; margin-bottom: 8px; }
.pcx-err { color: var(--text-error); font-size: .85em; margin-bottom: 8px; line-height: 1.45; }
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

return { Infobox, Styles, TIER_COLOR, STATUS_COLOR, splitTitle, bibtex, yearsAgo };
