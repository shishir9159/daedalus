// ════════════════════════════════════════════════════════════════════════════
//  shelf.jsx  —  the library, as a piece of furniture
//
//  Give it a note of its own; it takes over the window.
//
//    ```datacorejsx
//    const { Shelves } = await dc.require("Meta/Obsidian/_datacore/book/shelf.jsx");
//    return function View() { return <Shelves tag="book" shelf="medieval" webs />; };
//    ```
//
//  WHAT TO COLLECT   tag "book" (or a list) · folder null
//  THE FURNITURE     shelf "medieval"|"art deco" · wood "oak"|"walnut"|
//                    "concrete"|"board"|"ebony"|"macassar" · rack · walls ·
//                    banner · sign · subtitle · neon · glass · daylight
//  HOW BOOKS STAND   spines · bookends · flatFinished · collapsed 8 · wrap
//  PROGRESS          "crack"|"spotlight"|"slip"|"ribbon"|"bar"|"none"
//  LIGHT             lamp "rail"|"pointer"|false · dof
//  AGE               webs · wear · dogears · spider "stalest"|"newest"|false
//  OTHER             draggable · motion · full · edgeScroll
//
//  `shelf` is the DESIGN — the whole piece of furniture, from the case down to
//  what a book with no cover looks like. "medieval" is the library this began
//  as; "art deco" is the cinema foyer.
//
//  `wood` is the material, and every material works under either design. Each
//  design simply reaches for a different one when you say nothing: oak for the
//  library, ebony for deco. Deco's board stays brass whatever you pick — that
//  is the signature of it — so the timber shows in the carcass and the sides,
//  which is what veneer-and-brass furniture actually looks like.
//
//  `rack` is the layout. true (the default) is separate boards with air
//  between them. false is one carcass with the compartments stacked straight
//  onto each other, each board the ceiling of the shelf below — a bookcase.
//
//  Signs are independent of all of it: banner="deco sunburst" over
//  shelf="medieval" is a perfectly legal thing to ask for.
//
//  Three things are worth knowing before changing anything:
//
//  Size is not an argument. It comes from the page count, floored at FACE_MIN
//  because below that Obsidian's own downscaling stops resolving the type on
//  the cover. Everything else — shelf height, headroom, gaps, cone width, the
//  spider and its thread — is a fraction of the books, so moving FACE_MIN
//  moves the whole piece of furniture rather than cramming bigger books into
//  the old one. See sizeOf and the metrics memo.
//
//  A full-bleed library is as tall as its pane and scrolls inside itself, both
//  ways. Not a style choice: a note that grows to a few thousand pixels
//  defeats Obsidian's section recycling and the scroll snaps back to the top.
//  useFitHeight in core.jsx has the details.
//
//  lamp="rail" hangs a fixture over every book. progress="spotlight" colours
//  those same lamps by how far you have read; with both on, the lamps sit
//  neutral until you hover. With rail and any other progress pattern, hovering
//  lights one book and the rest fall dark.
//
//  Notes under Meta/Obsidian/Templates/ are never collected (IGNORE_PATHS).
//  Never declare a local named h here — it is the JSX pragma.
// ════════════════════════════════════════════════════════════════════════════

const core = await dc.require("Meta/Obsidian/_datacore/book/core.jsx");
const pat  = await dc.require("Meta/Obsidian/_datacore/book/patterns.jsx");
const bug  = await dc.require("Meta/Obsidian/_datacore/book/critters.jsx");
const sgn  = await dc.require("Meta/Obsidian/_datacore/book/banner.jsx");

const {
  Styles, ShelfCover, useBook, useCoverColor, useCoverSrc, useSpineImage,
  useFitHeight, useEdgeScroll, styleClass, woodFor, tiltFor, hashOf, clamp,
  baseName, openBook, writeFields, markDragEnd, isIgnored,
  READING, UPCOMING, DONE, TIER_RANK,
} = core;
const {
  Progress, Beam, Rail, Tint, Dogear, beamVars, Lamp, lampHandlers,
  useDaylight, Daylight, GlassDoors,
} = pat;
const { CritterStyles, Cobweb, Spider, ShelfWear, EmptyShelf, useNeglect, mtimeOf } = bug;
const { BannerStyles, Banner, NEON_COLORS } = sgn;

const DRAG_MIME = "application/x-obsidian-book";

// ════════════════════════════════════════════════════════════════════════════
//  Dimensions
//
//  270px is a hard floor, not a preference. Obsidian 1.13.7 scales a cover down
//  with a plain bilinear filter, and below about 270px of rendered width the
//  type set on the artwork stops resolving — you get the shape of a title
//  rather than a title.
//
//  The ceiling is deliberately close to it. The page count should say "this is
//  a fatter book", not "this book gets its own screen": a 36px spread over the
//  whole library reads as variety, and the 78px spread it replaces read as
//  three books to a window.
// ════════════════════════════════════════════════════════════════════════════
const FACE_MIN = 270;
const FACE_MAX = 306;
/* A hardcover is a 2:3 board — the same ratio the blank cover placeholder uses,
   so a book with artwork and a book without stand the same height. */
const TALL_RATIO = 1.5;
/* Wider than the book-to-book pitch, on purpose. A row of picture lights DOES
   overlap; at 1.42 each cone was narrower than its own book plus the gap, so
   the shelf read as stripes of light with dark bands between them.
   1.82 is the study's own: 250px of cone over a 141px cover. The pitch here is
   the cover plus 11% of it, so a cone this wide still covers its own book and
   washes a good part of each neighbour — but it no longer flattens the row the
   way 2.05 did, where every point on the board was inside three cones. */
const CONE_RATIO = 1.82;
/* The shade, as a fraction of the cover. Also the study's: a 40px shade over a
   141px cover. Every part of the fixture, and the height the cone starts at,
   is a fraction of this — see --lamp-w in core.jsx. */
const LAMP_RATIO = 0.28;
/* The 300-page book is the reference volume: what an empty case is sized for. */
const REF_TALL = Math.round((FACE_MIN + 12) * TALL_RATIO);

function sizeOf(pages) {
  const pp = clamp(0, pages || 300, 1600);
  const face = clamp(FACE_MIN, Math.round(FACE_MIN + pp / 26), FACE_MAX);
  const tall = Math.round(face * TALL_RATIO);             // 405 .. 459
  return {
    tall, face,
    // a spine keeps its own proportion to the board it belongs to
    spine: clamp(
      Math.round(face * 0.11),
      Math.round(face * 0.085 + pp / 14),
      Math.round(face * 0.24),
    ),
    cone: Math.round(face * CONE_RATIO),                  // 491 .. 557
    // The spider is furniture of the book it hangs beside. At scale 1 it is
    // roughly 68px across, which next to a 270px cover is a tarantula; a
    // little under two thirds of that is an animal you notice rather than one
    // that owns the shelf.
    spiderScale: +clamp(0.42, face / 440, 0.78).toFixed(3),
    // how far below the compartment ceiling it comes to rest, so it ends up
    // over the top corner of the cover whatever the case is scaled to
    drop: Math.round(tall * 0.11),
  };
}

/**
 * Everything a lamp, a spider or a thread needs to hang from the top of the
 * compartment rather than from the top of the book. `--head-h` is set on the
 * case by `metrics`; the slot sits below it, so reaching up into it is a
 * negative offset of exactly that much.
 */
const HANG_TOP = "calc(-1 * var(--head-h) + 8px)";
const hangThread = (drop) => `calc(var(--head-h) + ${drop}px)`;

// ── one book, face out ─────────────────────────────────────────────────────
function FaceBook({
  notePath, pattern, webs, wear, dogears, spider, beamMode,
  draggable, leaning, spine, onTurn, onHush, lean,
}) {
  const book = useBook(notePath);
  const [dragging, setDragging] = dc.useState(false);
  const neglect = useNeglect(notePath, webs || wear);
  const cloth = useCoverColor(book);
  const spineArt = useSpineImage(book, !!spine);
  const open = book.status === "reading" && !book.finished;

  /**
   * What the cursor carries during a drag.
   *
   * Without this the browser snapshots the whole slot — which since the lamps
   * moved into it means the fixture, the cone and the pool travel with the
   * book, and dragging one title drags a shaft of light across the case. The
   * book itself is the payload, so the book itself is the ghost.
   */
  const bodyRef = dc.useRef(null);
  const beginDrag = (e) => {
    e.dataTransfer.setData(DRAG_MIME, book.path);
    e.dataTransfer.setData("text/plain", book.path);
    e.dataTransfer.effectAllowed = "move";
    const node = bodyRef.current;
    if (node) {
      try {
        e.dataTransfer.setDragImage(node, Math.round(node.offsetWidth / 2), 28);
      } catch { /* older Electron: fall back to the default ghost */ }
    }
    setDragging(true);
  };
  const endDrag = () => { setDragging(false); markDragEnd(); };

  const dim = sizeOf(book.pages);
  const style = {
    "--book-w": `${dim.face}px`,
    "--tilt": leaning ? "5.5deg" : tiltFor(book.path),
    "--sp-w": `${dim.spine}px`,
    "--sp-h": `${dim.tall}px`,
    "--cone-w": `${dim.cone}px`,
    "--h": cloth.h.toFixed(0), "--s": cloth.s.toFixed(0), "--l": cloth.l.toFixed(0),
  };
  if (beamMode) Object.assign(style, beamVars(book, beamMode));

  if (spine) {
    return (
      <div
        class={"hcs-slot is-spine" + (dragging ? " is-dragging" : "") + (lean ? ` lean-${lean}` : "")}
        style={style}
        data-book={notePath}
        title={`${book.name} — click to turn it out`}
        draggable={draggable}
        onDragStart={beginDrag}
        onDragEnd={endDrag}
        onClick={() => { onHush?.(notePath); onTurn?.(notePath); }}
      >
        <div class={"hcs-sp" + (spineArt ? " has-art" : "")} ref={bodyRef}>
          {spineArt ? (
            <img src={spineArt} alt="" draggable={false} decoding="async" />
          ) : (
            <>
              <div class="hcs-sp-cap" />
              <div class="hcs-sp-body"><div class="hcs-sp-title">{book.name}</div></div>
              <div class="hcs-sp-foot">
                <i class="hcs-sp-rule" /><i class="hcs-sp-mark" /><i class="hcs-sp-rule" />
              </div>
            </>
          )}
          {/* The spine's real box, not a multiple of its thickness. Cobweb
              works its own reach out from the two — a web on a 36x430 spine is
              not a web on a 36x36 one, and passing a single pre-multiplied
              number is what left the webs a knot in the corner once the case
              was rescaled. */}
          {webs && neglect > 0 && (
            <Cobweb level={neglect} seed={book.path} width={dim.spine} height={dim.tall} />
          )}
          {open && <div class="hcs-sp-ribbon" />}
        </div>
        {/* Just off the fore-edge: clear of the title, short of the gap, and
            hung from the compartment ceiling like the face-out one. A spine is
            narrow, so the spider is sized against the spine's own thickness. */}
        {spider && (
          <Spider
            style={{ left: "calc(100% + 4px)", top: HANG_TOP }}
            thread={hangThread(Math.round(dim.tall * 0.08))}
            scale={+clamp(0.34, dim.spine / 130, 0.6).toFixed(3)}
          />
        )}
      </div>
    );
  }

  return (
    <div
      class={"hcs-slot" + (dragging ? " is-dragging" : "") + (leaning ? " is-leaning" : "")}
      style={style}
      data-book={notePath}
      title={`${book.name}${book.pages ? ` · page ${book.progress} of ${book.pages}` : ""}${onTurn ? " · right-click to shelve it spine-out" : ""}`}
      draggable={draggable}
      onDragStart={beginDrag}
      onDragEnd={endDrag}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onHush?.(notePath); onTurn?.(notePath); }}
      onClickCapture={() => onHush?.(notePath)}
    >
      {beamMode && <Beam />}
      {wear && <ShelfWear level={neglect} />}
      <div class="hcs-art" ref={bodyRef}>
        {/* ShelfCover is BookCover with effects="lit": the hardcover board, and
            the lamps are allowed to grade the artwork. The infobox uses
            FlatCover, which paints nothing over the image at all. The raster is
            2.2x the display width so the cover still has pixels to spare on a
            HiDPI screen. */}
        <ShelfCover book={book} width={Math.round(dim.face * 2.2)} />
        {beamMode && <Tint />}
        {webs && neglect > 0 && (
          <Cobweb level={neglect} seed={book.path} width={dim.face} height={dim.tall} />
        )}
        {dogears && <Dogear book={book} />}
        {open && <div class="hcs-open-ribbon" />}
        <Progress book={book} pattern={pattern} layer="art" />
      </div>
      {/* Hung from the top of the compartment, not of the book (from there it
          sits on the cover instead of dangling in front of it). Drop and scale
          come out of sizeOf, so the spider keeps its size and reach relative to
          the book however the case is scaled. */}
      {spider && (
        <Spider
          style={{ left: "calc(100% - 12px)", top: HANG_TOP }}
          thread={hangThread(dim.drop)}
          scale={dim.spiderScale}
        />
      )}
      <Progress book={book} pattern={pattern} layer="board" />
    </div>
  );
}

// ── a finished book, lying flat in a pile ─────────────────────────────────
/**
 * A book lying flat shows you its spine, so that is what this draws: a
 * horizontal band of cloth with the title running along it, a gilt rule at the
 * head and the page block at the tail. Draggable like any other book, so a
 * finished title can go back on a working shelf.
 */
function Slab({ notePath, draggable }) {
  const book = useBook(notePath);
  const cloth = useCoverColor(book);
  const [dragging, setDragging] = dc.useState(false);

  const dim = sizeOf(book.pages);
  const thick = clamp(21, Math.round(17 + (book.pages || 300) / 24), 42);

  return (
    <div
      class={"hcs-slab" + (dragging ? " is-dragging" : "")}
      style={{
        "--w": `${dim.face}px`,
        "--thick": `${thick}px`,
        "--jit": (hashOf(book.path) % 9) - 4,
        "--h": cloth.h.toFixed(0), "--s": cloth.s.toFixed(0), "--l": cloth.l.toFixed(0),
      }}
      title={`${book.name}${book.pages ? ` · ${book.pages} pages` : ""} — drag to another shelf`}
      draggable={!!draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_MIME, book.path);
        e.dataTransfer.setData("text/plain", book.path);
        e.dataTransfer.effectAllowed = "move";
        // the slab is clipped and skew-free, so the default ghost can come out
        // empty; naming it explicitly guarantees the book follows the cursor
        try { e.dataTransfer.setDragImage(e.currentTarget, 24, 12); } catch {}
        setDragging(true);
      }}
      onDragEnd={() => { setDragging(false); markDragEnd(); }}
      onClick={(e) => openBook(book, e)}
    >
      <span class="hcs-slab-title">{book.name}</span>
    </div>
  );
}

function Piles({ books, draggable, perPile = 6 }) {
  const piles = [];
  for (let i = 0; i < books.length; i += perPile) piles.push(books.slice(i, i + perPile));
  return (
    <div class="hcs-piles">
      {piles.map((pile, i) => (
        <div class="hcs-pile" key={i}>
          {pile.map((p) => <Slab key={p} notePath={p} draggable={draggable} />)}
        </div>
      ))}
    </div>
  );
}

/** Books that did not fit, lying in heaps on top of the case. */
function TopSlab({ notePath }) {
  const book = useBook(notePath);
  const dim = sizeOf(book.pages);
  const src = useCoverSrc(book);
  const thick = clamp(8, Math.round(6 + (book.pages || 300) / 48), 20);

  return (
    <div
      class="hcs-topslab"
      style={{
        "--w": `${Math.round(dim.face * 0.72)}px`, "--thick": `${thick}px`,
        "--jit": (hashOf(book.path) % 7) - 3,
        "--blank-hue": hashOf(book.path) % 360,
      }}
      title={book.name}
      onClick={(e) => openBook(book, e)}
    >
      {src ? <img src={src} alt="" draggable={false} decoding="async" />
           : <div class="hcs-topslab-blank" />}
    </div>
  );
}

function TopPile({ books, perStack = 5 }) {
  if (!books.length) return null;
  const stacks = [];
  for (let i = 0; i < books.length; i += perStack) stacks.push(books.slice(i, i + perStack));
  return (
    <div class="hcs-toppile">
      {stacks.map((st, i) => (
        <div class="hcs-topstack" key={i} style={{ "--lean": `${(i % 2 ? 1.6 : -1.8)}deg` }}>
          {st.map((p) => <TopSlab key={p} notePath={p} />)}
        </div>
      ))}
    </div>
  );
}

// ── one shelf ──────────────────────────────────────────────────────────────
function Shelf({
  title, books, collapsed, wrap, pattern, webs, wear, dogears, spiderPath,
  bookends, lamp, beamMode, flat, draggable, drop, onDrop, walls,
  spines, isFace, onTurn, onHush,
}) {
  const [open, setOpen] = dc.useState(false);
  const [hot, setHot] = dc.useState(false);
  const overflowing = books.length > collapsed;
  const visible = open || !overflowing ? books : books.slice(0, collapsed);
  const overflow = open || !overflowing ? [] : books.slice(collapsed);
  const canDrop = draggable && !!drop;
  // a bookend only makes sense when the row has slack after the last book
  // even a single book wants something to lean on
  const showEnd = bookends && !flat && visible.length >= 1 && !wrap && !open;

  return (
    <div class="hcs-section">
      <div
        class={"hcs-shelf" + (hot ? " is-drop" : "")}
        onDragOver={canDrop ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setHot(true); } : undefined}
        onDragLeave={canDrop ? (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setHot(false); } : undefined}
        onDrop={canDrop ? (e) => {
          e.preventDefault();
          setHot(false);
          const p = e.dataTransfer.getData(DRAG_MIME) || e.dataTransfer.getData("text/plain");
          if (p) onDrop?.(p, drop);
        } : undefined}
      >
        {flat ? (
          /* still a row, so the min-height and headroom that govern a standing
             shelf govern this one too — no shelf is ever shorter */
          <div class="hcs-row is-flat">
            {visible.length === 0 ? <EmptyShelf seed={title} /> : <Piles books={visible} draggable={draggable} />}
          </div>
        ) : (
          <div
            class={"hcs-row" + (wrap || open ? " is-wrapped" : "")}
            {...lampHandlers(lamp === "pointer")}
          >
            {beamMode && visible.length > 0 && <Rail />}
            {visible.map((p, i) => (
              <FaceBook
                key={p}
                notePath={p}
                pattern={pattern}
                webs={webs}
                wear={wear}
                dogears={dogears}
                spider={p === spiderPath}
                beamMode={beamMode}
                draggable={draggable}
                leaning={showEnd && i === visible.length - 1}
                spine={spines && !isFace(p)}
                onTurn={onTurn}
                onHush={onHush}
                lean={showEnd && spines && !isFace(p)
                  ? (i === visible.length - 1 ? 1 : i === visible.length - 2 ? 2 : 0)
                  : 0}
              />
            ))}
            {showEnd && <div class="hcs-bookend" />}
            {visible.length === 0 && <EmptyShelf seed={title} />}
            {lamp === "pointer" && <Lamp />}
          </div>
        )}

        {/* The ends of the run. .hcs-shelf spans the whole row, however long
            it is, so these sit at the true ends of the shelf rather than at
            the edges of the window — scroll to one and you have found the end
            of it, which is what the study's side panels say. */}
        {walls && <><i class="hcs-wall is-l" aria-hidden="true" /><i class="hcs-wall is-r" aria-hidden="true" /></>}

        <div class="hcs-plank" />
        {overflow.length > 0 && <TopPile books={overflow} />}
        {/* Plate and button ride together at the near end of the board. A row
            can now be several times wider than the case, and the button used
            to be pinned to the far end of it. */}
        <div class="hcs-label">
          <span class="hcs-plate">{title}<i>{books.length}</i></span>
          {overflowing && (
            <button class="hcs-more" onClick={() => setOpen(!open)}>
              {open ? "Show less" : "Full shelf →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── the view ───────────────────────────────────────────────────────────────
function Shelves({
  tag = "book",
  folder = null,
  shelf = "medieval",
  wood = null,
  rack = true,
  walls = true,
  edgeScroll = true,
  progress = "crack",
  lamp = false,
  spines = false,
  banner = false,
  sign = "LIBRARY",
  subtitle = "Books & Marginalia",
  neon = NEON_COLORS[0],
  motion = true,
  webs = false,
  wear = false,
  dogears = false,
  dof = false,
  glass = false,
  daylight = false,
  spider = "stalest",
  bookends = false,
  flatFinished = true,
  collapsed = 8,
  wrap = false,
  draggable = true,
  full = true,
  sections = null,
}) {
  // `tag` takes one tag or several: tag="book" or tag={["book", "paper"]}
  const tags = [].concat(tag).map((t) => String(t).trim().replace(/^#/, "")).filter(Boolean);
  const query = tags.length
    ? `@page and (${tags.map((t) => `#${t}`).join(" or ")})`
    : "@page and #book";
  const all = dc.useQuery(query);
  const rev = dc.useIndexUpdates();

  /**
   * Where a dropped book has been *told* to go, before the vault agrees.
   *
   * A drop writes frontmatter, Obsidian reparses the file, the metadata cache
   * updates, Datacore reindexes and only then does the query re-run — several
   * hundred milliseconds during which the book sits on its old shelf looking
   * like the drag failed. Holding the patch here and laying it over the cached
   * frontmatter moves the book on the same frame you let go of it. The entry
   * is dropped again as soon as the real cache reports the same values, so
   * this can never disagree with the file for longer than the round trip.
   */
  const [pending, setPending] = dc.useState(() => new Map());

  dc.useEffect(() => {
    if (!pending.size) return;
    const next = new Map(pending);
    let settled = false;
    for (const [p, patch] of pending) {
      const fm = app.metadataCache.getCache(p)?.frontmatter ?? {};
      // a file that vanished has nothing left to settle against
      const gone = !app.vault.getAbstractFileByPath(p);
      if (gone || Object.entries(patch).every(([k, v]) => fm[k] === v)) {
        next.delete(p);
        settled = true;
      }
    }
    if (settled) setPending(next);
  }, [all, rev, pending]);

  const rows = dc.useMemo(() => {
    const inFolder = (p) =>
      !folder || p === folder || p.startsWith(folder.replace(/\/?$/, "/"));

    return (all ?? [])
      .map((p) => p.$path)
      .filter((p) => p && !isIgnored(p) && inFolder(p))
      .map((p) => {
        const fm = { ...(app.metadataCache.getCache(p)?.frontmatter ?? {}), ...(pending.get(p) ?? {}) };
        const pages = Number(fm.pages) || 0;
        const prog = Number(fm.progress) || 0;
        const status = String(fm.status ?? "").toLowerCase().trim();
        // `completed` is your word on it and wins both ways. Without the
        // false branch, dragging a finished book onto another shelf writes
        // completed:false but progress is still at the last page — so it is
        // inferred done again and snaps back, which looks like drag not working.
        const done =
          fm.completed === true ? true
          : fm.completed === false ? false
          : (DONE.includes(status) || (pages > 0 && prog >= pages));
        return {
          path: p, status, done, progress: prog, pages,
          pct: pages ? prog / pages : 0,
          tier: TIER_RANK[fm.tier] ?? 99,
          name: baseName(p),
        };
      });
  }, [all, folder, pending]);

  const day = useDaylight(daylight);
  const [chainOn, setChainOn] = dc.useState(true);

  // touch the book the spider is sitting on and it scuttles off for a while
  const [hushed, setHushed] = dc.useState(null);
  const hushTimer = dc.useRef(0);
  dc.useEffect(() => () => window.clearTimeout(hushTimer.current), []);

  /**
   * Which way each book is facing. The map holds only the ones you have
   * actually turned; everything else falls back to the default, so the
   * last-read book starts face-out but can still be shelved again.
   */
  const [faced, setFaced] = dc.useState(() => new Map());

  /** In spine mode the book you touched most recently stands face-out. */
  const lastRead = dc.useMemo(() => {
    if (!spines) return null;
    const dated = rows.map((r) => ({ p: r.path, m: mtimeOf(r.path) })).filter((x) => x.m != null);
    if (!dated.length) return null;
    dated.sort((a, b) => b.m - a.m);
    return dated[0].p;
  }, [rows, spines]);

  /**
   * One spider for the whole case, on the book that has gone longest without a
   * touch. Pass spider="newest" to hang it on the most recently edited note
   * instead, or spider={false} for none.
   */
  const spiderPath = dc.useMemo(() => {
    if (!spider) return null;
    const dated = rows
      .map((r) => ({ path: r.path, m: mtimeOf(r.path) }))
      .filter((x) => x.m != null);
    if (!dated.length) return null;
    dated.sort((a, b) => a.m - b.m);
    return spider === "newest" ? dated[dated.length - 1].path : dated[0].path;
  }, [rows, spider]);

  const shelves = dc.useMemo(() => {
    const byTier = (a, b) => a.tier - b.tier || a.name.localeCompare(b.name);
    const byProgress = (a, b) => b.pct - a.pct || byTier(a, b);

    const spec = sections ?? [
      {
        title: "Currently reading", sort: byProgress,
        pick: (r) => !r.done && READING.includes(r.status),
        drop: { status: "reading", completed: false },
      },
      {
        title: "Someday", sort: byTier,
        pick: (r) => !r.done && (UPCOMING.includes(r.status) || !r.status),
        drop: { status: "planned", completed: false },
      },
      {
        title: "Finished", sort: byTier, flat: flatFinished,
        pick: (r) => r.done,
        drop: { status: "completed", completed: true, __fillProgress: true },
      },
    ];

    return spec.map((s) => ({
      title: s.title,
      flat: !!s.flat,
      drop: s.drop ?? null,
      books: rows.filter(s.pick).sort(s.sort ?? byTier).map((r) => r.path),
    }));
  }, [rows, sections, flatFinished]);

  // ── drop → rewrite frontmatter ────────────────────────────────────────
  // The book moves first and the file catches up. `pending` is set before the
  // await, so the re-render that puts the book on its new shelf happens in the
  // same tick as the drop rather than after the vault round trip.
  const handleDrop = async (notePath, fields) => {
    if (!notePath || !fields) return;
    const { __fillProgress, ...rest } = fields;
    const patch = { ...rest };
    if (__fillProgress) {
      const fm = app.metadataCache.getCache(notePath)?.frontmatter ?? {};
      const pages = Number(fm.pages) || 0;
      const prog = Number(fm.progress) || 0;
      if (pages > 0 && prog < pages) patch.progress = pages;
    }
    setPending((prev) => new Map(prev).set(notePath, patch));
    try {
      await writeFields(notePath, patch);
    } catch {
      // the write failed, so the optimistic move was a lie — take it back
      setPending((prev) => { const n = new Map(prev); n.delete(notePath); return n; });
    }
  };

  const spotlight = progress === "spotlight";
  const rail = lamp === "rail";
  const beamMode =
      spotlight && rail ? "reveal"     // neutral until you reach for a book
    : spotlight         ? "progress"   // reading colour on show
    : rail              ? "solo"       // idle, and one book at a time
    : null;

  /**
   * The case, scaled to whatever is standing in it.
   *
   * Every shelf is the same height, and that height is the tallest book in the
   * library plus headroom — not a constant a 270px floor would overflow.
   *
   * Every number below is a FRACTION of the books, not a constant scaled by a
   * ratio, which is the difference between a bigger shelf and the same shelf
   * with bigger books crammed into it:
   *
   *   --shelf-gap  from the COVER, because it is the book-to-book pitch and the
   *                pitch is what decides how far a cone spills onto its
   *                neighbours. Deriving it from the height instead made the
   *                gaps grow faster than the books and thinned the light out.
   *   --head-h     clear air above the books, and the frame every hanging
   *                thing measures from. With rail lamps this is 0.20 of the
   *                tallest book — the ratio the study uses, where a 39px
   *                fixture fills 43px of air over a 214px book. It was 0.17,
   *                which left a fixture floating in a third of the headroom
   *                and reading as a light on a different shelf. Without lamps
   *                only a spider hangs here, so it stays shallow.
   *   --lamp-w     the shade, 0.28 of the cover — again the study's ratio, and
   *                the number every part of the fixture and the top of the
   *                cone are a fraction of. It replaces a hardcoded 34px that
   *                stayed put while the books went from 168px to 270px wide.
   *   --shelf-h    the books plus that headroom, and nothing else. Obsidian
   *                sets box-sizing: border-box everywhere, so the headroom is
   *                padding INSIDE this number — leave it out and a row with
   *                books grows past its stated height while an empty one does
   *                not, which is uneven shelves by another route.
   */
  const metrics = dc.useMemo(() => {
    const dims = rows.length ? rows.map((r) => sizeOf(r.pages)) : [sizeOf(0)];
    const tall = Math.max(REF_TALL, ...dims.map((d) => d.tall));
    const face = Math.max(FACE_MIN, ...dims.map((d) => d.face));
    const headH = Math.round(tall * (beamMode ? 0.2 : 0.1));
    return {
      "--book-w": `${face}px`,
      "--shelf-gap": `${Math.round(face * 0.11)}px`,
      "--head-h": `${headH}px`,
      "--lamp-w": `${Math.round(face * LAMP_RATIO)}px`,
      "--shelf-h": `${Math.round(tall * 1.03) + headH}px`,
    };
  }, [rows, beamMode]);

  // one screen tall, scrolling inside itself — see useFitHeight in core.jsx
  const [fitRef, fitH] = useFitHeight(full);
  // and hovering either end of it walks the shelf sideways — see useEdgeScroll
  const stacksRef = useEdgeScroll(edgeScroll);

  const cls = ["hcs", styleClass(shelf), `mode-${woodFor(shelf, wood)}`];
  if (full) cls.push("is-full");
  if (!rack) cls.push("no-rack");
  if (lamp === "pointer") cls.push("has-lamp");
  if (beamMode) cls.push("beams");
  if (beamMode === "solo") cls.push("spot-solo");
  if (dof) cls.push("has-dof");
  cls.push(motion ? "has-motion" : "no-motion");
  if (glass) cls.push("has-glass");
  if (banner && !chainOn) cls.push("is-unlit");

  return (
    <>
      <Styles />
      <CritterStyles />
      <BannerStyles />
      <div
        class={cls.join(" ")}
        ref={fitRef}
        style={fitH ? { ...metrics, "--hcs-vh": `${fitH}px` } : metrics}
      >
        {banner && (
          <Banner
            banner={banner}
            sign={sign}
            subtitle={subtitle}
            neon={neon}
            lit={chainOn}
            onToggle={() => setChainOn((v) => !v)}
          />
        )}
        <div class="hcs-case">
          {/* The stepped corners. They belong to the case, which does not
              scroll, so they stay at the corners of the furniture. Hidden
              unless shelf="art deco". */}
          <i class="hcs-corner is-l" aria-hidden="true" />
          <i class="hcs-corner is-r" aria-hidden="true" />
          {/* The shelves scroll; the case does not. Cornice, plinth, glass and
              daylight are painted on the case, so they stay put. */}
          <div class="hcs-stacks" ref={stacksRef}>
            {shelves.map((s) => (
              <Shelf
                key={s.title}
                title={s.title}
                books={s.books}
                collapsed={collapsed}
                wrap={wrap}
                pattern={progress}
                webs={webs}
                wear={wear}
                dogears={dogears}
                spiderPath={hushed && hushed === spiderPath ? null : spiderPath}
                spines={spines}
                isFace={(p) => faced.has(p) ? faced.get(p) : p === lastRead}
                onTurn={(p) => setFaced((prev) => {
                  const next = new Map(prev);
                  const nowFace = prev.has(p) ? prev.get(p) : p === lastRead;
                  next.set(p, !nowFace);
                  return next;
                })}
                onHush={(path) => {
                  if (path !== spiderPath) return;
                  setHushed(path);
                  window.clearTimeout(hushTimer.current);
                  hushTimer.current = window.setTimeout(() => setHushed(null), 45000);
                }}
                bookends={bookends}
                walls={walls}
                lamp={lamp}
                beamMode={beamMode}
                flat={s.flat}
                draggable={draggable}
                drop={s.drop}
                onDrop={handleDrop}
              />
            ))}
          </div>
          {daylight && <Daylight tint={day} />}
          {glass && <GlassDoors />}
        </div>
      </div>
    </>
  );
}

return { Shelves, sizeOf, FACE_MIN, FACE_MAX, CONE_RATIO, LAMP_RATIO };
