// ════════════════════════════════════════════════════════════════════════════
//  preview.jsx  —  one book, taken down off the shelf
//  Location: Meta/Obsidian/_datacore/book/preview.jsx
//
//  What a click on a book opens in <Shelves> (shelf.jsx). It is the paper
//  views' preview (ReadingPanel in paper/core.jsx) for books: two slabs over
//  the shelf, closed the same three ways (a click beside them, a right-click,
//  Escape), with the wheel driving the right-hand column from anywhere over it.
//
//    LEFT    the cover, the hardcover board the infobox draws, as tall as the
//            slabs. Click it to open the book's note.
//    RIGHT   publisher, date and tier on one line; title, subtitle, authors —
//            click the title or subtitle to open the PDF at your page;
//            status, edition and category; your progress as the infobox's own
//            fore-edge (hover to aim, click to set your page); the series and
//            the links; the blurb; the tags, less #book and whatever the
//            shelf collected on, which every book here carries.
//
//  Ctrl/Cmd-click either for a new tab.
//
//  It dresses in the shelf's design: parchment and rubric under "medieval",
//  lacquer and brass under "art deco".
//
//    {open && <BookPreview path={open} hide={["book"]} onClose={close} />}
//
//  The shelf scrolls with its note, so the preview cannot simply cover the
//  case: it measures the pane the note scrolls in and sits exactly over what
//  is on screen, following the pane as it scrolls or resizes (usePaneBox).
//
//  NOTE: never declare a local named `h` in this file — it is the JSX pragma.
// ════════════════════════════════════════════════════════════════════════════

const core = await dc.require("Meta/Obsidian/_datacore/book/core.jsx");
const infobox = await dc.require("Meta/Obsidian/_datacore/book/infobox.jsx");

const {
  PanelCover, useBook, useCoverRatio, openBook, openNote, parseLink, baseName, fmtDate, tint, clamp,
  STATUS_COLOR, SCROLLERS, useEscape, useWheelInto,
} = core;
const { ForeEdge, LinkOut, linksOf, valOf, joinedOf } = infobox;

// ── code-level constants (not user tweaks) ──────────────────────────────────
/* The slabs take this much of the pane each way, as the paper preview's do. */
const FILL = 0.9;
/* Between the cover and the column, in px; .hcp-panel's gap. */
const GAP = 34;
/* The column is never narrower than this: the cover gives way first. */
const COLUMN_MIN = 300;
/* The fore-edge's ticks. The infobox draws 34 across ~235px; the column is
   about twice that, so twice the ticks keep the page block's grain. */
const EDGE_TICKS = 60;
/* Tags that say what kind of note this is, not what the book is about. */
const KIND_TAGS = ["book", "books"];

// ════════════════════════════════════════════════════════════════════════════
//  Where it sits
// ════════════════════════════════════════════════════════════════════════════
/**
 * The pane the shelf scrolls in, as a box relative to an anchor inside the
 * shelf: where an overlay has to sit to cover exactly what is on screen.
 * Measured, not position: fixed, which a transformed or contained ancestor
 * would quietly re-anchor. Re-measured on scroll and on resize, a frame at a
 * time. With no pane to be found, it falls back to the window.
 */
function usePaneBox() {
  const ref = dc.useRef(null);
  const [box, setBox] = dc.useState(null);

  dc.useEffect(() => {
    const anchor = ref.current;
    const pane = anchor?.closest?.(SCROLLERS);
    if (!anchor || !pane) {
      setBox({ fixed: true, top: 0, left: 0, width: window.innerWidth, height: window.innerHeight });
      return;
    }

    let raf = 0;
    const place = () => {
      raf = 0;
      const p = pane.getBoundingClientRect(), a = anchor.getBoundingClientRect();
      const next = {
        fixed: false,
        top: Math.round(p.top - a.top), left: Math.round(p.left - a.left),
        width: pane.clientWidth, height: pane.clientHeight,
      };
      setBox((prev) =>
        prev && !prev.fixed && prev.top === next.top && prev.left === next.left &&
          prev.width === next.width && prev.height === next.height ? prev : next);
    };
    const soon = () => { if (!raf) raf = requestAnimationFrame(place); };

    place();
    pane.addEventListener("scroll", soon, { passive: true });
    const ro = new ResizeObserver(soon);
    ro.observe(pane);
    return () => {
      pane.removeEventListener("scroll", soon);
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return [ref, box];
}

// ════════════════════════════════════════════════════════════════════════════
//  What it says
// ════════════════════════════════════════════════════════════════════════════
/** A value as plain text: a wikilink by its alias or its file's name. */
const plain = (v) => {
  if (v == null || v === "") return null;
  const l = parseLink(v);
  return l ? l.display ?? baseName(l.path) : String(v);
};

/**
 * The note's tags, from the frontmatter and the body alike, minus the ones
 * that only say "this is a book" and the ones in `hide`.
 */
function tagsOf(path, fm, hide) {
  const cache = app.metadataCache.getCache(path) ?? {};
  const skip = new Set(
    KIND_TAGS.concat([].concat(hide ?? []))
      .map((t) => String(t).trim().replace(/^#/, "").toLowerCase())
  );
  return Array.from(new Set(
    [
      ...(cache.tags ?? []).map((t) => t?.tag),
      ...[].concat(fm?.tags ?? fm?.tag ?? []),
    ]
      .map((t) => String(t ?? "").replace(/^#/, "").trim())
      .filter(Boolean)
  )).filter((t) => !skip.has(t.toLowerCase()));
}

/** A tag, in Obsidian's search pane. Quietly nothing if search is turned off. */
const searchTag = (t) => (e) => {
  e.preventDefault();
  e.stopPropagation();
  app.internalPlugins?.getPluginById?.("global-search")?.instance?.openGlobalSearch?.(`tag:#${t}`);
};

// ════════════════════════════════════════════════════════════════════════════
//  <BookPreview />
// ════════════════════════════════════════════════════════════════════════════
/* Guard and body are two components: the body calls hooks, so returning early
   in it when `path` goes null would change the hook count and crash. */
function BookPreview(props) {
  if (!props.path) return null;
  return <PreviewBody {...props} />;
}

function PreviewBody({ path, hide = [], onClose }) {
  const book = useBook(path);
  const ratio = useCoverRatio(book);
  const [anchorRef, pane] = usePaneBox();
  const [columnRef, onWheel] = useWheelInto({ hold: true });
  useEscape(() => onClose?.());

  /* Right-click shuts it, as it shuts the paper preview and a drawer. */
  const shut = (e) => { e.preventDefault(); e.stopPropagation(); onClose?.(); };

  /**
   * The cover's width: as tall as the slabs, unless that would leave the
   * column narrower than COLUMN_MIN; then it gives way and centres. Rasterised
   * (a PDF's first page, when there is no artwork) at twice that, in steps,
   * so a resize does not re-render the page at every pixel.
   */
  const faceW = pane
    ? Math.round(clamp(120,
      Math.min((pane.height * FILL) / ratio, pane.width * FILL - GAP - COLUMN_MIN, pane.width * FILL * 0.62),
      2000))
    : 0;
  const raster = Math.ceil((faceW * 2) / 240) * 240;

  const get = book.get;
  const imprint = [plain(get("publisher")), fmtDate(get("published"))].filter(Boolean).join(" · ");
  const subtitle = plain(get("subtitle"));
  const authors = joinedOf(get("author") ?? get("authors"), path);
  const edition = plain(get("edition"));
  const category = plain(get("category"));
  const series = valOf(get("series"), path);
  const blurb = plain(get("blurb"));
  const links = linksOf(get);
  const tags = tagsOf(path, book.fm, hide);
  const statusTint = STATUS_COLOR[book.status];

  /* The title opens the PDF at your page, when there is a PDF: book.pdf may
     be the cover image instead (see useBook). */
  const hasPdf = book.pdf?.extension === "pdf";
  const openPdf = (e) => openBook(book, e);

  return (
    <div class="hcp-anchor" ref={anchorRef}>
      {pane && (
        <div
          class={"hcp-veil" + (pane.fixed ? " is-fixed" : "")}
          style={pane.fixed ? null : {
            top: `${pane.top}px`, left: `${pane.left}px`,
            width: `${pane.width}px`, height: `${pane.height}px`,
          }}
          onClick={() => onClose?.()}
          onContextMenu={shut}
          onWheel={onWheel}
        >
          <div class="hcp-panel" onClick={(e) => e.stopPropagation()}>
            {/* LEFT — the board; a click opens the note. */}
            <div class="hcp-face" style={{ width: `${faceW}px` }} title="Open the note">
              <PanelCover
                book={book}
                width={raster}
                label="Open the note"
                onClick={(e) => openNote(book, e)}
              />
            </div>

            <div class="hcp-column" ref={columnRef}>
              {(imprint || book.tier) && (
                <div class="hcp-eyebrow">
                  <i class="hcp-lozenge" />
                  {imprint && <span class="hcp-imprint">{imprint}</span>}
                  <i class="hcp-rule" />
                  {book.tier && <span class="hcp-tier">{book.tier}</span>}
                </div>
              )}

              {/* divs, not h2 / p: the note's heading and paragraph styles
                  would otherwise outrank these */}
              <div class="hcp-heading">
                {/* title and subtitle together are the way into the note */}
                <div
                  class="hcp-open is-openable"
                  role="button"
                  tabIndex={0}
                  title="Open the note"
                  onClick={(e) => openNote(book, e)}
                  onAuxClick={(e) => { if (e.button === 1) openNote(book, e); }}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openNote(book, e)}
                >
                  <div class="hcp-title" role="heading" aria-level="2">{book.name}</div>
                  {subtitle && <div class="hcp-sub">{subtitle}</div>}
                </div>
                {authors && <div class="hcp-authors">{authors}</div>}
              </div>

              {(book.status || edition || category) && (
                <div class="hcp-pills">
                  {book.status && (
                    <span
                      class={"hcp-pill" + (statusTint ? " is-tinted" : "")}
                      style={statusTint ? tint(statusTint) : null}
                    >{book.status}</span>
                  )}
                  {edition && <span class="hcp-pill">{edition} ed.</span>}
                  {category && <span class="hcp-pill">{category}</span>}
                </div>
              )}

              {book.pages > 0 && (
                <div class="hcp-block">
                  <span class="hcp-caps">Progress</span>
                  <ForeEdge book={book} ticks={EDGE_TICKS} />
                </div>
              )}

              {(series || links.length > 0) && (
                <div class="hcp-block">
                  {series && (
                    <div class="hcp-field">
                      <span class="hcp-caps">Series</span>
                      <span class="hcp-field-v">{series}</span>
                    </div>
                  )}
                  {links.length > 0 && (
                    <div class="hcp-links">
                      {links.map(([label, target]) => (
                        <LinkOut key={label} label={label} target={target} sourcePath={path} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {blurb && (
                <div class="hcp-block">
                  <span class="hcp-caps">Blurb</span>
                  <div class="hcp-blurb">{blurb}</div>
                </div>
              )}

              {tags.length > 0 && (
                <div class="hcp-tags">
                  {tags.map((t) => (
                    <a key={t} href="#" class="hcp-tag" title={`search #${t}`} onClick={searchTag(t)}>{t}</a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  <PreviewStyles /> — the preview's own sheet. The cover's board and the
//  fore-edge are core.jsx's; this sets the slabs and re-inks the fore-edge.
// ════════════════════════════════════════════════════════════════════════════
const STYLE_ID = "book-preview-datacore-styles";

const CSS = `
/* ── where it sits ────────────────────────────────────────────────────── */
/* A point in the shelf for the veil to measure from, above everything the
   case stacks (the corners top out at 14). */
.hcp-anchor { position: relative; z-index: 40; height: 0; }
.hcp-veil {
  position: absolute; box-sizing: border-box;
  display: flex; align-items: center; justify-content: center;
  background: rgba(16,11,7,.62);
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  font-family: var(--font-interface);
  animation: hcpFade .2s ease both;
}
.hcp-veil.is-fixed { position: fixed; inset: 0; }
.hcs.deco .hcp-veil { background: rgba(6,7,9,.72); }

/* 90% of the pane both ways, as two slabs with the shelf showing between. */
.hcp-panel {
  display: flex; align-items: center; justify-content: center; gap: ${GAP}px;
  width: ${FILL * 100}%; height: ${FILL * 100}%;
}

/* LEFT — the cover is the infobox's board (PanelCover), sized by the width
   the preview works out, its height the artwork's own. */
.hcp-face { flex: none; animation: hcpRise .32s cubic-bezier(.2,.8,.3,1) both; }
.hcp-face .hc-cover { width: 100%; }

/* RIGHT — the column */
.hcp-column {
  position: relative; flex: 1 1 380px; min-width: ${COLUMN_MIN}px; max-width: 620px; height: 100%;
  box-sizing: border-box; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain;
  padding: 30px 28px 34px; display: flex; flex-direction: column; gap: 18px;
  color: var(--hcp-ink);
  animation: hcpRise .32s .04s cubic-bezier(.2,.8,.3,1) both;
}
.hcp-column::-webkit-scrollbar { width: 8px; }
.hcp-column::-webkit-scrollbar-thumb { background: var(--hcp-rule); border-radius: 4px; }
.hcp-column::-webkit-scrollbar-track { background: transparent; }

/* medieval: parchment, iron-gall ink, the rubric's red for the small capitals */
.hcs.medieval .hcp-column {
  --hcp-ink: #22170d; --hcp-soft: rgba(42,29,16,.68); --hcp-faint: rgba(42,29,16,.5);
  --hcp-accent: #8d2f26; --hcp-rule: rgba(42,29,16,.16);
  border-radius: 3px;
  background: linear-gradient(178deg,#efe2c2,#e0cca2);
  box-shadow: inset 0 0 0 1px rgba(90,58,32,.24), 0 24px 54px rgba(0,0,0,.6);
  font-family: 'EB Garamond', Georgia, 'Times New Roman', serif;
}
/* art deco: black lacquer, brass, and a hairline set in from the edge */
.hcs.deco .hcp-column {
  --hcp-ink: #f0e9d8; --hcp-soft: rgba(240,233,216,.66); --hcp-faint: rgba(240,233,216,.44);
  --hcp-accent: #e3c24a; --hcp-rule: rgba(227,194,74,.2);
  border-radius: 0;
  background:
    radial-gradient(120% 60% at 50% 0, rgba(227,194,74,.07), rgba(227,194,74,0) 60%),
    linear-gradient(178deg,#1d2025,#121418);
  border: 1px solid rgba(227,194,74,.42);
  outline: 1px solid rgba(227,194,74,.16); outline-offset: -7px;
  box-shadow: 0 26px 56px rgba(0,0,0,.7);
}

/* ── the line over the title: imprint, then tier ──────────────────────── */
.hcp-eyebrow {
  display: flex; align-items: center; gap: 11px;
  font-family: var(--font-interface); font-size: 10px; font-weight: 600;
  letter-spacing: .17em; text-transform: uppercase; color: var(--hcp-accent);
}
.hcp-imprint { flex: 0 1 auto; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hcp-tier { flex: none; }
.hcp-rule { flex: 1; min-width: 12px; height: 1px; background: var(--hcp-rule); }
.hcs.deco .hcp-rule { background: linear-gradient(90deg,rgba(227,194,74,.6),rgba(227,194,74,.12)); }
.hcp-lozenge {
  flex: none; display: none; width: 9px; height: 9px; background: var(--hcp-accent);
  clip-path: polygon(50% 0,100% 50%,50% 100%,0 50%);
}
.hcs.deco .hcp-lozenge { display: block; }

/* ── title, subtitle, authors ─────────────────────────────────────────── */
.hcp-heading, .hcp-open { display: flex; flex-direction: column; gap: 6px; }
/* title and subtitle, when they open the PDF: they take the accent on hover */
.hcp-open.is-openable { cursor: pointer; }
.hcp-open.is-openable .hcp-title, .hcp-open.is-openable .hcp-sub { transition: color .14s ease-out; }
.hcp-open.is-openable:hover .hcp-title, .hcp-open.is-openable:hover .hcp-sub { color: var(--hcp-accent); }
.hcp-open.is-openable:focus-visible { outline: 1px solid var(--hcp-accent); outline-offset: 4px; }
.hcp-title {
  margin: 0; font-size: 29px; line-height: 1.2; font-weight: 500; text-wrap: pretty;
  color: var(--hcp-ink);
}
.hcs.deco .hcp-title {
  font-family: var(--font-interface); font-size: 23px; line-height: 1.3;
  text-transform: uppercase; letter-spacing: .08em;
}
.hcp-sub { font-size: 17px; line-height: 1.4; font-style: italic; color: var(--hcp-soft); }
.hcs.deco .hcp-sub { font-size: 14px; font-style: normal; letter-spacing: .03em; }
.hcp-authors { margin-top: 2px; font-size: 14.5px; line-height: 1.5; color: var(--hcp-soft); }
.hcs.deco .hcp-authors { font-size: 13px; }

/* ── status, edition, category ────────────────────────────────────────── */
.hcp-pills { display: flex; flex-wrap: wrap; gap: 6px; }
.hcp-pill {
  padding: 2px 9px; border-radius: 3px; white-space: nowrap; line-height: 1.6;
  font-family: var(--font-interface); font-size: 11.5px; font-weight: 600; letter-spacing: .02em;
}
.hcs.medieval .hcp-pill:not(.is-tinted) {
  background: rgba(42,29,16,.07); color: rgba(42,29,16,.74);
  box-shadow: inset 0 0 0 1px rgba(42,29,16,.16);
}
.hcs.deco .hcp-pill {
  border-radius: 0; font-size: 10px; letter-spacing: .14em; text-transform: uppercase;
}
.hcs.deco .hcp-pill:not(.is-tinted) {
  color: var(--hcp-accent); box-shadow: inset 0 0 0 1px rgba(227,194,74,.42);
}

/* ── the blocks below, each under a rule ──────────────────────────────── */
.hcp-block {
  display: flex; flex-direction: column; gap: 10px;
  padding-top: 15px; border-top: 1px solid var(--hcp-rule);
}
.hcp-caps {
  font-family: var(--font-interface); font-size: 9.5px; font-weight: 600;
  letter-spacing: .16em; text-transform: uppercase; color: var(--hcp-faint);
}
.hcs.deco .hcp-caps { color: rgba(227,194,74,.72); }

/* the infobox's fore-edge (ForeEdge), across the column, in the design's inks */
.hcp-column .hcx-edge { width: 100%; margin: 2px 0 0; }
.hcs.medieval .hcp-column .hcx-edge {
  --hcx-track: rgba(42,29,16,.15); --hcx-ink: #9a7526;
  --hcx-label: rgba(42,29,16,.52); --hcx-figure: #22170d; --hcx-auto-ink: #4d7a36;
}
.hcs.deco .hcp-column .hcx-edge {
  --hcx-track: rgba(227,194,74,.15); --hcx-ink: #e3c24a;
  --hcx-label: rgba(240,233,216,.46); --hcx-figure: #f0e9d8; --hcx-auto-ink: #8fcf86;
}
.hcp-column .hcx-plabel { font-family: var(--font-interface); font-size: 11.5px; }

.hcp-field { display: grid; grid-template-columns: 5.4em 1fr; gap: 10px; align-items: baseline; }
.hcp-field-v { font-size: 14.5px; line-height: 1.5; color: var(--hcp-ink); }
.hcs.deco .hcp-field-v { font-size: 13.5px; }
.hcp-field-v a, .hcp-authors a {
  color: inherit !important; text-decoration: none !important;
  border-bottom: 1px solid var(--hcp-rule); transition: color .12s ease-out, border-color .12s ease-out;
}
.hcp-field-v a:hover, .hcp-authors a:hover {
  color: var(--hcp-accent) !important; border-bottom-color: currentColor;
}

.hcp-links { display: flex; flex-wrap: wrap; gap: 8px; }
.hcp-links a {
  padding: 4px 11px; border-radius: 3px;
  font-family: var(--font-interface); font-size: 11px; font-weight: 600; letter-spacing: .05em;
  color: var(--hcp-accent) !important; text-decoration: none !important;
  box-shadow: inset 0 0 0 1px var(--hcp-rule);
  transition: background .14s ease-out, box-shadow .14s ease-out;
}
.hcs.medieval .hcp-links a:hover { background: rgba(141,47,38,.08); box-shadow: inset 0 0 0 1px rgba(141,47,38,.42); }
.hcs.deco .hcp-links a { border-radius: 0; text-transform: uppercase; letter-spacing: .14em; font-size: 10px; }
.hcs.deco .hcp-links a:hover { background: rgba(227,194,74,.12); box-shadow: inset 0 0 0 1px rgba(227,194,74,.55); }

.hcp-blurb { font-size: 16px; line-height: 1.7; text-wrap: pretty; color: var(--hcp-ink); }
.hcs.deco .hcp-blurb { font-size: 14px; line-height: 1.72; color: rgba(240,233,216,.86); }

.hcp-tags {
  display: flex; flex-wrap: wrap; gap: 6px;
  padding-top: 15px; border-top: 1px solid var(--hcp-rule);
}
.hcp-tag {
  padding: 2px 7px; border-radius: 3px; cursor: pointer;
  font-family: var(--font-monospace); font-size: 11px; line-height: 1.6;
  color: var(--hcp-soft) !important; text-decoration: none !important;
  box-shadow: inset 0 0 0 1px var(--hcp-rule); transition: color .12s ease-out;
}
.hcp-tag::before { content: "#"; opacity: .45; }
.hcp-tag:hover { color: var(--hcp-accent) !important; }
.hcs.deco .hcp-tag { border-radius: 0; }

@keyframes hcpFade { from { opacity: 0 } to { opacity: 1 } }
@keyframes hcpRise { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
.hcs.no-motion .hcp-veil, .hcs.no-motion .hcp-face, .hcs.no-motion .hcp-column { animation: none; }
`;

function PreviewStyles() {
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

return { BookPreview, PreviewStyles, usePaneBox, tagsOf, EDGE_TICKS };
