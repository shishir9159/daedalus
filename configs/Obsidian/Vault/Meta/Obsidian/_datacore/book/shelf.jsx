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
//  `wood` is the material; every material works under either design. Unset,
//  it is oak for the library and ebony for deco. Deco's board stays brass
//  whatever you pick, so the timber shows in the carcass and the sides.
//
//  `rack` is the layout. true (the default) is separate boards with air
//  between them; false is one carcass, each board the ceiling of the shelf
//  below — a bookcase.
//
//  Signs are independent of the design: banner="deco sunburst" over
//  shelf="medieval" is fine.
//
//  lamp="rail" hangs a fixture over every book. progress="spotlight" colours
//  those same lamps by how far you have read; with both on, the lamps sit
//  neutral until you hover. With rail and any other progress pattern, hovering
//  lights one book and the rest fall dark.
//
//  `motion` keeps the spider, the webs, the beams and the signs moving even
//  under reduced motion; motion={false} stops them.
//
//  Size is not an argument: it comes from the page count (sizeOf), floored at
//  FACE_MIN. Shelf height, headroom, gaps, cones, the spider and its thread
//  are all fractions of the books (the metrics memo), so moving FACE_MIN
//  rescales the whole case.
//
//  `full` gives the library the pane's whole width and hides the rest of the
//  note. It scrolls up and down with the note; a row longer than the window
//  pans sideways under the pointer at either end (`edgeScroll`), Shift+wheel or
//  a trackpad.
//
//  Notes under Meta/Obsidian/Templates/ are never collected (IGNORE_PATHS).
//  Never declare a local named h here — it is the JSX pragma.
// ════════════════════════════════════════════════════════════════════════════

const core = await dc.require("Meta/Obsidian/_datacore/book/core.jsx");
const pat = await dc.require("Meta/Obsidian/_datacore/book/patterns.jsx");
const bug = await dc.require("Meta/Obsidian/_datacore/book/critters.jsx");
const sgn = await dc.require("Meta/Obsidian/_datacore/book/banner.jsx");

const {
  Styles, ShelfCover, useBook, useCoverColor, useCoverSrc, useSpineImage,
  useEdgeScroll, styleClass, woodFor, tiltFor, hashOf, clamp,
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
//  FACE_MIN is a hard floor: Obsidian scales covers down bilinearly, and below
//  about 270px the type on the artwork stops resolving. FACE_MAX stays close
//  to it, so the page count reads as a fatter book, not a bigger one.
// ════════════════════════════════════════════════════════════════════════════
const FACE_MIN = 270;
const FACE_MAX = 306;
/* A 2:3 board, like the blank-cover placeholder, so books with and without
   artwork stand the same height. */
const TALL_RATIO = 1.5;
/* Cone width per cover. Wider than the pitch (cover + 11%) so each cone covers
   its own book and washes part of each neighbour, without flattening the row. */
const CONE_RATIO = 1.82;
/* The shade, as a fraction of the cover; every part of the fixture and the top
   of the cone scale from it (--lamp-w in core.jsx). */
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
    // at 1 the spider is ~68px across, a tarantula beside a 270px cover
    spiderScale: +clamp(0.42, face / 440, 0.78).toFixed(3),
    // how far below the compartment ceiling it rests: over the cover's top corner
    drop: Math.round(tall * 0.11),
  };
}

/**
 * Hangs a spider or thread from the compartment ceiling, not the book's top:
 * the slot sits `--head-h` (set by `metrics`) below it.
 */
const HANG_TOP = "calc(-1 * var(--head-h) + 8px)";
const hangThread = (drop) => `calc(var(--head-h) + ${drop}px)`;

// ── one book, face out ─────────────────────────────────────────────────────
function FaceBook({
  notePath, pattern, webs, wear, dogears, spider, motion, beamMode,
  draggable, leaning, spine, onTurn, onHush, lean,
}) {
  const book = useBook(notePath);
  const [dragging, setDragging] = dc.useState(false);
  const neglect = useNeglect(notePath, webs || wear);
  const cloth = useCoverColor(book);
  const spineArt = useSpineImage(book, !!spine);
  const open = book.status === "reading" && !book.finished;

  // The drag ghost is the book alone; by default it is the whole slot, lamp and cone included.
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
          {/* the spine's real box: Cobweb works its reach out from both sides */}
          {webs && neglect > 0 && (
            <Cobweb level={neglect} seed={book.path} width={dim.spine} height={dim.tall} sway={motion} />
          )}
          {open && <div class="hcs-sp-ribbon" />}
        </div>
        {/* Just off the fore-edge, hung from the ceiling like the face-out one
            and sized against the spine's thickness. */}
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
        {/* BookCover with effects="lit": the board, graded by the lamps. The
            raster is 2.2x the display width, for HiDPI. */}
        <ShelfCover book={book} width={Math.round(dim.face * 2.2)} />
        {beamMode && <Tint />}
        {webs && neglect > 0 && (
          <Cobweb level={neglect} seed={book.path} width={dim.face} height={dim.tall} sway={motion} />
        )}
        {dogears && <Dogear book={book} />}
        {open && <div class="hcs-open-ribbon" />}
        <Progress book={book} pattern={pattern} layer="art" />
      </div>
      {/* Hung from the compartment ceiling, so it dangles in front of the
          cover; drop and scale come from sizeOf. */}
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
 * A book lying flat, spine out: a band of cloth with the title along it.
 * Draggable, so a finished title can go back on a working shelf.
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
        // a clipped slab's default ghost can come out empty
        try { e.dataTransfer.setDragImage(e.currentTarget, 24, 12); } catch { }
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
  title, books, collapsed, wrap, pattern, webs, wear, dogears, spiderPath, motion,
  bookends, lamp, beamMode, flat, draggable, drop, onDrop, walls,
  spines, isFace, onTurn, onHush,
}) {
  const [open, setOpen] = dc.useState(false);
  const [hot, setHot] = dc.useState(false);
  const overflowing = books.length > collapsed;
  const visible = open || !overflowing ? books : books.slice(0, collapsed);
  const overflow = open || !overflowing ? [] : books.slice(collapsed);
  const canDrop = draggable && !!drop;
  // only with slack after the last book; even a single book gets one
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
          /* still a row, so it keeps a standing shelf's min-height and headroom */
          <div class="hcs-row is-flat">
            {visible.length === 0 ? <EmptyShelf seed={title} sway={motion} /> : <Piles books={visible} draggable={draggable} />}
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
                motion={motion}
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
            {visible.length === 0 && <EmptyShelf seed={title} sway={motion} />}
            {lamp === "pointer" && <Lamp />}
          </div>
        )}

        {/* .hcs-shelf spans the whole row, so the walls sit at the shelf's
            true ends, not the window's edges. */}
        {walls && <><i class="hcs-wall is-l" aria-hidden="true" /><i class="hcs-wall is-r" aria-hidden="true" /></>}

        <div class="hcs-plank" />
        {overflow.length > 0 && <TopPile books={overflow} />}
        {/* plate and button ride together at the near end, however wide the row */}
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
   * Where a dropped book has been told to go, before the vault agrees. The
   * frontmatter write takes several hundred ms to reach the query; laid over
   * the cached frontmatter, the patch moves the book on the drop. An entry
   * goes once the cache reports the same values.
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
        // `completed` wins both ways: without the false branch, a finished book
        // dragged to another shelf is inferred done from its progress and snaps back.
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
   * Which way each book you have turned is facing. The rest fall back to the
   * default, so the last-read book starts face-out but can be shelved again.
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
  // `pending` is set before the await, so the book moves on the drop and the
  // file catches up.
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
      // the write failed: undo the optimistic move
      setPending((prev) => { const n = new Map(prev); n.delete(notePath); return n; });
    }
  };

  const spotlight = progress === "spotlight";
  const rail = lamp === "rail";
  const beamMode =
    spotlight && rail ? "reveal"     // neutral until you reach for a book
      : spotlight ? "progress"   // reading colour on show
        : rail ? "solo"       // idle, and one book at a time
          : null;

  /**
   * The case, scaled to what stands in it: every shelf is the tallest book
   * plus headroom, and every number is a fraction of the books.
   *
   *   --shelf-gap  from the cover: it is the book-to-book pitch, which decides
   *                how far a cone spills onto its neighbours.
   *   --head-h     clear air above the books, the frame every hanging thing
   *                measures from: 0.20 of the tallest book with rail lamps, so
   *                the fixture fills it; 0.10 when only a spider hangs there.
   *   --lamp-w     the shade, LAMP_RATIO of the cover; every part of the
   *                fixture and the top of the cone scale from it.
   *   --shelf-h    the books plus the headroom. Obsidian's border-box makes the
   *                headroom padding inside this number, so leaving it out
   *                makes full rows taller than empty ones.
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

  // hovering either end of the case walks the shelf sideways — see useEdgeScroll
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
        style={metrics}
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
          {/* stepped corners, shown only for shelf="art deco" */}
          <i class="hcs-corner is-l" aria-hidden="true" />
          <i class="hcs-corner is-r" aria-hidden="true" />
          {/* The shelves scroll; the case, with its cornice, plinth, glass and
              daylight, does not. */}
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
                motion={motion}
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
