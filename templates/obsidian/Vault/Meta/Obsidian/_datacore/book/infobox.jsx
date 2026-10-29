// ════════════════════════════════════════════════════════════════════════════
//  infobox.jsx  —  the book infobox
//  Location: Meta/Obsidian/_datacore/book/infobox.jsx
//
//  Usage, in any book note. Pass `path`: `dc.useCurrentPath()` resolves inside
//  the code block, not inside this module.
//
//    ```datacorejsx
//    const { Infobox } = await dc.require("Meta/Obsidian/_datacore/book/infobox.jsx");
//    return function View() { return <Infobox path={dc.useCurrentPath()} />; };
//    ```
//
//  Options
//    autoProgress  true   advance `progress` from the furthest PDF annotation,
//                         and keep `underlines` current in frontmatter (written,
//                         never shown here)
//    heatmap       true   shade the fore-edge by annotation density
//    ticks         34     fore-edge resolution
//
//  Links, in this order, each only when set:
//    site · code · solution · errata
//  Any of them may be a URL or a PDF in the vault ("[[Solutions.pdf]]").
//
//  The fore-edge (ForeEdge), the links (linksOf, LinkOut) and the value
//  helpers (valOf, joinedOf) are exported: the book preview the shelf opens
//  (book/preview.jsx) is built from them, so the two always agree.
// ════════════════════════════════════════════════════════════════════════════

const core = await dc.require("Meta/Obsidian/_datacore/book/core.jsx");
const {
  Styles, PanelCover, NoteLink, useBook, useNotePath, useAnnotations,
  writeProgress, writeFields, useSiteHash, parseLink, fmtDate, tint,
  TIER_COLOR, STATUS_COLOR,
} = core;

/**
 * Where a link property points: { href } for the web, { internal } for the
 * vault. A wikilink or bare path opens inside Obsidian, so a PDF lands in its
 * viewer; anything with a scheme goes to the browser.
 */
function linkTarget(v) {
  if (v == null || v === "") return null;
  const l = parseLink(v);
  if (l) return { internal: l.path + (l.subpath ? `#${l.subpath}` : "") };
  const s = String(v).trim();
  const md = s.match(/^\[[^\]]*\]\(([^)\s]+)\)$/);
  if (md) return /^[a-z][a-z0-9+.-]*:/i.test(md[1]) ? { href: md[1] } : { internal: md[1].replace(/%20/g, " ") };
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return { href: s };
  if (/^www\./i.test(s)) return { href: `https://${s}` };
  return s ? { internal: s } : null;
}

/** The links a book note carries, in order, each only when set: [label, target]. */
const linksOf = (get) =>
  [
    ["Website", get("site")],
    ["Source code", get("code")],
    ["Solutions", get("solutions")],
    ["Errata", get("errata")],
  ].map(([label, v]) => [label, linkTarget(v)]).filter(([, t]) => !!t);

/** One of them: the browser for a URL, Obsidian for the vault (Ctrl/Cmd for a new tab). */
function LinkOut({ label, target, sourcePath }) {
  return target.href
    ? <a href={target.href} target="_blank" rel="noopener">{label}</a>
    : (
      <a
        href="#"
        title={target.internal}
        onClick={(e) => {
          e.preventDefault();
          app.workspace.openLinkText(target.internal, sourcePath ?? "", e.ctrlKey || e.metaKey);
        }}
      >{label}</a>
    );
}

/** A frontmatter value to show: a wikilink as a link, a blank as nothing. */
const valOf = (v, sourcePath) =>
  v == null || v === "" ? null
    : parseLink(v) ? <NoteLink link={v} sourcePath={sourcePath} />
      : String(v);

/** A frontmatter list as "a · b · c", dropping blanks: an unfilled YAML list comes through as [""]. */
function joinedOf(items, sourcePath, sep = " · ") {
  const parts = [].concat(items ?? []).map((v) => valOf(v, sourcePath)).filter(Boolean);
  return parts.length ? parts.flatMap((el, i) => (i ? [sep, el] : [el])) : null;
}

function Row({ label, children }) {
  return children == null || children === "" ? null : (
    <div class="hcx-row">
      <span class="hcx-key">{label}</span>
      <span class="hcx-val">{children}</span>
    </div>
  );
}

// ── the fore-edge ─────────────────────────────────────────────────────────────
/**
 * Reading progress as the book's page block seen edge-on: one tick per slice
 * of the book, read ticks inked, and — with `heatmap` — thickened where you
 * left marks in the PDF. Hover to aim, click to set your page.
 *
 * It also keeps `progress` current from the PDF's annotations (`autoProgress`,
 * see useAnnotations in core.jsx): the label turns green when the furthest
 * mark is what put it there.
 *
 * The infobox's, and the book preview's (book/preview.jsx), which passes more
 * ticks for its wider column. Inks are the --hcx-* variables on .hcx-edge.
 * Nothing without a page count.
 */
function ForeEdge({ book, ticks = 34, autoProgress = true, heatmap = true, field = "progress" }) {
  const [hoverPage, setHoverPage] = dc.useState(null);
  const [saving, setSaving] = dc.useState(false);

  const ann = useAnnotations(book, { enabled: autoProgress, heatmap, buckets: ticks, field });
  const autoWon = ann.last != null && ann.last >= book.progress && !book.markedDone;

  const heat = dc.useMemo(() => {
    if (!ann.heat) return null;
    const max = Math.max(...ann.heat);
    return max > 0 ? ann.heat.map((v) => v / max) : null;
  }, [ann.heat]);

  const pageFromEvent = (e) => {
    if (!book.pages) return null;
    const r = e.currentTarget.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    return Math.max(1, Math.round(f * book.pages));
  };

  const commit = async (e) => {
    const p = pageFromEvent(e);
    if (p == null || saving || !book.path) return;
    setSaving(true);
    await writeProgress(book.path, p, field);
    setSaving(false);
  };

  // after every hook: useAnnotations writes back whether or not there is a page count
  if (!(book.pages > 0)) return null;

  const shown = hoverPage ?? book.progress;
  const shownPct = (shown / book.pages) * 100;
  const readTicks = Math.round((book.progress / book.pages) * ticks);
  const cursorTicks = Math.round((shownPct / 100) * ticks);

  return (
    <div
      class="hcx-edge"
      title="Click to set your page"
      onMouseMove={(e) => setHoverPage(pageFromEvent(e))}
      onMouseLeave={() => setHoverPage(null)}
      onClick={commit}
    >
      <div class="hcx-ticks">
        {Array.from({ length: ticks }).map((_, i) => {
          const read = i < readTicks;
          const cursor = hoverPage != null && !read && i < cursorTicks;
          // NB: never name a local `h` here — it is the JSX pragma
          const dens = heat?.[i] ?? 0;
          // the read region thickens where you left ink
          const style = read
            ? { height: `${8 + 6 * (dens || 0.34)}px`, opacity: 0.55 + 0.45 * (dens || 0.55) }
            : dens > 0
              ? { height: `${6 + 5 * dens}px`, opacity: 0.3 + 0.4 * dens }
              : null;
          return (
            <div
              key={i}
              class={
                "hcx-tick" +
                (read ? " is-read" : "") +
                (cursor ? " is-cursor" : "") +
                (!read && dens > 0 ? " has-heat" : "")
              }
              style={style}
            />
          );
        })}
      </div>
      <div class="hcx-plabel">
        <span>
          {hoverPage != null
            ? <span class="hcx-ghost">set to page {hoverPage}</span>
            : <><b>{book.progress}</b> of {book.pages}</>}
        </span>
        <span class={autoWon && hoverPage == null ? "hcx-auto" : ""}>
          {hoverPage != null
            ? `${((hoverPage / book.pages) * 100).toFixed(0)}%`
            : `${book.pct.toFixed(0)}%`}
        </span>
      </div>
    </div>
  );
}

// ── the infobox ───────────────────────────────────────────────────────────────
function Infobox({ path, ticks = 34, autoProgress = true, heatmap = true, field = "progress" }) {
  const notePath = useNotePath(path);
  const book = useBook(notePath);

  const [copied, setCopied] = dc.useState(false);

  // ── frontmatter bits ───────────────────────────────────────────────────
  const get = book.get;
  const authors = [].concat(get("author") ?? []);
  const isbn = get("isbn");

  const copyIsbn = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(String(isbn));
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch { }
  };

  const val = (v) => valOf(v, notePath);
  const joined = (items, sep) => joinedOf(items, notePath, sep);

  const links = linksOf(get);

  // ── rolling releases ─────────────────────────────────────────────────────
  // A living document (a draft posted as a PDF, a text reprinted every term)
  // has no edition to watch, so with `rolling-release: true` a fingerprint of
  // the open-access `site` is compared against the one stored in `hash`:
  //
  //   no `hash` yet  →  quietly record what the page looks like today
  //   hash matches   →  nothing to say
  //   hash differs   →  a red word beside the links
  //
  // `hash` is ten base-36 characters (shortHash in pdf.jsx). The check is one
  // request on a timer after paint. Clicking the warning accepts the new copy:
  // the notice goes and `hash` moves to today's. Nothing is downloaded.
  const rolling = get("rolling-release") === true;
  const siteUrl = get("site");
  const { now: siteNow, changed: siteChanged, firstRun } =
    useSiteHash(siteUrl, get("hash"), rolling && !!siteUrl);

  dc.useEffect(() => {
    if (firstRun && siteNow && book.path) writeFields(book.path, { hash: siteNow }).catch(() => { });
  }, [firstRun, siteNow, book.path]);

  const acceptRelease = async (e) => {
    e.preventDefault();
    if (!siteNow || !book.path) return;
    await writeFields(book.path, { hash: siteNow });
  };

  return (
    <>
      <Styles />
      <div class="hcx">
        {/* The shelf's hardcover board (effects="board"), lifting on hover.
            540 is twice the drawn width, for HiDPI and the hover's scale. */}
        <PanelCover book={book} width={540} />

        <ForeEdge book={book} ticks={ticks} autoProgress={autoProgress} heatmap={heatmap} field={field} />

        <div class="hcx-body">
          <h3 class="hcx-title">{val(book.title) ?? book.name}</h3>
          {get("subtitle") && <div class="hcx-sub">{get("subtitle")}</div>}
          {joined(authors) && <div class="hcx-authors">{joined(authors)}</div>}

          <div class="hcx-pills">
            {book.tier && <span class="hcx-pill" style={tint(TIER_COLOR[book.tier])}>{book.tier}</span>}
            {book.status && <span class="hcx-pill" style={tint(STATUS_COLOR[book.status])}>{book.status}</span>}
            {get("edition") && <span class="hcx-pill" style={tint(null)}>{get("edition")} ed.</span>}
            {get("category") && <span class="hcx-pill" style={tint(null)}>{get("category")}</span>}
          </div>

          <Row label="Series">{val(get("series"))}</Row>
          <Row label="Course">{val(get("course"))}</Row>
          <Row label="Publisher">{get("publisher")}</Row>
          <Row label="Published">{fmtDate(get("published"))}</Row>
          <Row label="Released">{fmtDate(get("released"))}</Row>
          <Row label="ISBN">
            {isbn && (
              <span
                class={"hcx-isbn" + (copied ? " copied" : "")}
                onClick={copyIsbn}
                title="Click to copy"
              >
                {copied ? "Copied" : isbn}
              </span>
            )}
          </Row>

          {(links.length > 0 || siteChanged) && (
            <div class="hcx-links">
              {links.map(([label, target]) => <LinkOut key={label} label={label} target={target} sourcePath={notePath} />)}
              {siteChanged && (
                <a
                  href="#"
                  class="hcx-rolling"
                  title="The page has changed since you last took a copy. Click once you have the new one."
                  onClick={acceptRelease}
                >New release</a>
              )}
            </div>
          )}

          {get("blurb") && <div class="hcx-blurb">{get("blurb")}</div>}
        </div>
      </div>
    </>
  );
}

return { Infobox, ForeEdge, LinkOut, linksOf, valOf, joinedOf };
