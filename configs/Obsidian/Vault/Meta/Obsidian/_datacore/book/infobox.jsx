// ════════════════════════════════════════════════════════════════════════════
//  infobox.jsx  —  the book infobox
//  Location: Meta/Obsidian/_datacore/book/infobox.jsx
//
//  Usage, in any book note. Passing `path` is what makes this reliable:
//  `dc.useCurrentPath()` resolves correctly inside the code block, but not
//  inside this module.
//
//    ```datacorejsx
//    const { Infobox } = await dc.require("Meta/Obsidian/_datacore/book/infobox.jsx");
//    return function View() { return <Infobox path={dc.useCurrentPath()} />; };
//    ```
//
//  Options
//    autoProgress  true   advance `progress` from the furthest PDF annotation,
//                         and keep `underlines` current in frontmatter. The
//                         underline count is written but never shown here —
//                         the fore-edge is about how far you got.
//    heatmap       true   shade the fore-edge by annotation density
//    ticks         34     fore-edge resolution
// ════════════════════════════════════════════════════════════════════════════

const core = await dc.require("Meta/Obsidian/_datacore/book/core.jsx");
const {
  Styles, FlatCover, NoteLink, useBook, useNotePath, useAnnotations,
  writeProgress, writeFields, useSiteHash, parseLink, fmtDate, tint,
  TIER_COLOR, STATUS_COLOR,
} = core;

function Infobox({ path, ticks = 34, autoProgress = true, heatmap = true, field = "progress" }) {
  const notePath = useNotePath(path);
  const book = useBook(notePath);

  const [copied, setCopied] = dc.useState(false);
  const [hoverPage, setHoverPage] = dc.useState(null);
  const [saving, setSaving] = dc.useState(false);

  const ann = useAnnotations(book, { enabled: autoProgress, heatmap, buckets: ticks, field });
  const autoWon = ann.last != null && ann.last >= book.progress && !book.markedDone;

  const heat = dc.useMemo(() => {
    if (!ann.heat) return null;
    const max = Math.max(...ann.heat);
    return max > 0 ? ann.heat.map((v) => v / max) : null;
  }, [ann.heat]);

  // ── fore-edge interaction ──────────────────────────────────────────────
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

  const shown = hoverPage ?? book.progress;
  const shownPct = book.pages ? (shown / book.pages) * 100 : 0;
  const readTicks = Math.round((book.progress / (book.pages || 1)) * ticks);
  const cursorTicks = Math.round((shownPct / 100) * ticks);

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
    } catch {}
  };

  const val = (v) =>
    v == null || v === "" ? null
      : parseLink(v) ? <NoteLink link={v} sourcePath={notePath} />
      : String(v);

  /**
   * Render a frontmatter list as "a · b · c", dropping the blanks.
   *
   * A YAML list written out but not yet filled in comes through as [""];
   * without the filter that renders a lone separator.
   */
  const joined = (items, sep = " · ") => {
    const parts = [].concat(items ?? []).map(val).filter(Boolean);
    return parts.length ? parts.flatMap((el, i) => (i ? [sep, el] : [el])) : null;
  };

  const Row = ({ label, children }) =>
    children == null || children === "" ? null : (
      <div class="hcx-row">
        <span class="hcx-key">{label}</span>
        <span class="hcx-val">{children}</span>
      </div>
    );

  const links = [["Website", get("site")], ["Source code", get("code")]].filter(([, u]) => !!u);

  // ── rolling releases ─────────────────────────────────────────────────────
  // A book that is really a living document — a draft posted as a PDF, a text
  // that gets a new printing every term — has no edition number to watch, so
  // what gets watched is the page it lives on. With `rolling-release: true`,
  // a fingerprint of the open-access `site` is compared against the one stored
  // in `hash`.
  //
  //   no `hash` yet  →  quietly record what the page looks like today
  //   hash matches   →  nothing to say
  //   hash differs   →  a red word beside the links
  //
  // `hash` is exactly ten characters of base-36 and never grows: it is a
  // fingerprint you have to live with in frontmatter, not a checksum anyone
  // verifies. See shortHash in pdf.jsx.
  //
  // The whole thing is off the render path — one request, fired on a timer
  // after paint, and the render never waits on it. And a warning is ALL it is:
  // clicking is you saying "I have taken the new copy", so the notice goes and
  // the stored hash moves to today's. Nothing is ever downloaded. The book is a
  // file you keep, not a feed.
  const rolling = get("rolling-release") === true;
  const siteUrl = get("site");
  const { now: siteNow, changed: siteChanged, firstRun } =
    useSiteHash(siteUrl, get("hash"), rolling && !!siteUrl);

  dc.useEffect(() => {
    if (firstRun && siteNow && book.path) writeFields(book.path, { hash: siteNow }).catch(() => {});
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
        {/* FlatCover is BookCover with effects="plain": the drop shadow the
            book casts, and NOTHING painted over the artwork — no spine
            gradient, no corner sheen, no tint, no filter. Those belong to a
            book standing on a shelf under a lamp; here they were only ever
            softening the one place the cover is meant to be read.
            540 is the raster width, twice the 270 it is drawn at, so a HiDPI
            screen has real pixels to show rather than an upscale. */}
        <FlatCover book={book} width={540} />

        {book.pages > 0 && (
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
                // NB: never name a local `h` in this file — it is the JSX
                // pragma, and shadowing it breaks every tag in scope.
                const dens = heat?.[i] ?? 0;
                // density drives height and opacity inside the read region, so
                // the fore-edge thickens where you actually left ink
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
        )}

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
              {links.map(([label, url]) => (
                <a key={label} href={url} target="_blank" rel="noopener">{label}</a>
              ))}
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

return { Infobox };
