// ════════════════════════════════════════════════════════════════════════════
//  drawers.jsx  —  the library of papers, as a chest of drawers
//  Location: Meta/Obsidian/_datacore/paper/drawers.jsx
//
//  Give it a note of its own; it takes over the window.
//
//    ```datacorejsx
//    const { Drawers } = await dc.require("Meta/Obsidian/_datacore/paper/drawers.jsx");
//    return function View() {
//      return <Drawers
//        design="medieval"
//        tag={["paper"]}
//      />;
//    };
//    ```
//
//  REQUIRED          design "medieval" | "art deco"
//  WHAT TO COLLECT   tag "paper" (or a list) · folder null
//  THE DRAWERS       drawerContents "leaves"|"rows" · dropDepth 22 ·
//                    leaf "scroll"|"sheet" · groupBy · order · sort · perRow ·
//                    collapsed
//  READING VIEW      readingStain "auto" | true | false
//  OTHER             queueSize (refill size only) · motion · full · webfonts
//
//  `design` is mandatory. Everything else has an answer already.
//
//  `tag` behaves exactly as it does on <Shelves>: one tag or a list, OR'd, a
//  leading # optional. Collect on a subject rather than on #paper and the
//  drawers regroup around whatever is left —
//
//    <Drawers design="art deco" tag={["transformer", "attention"]} />
//    <Drawers design="medieval" tag="paper" folder="Papers/NLP" />
//
//  — because the tag you searched for is dropped from every paper's topics.
//  See usePapers in core.jsx.
//
//  ── HOW IT BEHAVES ────────────────────────────────────────────────────────
//  A drawer is shut until you pull it. Pulling one pushes it towards you by
//  `dropDepth` and drops its front down on a hinge. To shut it again, push any
//  part of it that is not paper: the head above the tray, or the front lying
//  flat below it. Right-clicking anywhere in the drawer does the same, and so
//  does Escape. One drawer is open at a time — a chest with every drawer out is
//  not a chest, it is a pile.
//
//  Inside, a paper is a leaf. Click it and it joins the reading queue in the
//  bottom-left corner, immediately — the flight across the screen is what
//  happens next, not what has to finish first. A double-click queues it and
//  opens it. Right-click — or alt-click, for when something else has taken the
//  context menu — dissolves it into the pile beside the queue, which is not a
//  delete: click the pile and the dissolved papers fan out to be picked back up.
//
//  A leaf with a ring on it is one you are in the middle of: it has a PDF and
//  the PDF has marks in it. Nothing to set — see `active` in core.jsx.
//
//  THE QUEUE STARTS EMPTY. It is a list you build by clicking, not a query;
//  the button under an empty queue fills it from unread if that is what you
//  wanted. Nothing here writes to your vault — queue and pile are the session's.
//
//  Escape closes whatever is on top, innermost first.
//
//  ── THE FOUR TWEAKS ───────────────────────────────────────────────────────
//  drawerContents  "leaves" is the drawer as a tray of sheets, five to a row,
//                  snapping row by row. "rows" is the same papers as a list —
//                  denser, sortable by eye, no picture of anything.
//  dropDepth       how far an open drawer comes towards you, in px. 0 is a flat
//                  accordion; past ~50 the perspective starts to shear.
//  leaf            scriptorium only, and it names a FACE rather than toggling
//                  one: "scroll" is the sheet with the rolled top, "sheet" is
//                  the flat one torn on all four edges. Both are the study's
//                  own photographed paper, so both are exactly what it drew.
//                  Ignored by art deco, which has no torn edges in it at all.
//                  `rolledTop={false}` is the older spelling of leaf="sheet"
//                  and still works; `leaf` wins when both are given.
//  readingStain    the coffee ring in the reading panel's margin. "auto" is the
//                  default and means what the ring has always meant: this paper
//                  is being read. true and false override it either way.
//
//  ── ONE THING WORTH KNOWING ───────────────────────────────────────────────
//  A full-bleed view is as tall as its pane and scrolls inside itself. Not a
//  style choice: a note that grows to a few thousand pixels defeats Obsidian's
//  section recycling and the scroll snaps back to the top. useFitHeight in
//  book/core.jsx has the details.
//
//  NOTE: never declare a local named `h` in this file — it is the JSX pragma.
// ════════════════════════════════════════════════════════════════════════════

const core = await dc.require("Meta/Obsidian/_datacore/paper/core.jsx");

const {
  designClass, DesignError, usePapers, indexBy, useDrawers, unreadOf, relatedTo,
  Pip, ReadingPanel, Styles, useFitHeight, useEscape, footOf, clamp,
} = core;

// ── code-level constants (not user tweaks) ──────────────────────────────────
/* Every leaf sits at a slightly different angle, cycling through five so a row
   never repeats itself and the same paper always leans the same way. */
const LEAF_TILT = [-1.4, 0.8, -0.4, 1.2, -0.9];
/* How far one press of ↑/↓ walks the tray, per design. It is the leaf plus its
   gap — a row, exactly, so the snap lands rather than settles. */
const ROW_STEP = { medieval: 268, deco: 216 };
/* Long enough for the flight to land before the list re-sorts under it. */
const FLY_MS = 460;

/**
 * The two leaf faces the scriptorium draws, by name.
 *
 * These are the study's own photographed sheets, not a shape generated in CSS
 * — see --pv-leaf-scroll / --pv-leaf-sheet in core.jsx. There is no third one
 * to choose from because the study does not have a third one; if it grows one,
 * it goes here and in that variable block, and nowhere else.
 *
 *   scroll   a sheet whose top is rolled. The study's default.
 *   sheet    a flat sheet, torn on all four edges.
 *
 * `rolledTop` is the older boolean spelling of the same choice and still
 * works; the name wins when both are given.
 */
const LEAF_FACES = ["scroll", "sheet"];

function faceOf(leaf, rolledTop) {
  const named = String(leaf ?? "").toLowerCase().trim();
  if (named === "sheet" || named === "flat") return "sheet";
  if (named === "scroll" || named === "rolled") return "scroll";
  return rolledTop === false ? "sheet" : "scroll";
}

// ════════════════════════════════════════════════════════════════════════════
//  One paper, as a leaf in the tray
// ════════════════════════════════════════════════════════════════════════════
function Leaf({ paper, index, queued, flying, flat, onQueue, onDissolve }) {
  return (
    <div
      class="pvd-leaf-wrap"
      style={{
        "--tilt": `${LEAF_TILT[index % LEAF_TILT.length]}deg`,
        animation: flying
          ? `${flying === "queue" ? "pvFlyQueue" : "pvFlyPile"} ${FLY_MS}ms cubic-bezier(.3,.1,.6,1) both`
          : "pvLeafRise .4s cubic-bezier(.2,.8,.3,1) both",
        animationDelay: flying ? "0s" : `${Math.min((index % 5) * 0.05, 0.3)}s`,
      }}
    >
      <div
        class={"pvd-leaf" + (flat ? " is-flat" : "")}
        title={`${paper.title}\nclick · queue   double-click · read   right-click or alt-click · dissolve`}
        onClick={onQueue}
        onContextMenu={onDissolve}
      >
        <span class="pvd-leaf-paper" aria-hidden="true" />
        {/* A ring means this one is open on your desk right now — it has a PDF
            and the PDF has marks in it. Not every leaf gets one; a tray where
            everything is stained says nothing about anything. */}
        {paper.active && <span class="pvd-leaf-stain" aria-hidden="true" />}
        <span class="pvd-leaf-fanlet" aria-hidden="true" />
        <span class="pvd-leaf-rubric" aria-hidden="true" />
        <div class="pvd-leaf-body">
          <div class="pvd-leaf-top">
            <span class="pvd-year">{paper.year ?? "—"}</span>
            <i class="pvd-grow" />
            <Pip paper={paper} size={12} />
          </div>
          <i class="pv-rule pvd-leaf-hr" />
          <span class="pvd-leaf-title">{paper.title}</span>
          <span class="pvd-leaf-authors">{paper.authorLine}</span>
          {paper.affiliationLine && (
            <span class="pvd-leaf-affil">{paper.affiliationLine}</span>
          )}
          <i class="pvd-grow" />
          {queued && <span class="pvd-stamp">QUEUED</span>}
          <div class="pvd-leaf-foot">
            <span class="pv-lozenge pvd-tiny" />
            <span>{footOf(paper)}</span>
          </div>
        </div>
        <span class="pvd-leaf-inner" aria-hidden="true" />
        <span class="pvd-leaf-corners" aria-hidden="true" />
      </div>
    </div>
  );
}

/** The same paper as a line, for drawerContents="rows". */
function Line({ paper, index, queued, flying, onQueue, onDissolve }) {
  return (
    <div
      class="pvd-line-wrap"
      style={{
        animation: flying
          ? `${flying === "queue" ? "pvFlyQueue" : "pvFlyPile"} ${FLY_MS}ms cubic-bezier(.3,.1,.6,1) both`
          : "pvRowRise .34s cubic-bezier(.2,.8,.3,1) both",
        animationDelay: flying ? "0s" : `${Math.min(index * 0.03, 0.25)}s`,
      }}
    >
      <div
        class="pvd-line"
        title={`${paper.title}\nclick · queue   double-click · read   right-click or alt-click · dissolve`}
        onClick={onQueue}
        onContextMenu={onDissolve}
      >
        <Pip paper={paper} size={11} />
        <span class="pvd-line-year">{paper.year ?? "—"}</span>
        <span class="pvd-line-title">{paper.title}</span>
        <span class="pvd-line-authors">
          <b>{paper.authorLine}</b>
          {paper.affiliationLine && <i>{paper.affiliationLine}</i>}
        </span>
        <span class="pvd-line-foot">{footOf(paper)}</span>
        {queued && <span class="pvd-stamp is-inline">QUEUED</span>}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  One drawer
// ════════════════════════════════════════════════════════════════════════════
function Drawer({
  drawer, open, depth, leaves, flat, perRow, collapsed, step,
  queue, flying, onOpen, onShut, onQueue, onRead, onDissolve,
}) {
  const trayRef = dc.useRef(null);
  const shown = drawer.papers.slice(0, collapsed);
  const hidden = drawer.total - shown.length;

  const rows = [];
  for (let i = 0; i < shown.length; i += perRow) rows.push(shown.slice(i, i + perRow));

  const walk = (dir) => (e) => {
    e.stopPropagation();
    trayRef.current?.scrollBy({ top: dir * step, behavior: "smooth" });
  };

  /**
   * A click queues, NOW. Nothing is deferred and nothing is conditional.
   *
   * The previous version held the click for 230ms so it could tell a single
   * click from a double, and cancelled it if a second click arrived. That is
   * the standard trick and it was the bug: a timer set inside an event handler
   * survives only as long as the closure that owns it, the tray re-renders
   * whenever the index ticks, and any of half a dozen ordinary things — the
   * leaf flying, the drawer re-sorting, the effect cleanup on a re-key — ate
   * the callback before it fired. The visible result is a click that does
   * nothing, which is exactly what was reported, twice.
   *
   * So: click queues, on the spot. A double-click queues on the first click and
   * opens on the second, which is additive and cannot race with itself. There
   * is no case where a click does nothing at all.
   */
  const handlers = (paper, i) => ({
    onQueue: (e) => {
      e.stopPropagation();
      // alt-click dissolves too — see onDissolve for why that alternative exists
      if (e.altKey) { onDissolve(paper.id, "leaf"); return; }
      onQueue(paper.id);
      if (e.detail >= 2) onRead(paper.id);
    },
    onDissolve: (e) => {
      e.preventDefault();
      e.stopPropagation();
      onDissolve(paper.id, "leaf");
    },
    queued: queue.includes(paper.id),
    flying: flying.find((f) => f.id === paper.id)?.to ?? null,
    index: i,
    paper,
  });

  if (!open) {
    return (
      <div class="pvd-drawer" style={{ "--drop": "0px" }} onContextMenu={(e) => e.preventDefault()}>
        <div class="pvd-front" onClick={onOpen} title={`${drawer.label} — ${drawer.total} papers`}>
          <span class="pvd-numeral">{drawer.numeral}</span>
          <span class="pvd-flag">{drawer.idx}</span>
          <div class="pvd-plate">
            <span class="pvd-plate-label">{drawer.label}</span>
            <i class="pvd-plate-rule" />
            <span class="pvd-plate-tag">{drawer.tag}</span>
            <span class="pvd-plate-count">{drawer.total}</span>
          </div>
          <span class="pvd-handle" />
        </div>
      </div>
    );
  }

  /**
   * Shutting a drawer, three ways.
   *
   * It was right-click only, which is one gesture and a fragile one: it is the
   * gesture Obsidian itself wants for its own menu, a leaf inside the drawer
   * takes it first for dissolving, and there is nothing on screen to say it
   * exists. The two visible parts of an open drawer that are NOT paper — the
   * head above the tray and the front lying flat below it — are what you would
   * push to close a real one, so pushing them closes this one.
   */
  const shut = (e) => { e.preventDefault(); e.stopPropagation(); onShut(); };

  return (
    <div
      class="pvd-drawer is-open"
      style={{ "--drop": `${depth}px` }}
      onContextMenu={shut}
    >
      <div class="pvd-well">
        <div class="pvd-well-head" onClick={shut} title="shut the drawer">
          <span class="pv-lozenge" />
          <span class="pvd-well-label">{drawer.label}</span>
          <span class="pvd-well-tag">{drawer.tag}</span>
          <i class="pv-rule" />
          {leaves && rows.length > 1 && (
            <>
              <span class="pvd-well-rows">{rows.length === 1 ? "1 ROW" : `${rows.length} ROWS`}</span>
              <button class="pvd-step" onClick={walk(-1)} title="previous row">↑</button>
              <button class="pvd-step" onClick={walk(1)} title="next row">↓</button>
            </>
          )}
          <span class="pvd-well-count">{drawer.total}</span>
        </div>

        {leaves ? (
          <div class="pvd-tray" ref={trayRef}>
            {rows.map((row, ri) => (
              <div class="pvd-row" key={ri}>
                {row.map((p, i) => (
                  <Leaf key={p.id} flat={flat} {...handlers(p, ri * perRow + i)} />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div class="pvd-list">
            {shown.map((p, i) => <Line key={p.id} {...handlers(p, i)} />)}
          </div>
        )}

        {hidden > 0 && (
          <div class="pvd-more">
            <i class="pv-rule" />
            <span>{`+${hidden} FURTHER WITHIN`}</span>
          </div>
        )}
      </div>

      {/* The drawer front, on its hinge — folded by the perspective on the
          drawer itself rather than by sharing a flattened 3D context with the
          well, which is what used to eat the clicks on the leaves. */}
      <div class="pvd-flap" onClick={shut} title="shut the drawer">
        <span class="pv-lozenge" />
        <span class="pvd-flap-idx">{drawer.idx}</span>
        <span class="pvd-flap-label">{drawer.label}</span>
        <span class="pvd-flap-tag">{drawer.tag}</span>
        <i class="pvd-flap-rule" />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  The view
// ════════════════════════════════════════════════════════════════════════════
/**
 * `design` is checked here, before a single hook runs.
 *
 * Not fussiness: the check can fail, and a component that renders an error on
 * one pass and a chest full of hooks on the next is a "rendered fewer hooks
 * than expected" crash waiting for the first typo. The guard has no state of
 * its own, so both branches are legal.
 */
function Drawers(props) {
  let skin;
  try { skin = designClass(props.design, "<Drawers>"); }
  catch (e) { return <DesignError error={e} />; }
  return <Chest {...props} skin={skin} />;
}

function Chest({
  skin,
  tag = "paper",
  folder = null,
  // the four tweaks
  drawerContents = "leaves",
  dropDepth = 22,
  leaf = "scroll",
  rolledTop = undefined,
  readingStain = "auto",
  // how the chest is filled
  groupBy = "topic",
  order = "count",
  sort = "year",
  perRow = 5,
  collapsed = 15,
  queueSize = 8,
  // chrome
  full = true,
  motion = true,
  webfonts = true,
}) {
  const papers = usePapers({ tag, folder });
  const byId = dc.useMemo(() => indexBy(papers), [papers]);
  const drawers = useDrawers(papers, { groupBy, order, sort });

  const leaves = String(drawerContents ?? "leaves") !== "rows";
  const depth = clamp(0, Number(dropDepth) || 0, 70);
  const flat = skin === "medieval" && faceOf(leaf, rolledTop) === "sheet";
  const step = ROW_STEP[skin];

  // ── session state ────────────────────────────────────────────────────────
  // Nothing below is written to the vault. The queue is what you mean to read
  // next, the pile is what you have pushed aside, and both are answers to
  // "what am I doing right now" rather than facts about the papers.
  const [open, setOpen] = dc.useState(null);
  /**
   * The queue starts EMPTY.
   *
   * It used to be seeded with everything unread, which read as broken: the
   * papers you were most likely to click were already in it, so clicking one
   * moved it to the front and changed nothing you could see — the stamp was
   * already on the leaf and the count did not move. An empty queue is also the
   * honest one: it is a list you are building right now, not a query. The
   * REFILL button under an empty queue still fills it from unread if that is
   * what you wanted.
   */
  const [queue, setQueue] = dc.useState([]);
  const [qi, setQi] = dc.useState(0);
  const [pile, setPile] = dc.useState([]);
  const [reading, setReading] = dc.useState(null);
  const [queueOpen, setQueueOpen] = dc.useState(false);
  const [fanOpen, setFanOpen] = dc.useState(false);
  const [fly, setFly] = dc.useState([]);            // [{ id, to }] mid-flight
  const [dissolving, setDissolving] = dc.useState(null);
  const [seen, setSeen] = dc.useState([]);

  const timers = dc.useRef([]);
  dc.useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const later = (fn, ms) => { timers.current.push(window.setTimeout(fn, ms)); };

  /**
   * The top drawer opens ONCE, when the papers first arrive.
   *
   * This used to be "if nothing is open, open the first one", which meant a
   * chest that could not be shut: every way of closing a drawer set open to
   * null, the effect saw null on the very next pass and pulled drawer one
   * straight back out, replaying the opening animation. Right-click looked
   * like it was re-opening the drawer because it was.
   */
  const opened = dc.useRef(false);
  dc.useEffect(() => {
    if (opened.current || !drawers.length) return;
    opened.current = true;
    setOpen(drawers[0].id);
  }, [drawers]);

  // A paper that has been renamed or deleted since it was queued is gone; the
  // queue is a list of ids, so it has to be filtered rather than trusted.
  const live = dc.useMemo(() => queue.filter((id) => byId[id]), [queue, byId]);
  const livePile = dc.useMemo(() => pile.filter((id) => byId[id]), [pile, byId]);

  useEscape(() => {
    if (reading) setReading(null);
    else if (fanOpen) setFanOpen(false);
    else if (queueOpen) setQueueOpen(false);
    else if (open) setOpen(null);
  });

  // ── the three gestures ───────────────────────────────────────────────────
  /**
   * `fly` is a LIST of papers in flight, not one.
   *
   * It was one, guarded by "if something is already flying, ignore this" — so
   * clicking four papers in a row queued the first and silently dropped the
   * other three, which is indistinguishable from a broken click handler. Each
   * flight now clears only its own entry, and a second click on a paper that
   * is already on its way is the only thing still ignored.
   */
  const inFlight = (id) => fly.some((f) => f.id === id);
  const land = (id) => setFly((prev) => prev.filter((f) => f.id !== id));

  /**
   * The queue moves on the click; the flight is decoration.
   *
   * It was the other way round — the paper flew for 460ms and joined the queue
   * when it landed — which meant every click had almost half a second where
   * nothing had happened yet, and a click whose flight was interrupted by a
   * re-render never arrived at all. State first, animation after: the QUEUE
   * count in the corner moves under your finger, and if the animation is cut
   * short the paper is still in the queue.
   */
  const toQueue = (id) => {
    setQueue((prev) => [id].concat(prev.filter((x) => x !== id)));
    setPile((prev) => prev.filter((x) => x !== id));
    if (inFlight(id)) return;
    setFly((prev) => prev.concat([{ id, to: "queue" }]));
    later(() => land(id), FLY_MS);
  };

  const toPile = (id, from) => {
    if (inFlight(id)) return;
    if (from === "leaf") setFly((prev) => prev.concat([{ id, to: "pile" }]));
    else setDissolving(id);
    later(() => {
      land(id);
      setDissolving(null);
      setQueue((prev) => {
        const next = prev.filter((x) => x !== id);
        setQi((i) => Math.min(i, Math.max(0, next.length - 1)));
        return next;
      });
      setPile((prev) => [id].concat(prev.filter((x) => x !== id)));
    }, FLY_MS - 20);
  };

  const read = (id) => {
    setReading(id);
    setSeen((prev) => (prev.includes(id) ? prev : [id].concat(prev)));
  };

  const revive = (id) => {
    setFanOpen(false);
    setPile((prev) => prev.filter((x) => x !== id));
    setQueue((prev) => [id].concat(prev.filter((x) => x !== id)));
    setQi(0);
  };

  // ── the queue stack ──────────────────────────────────────────────────────
  // Five cards deep at most: past that the stack is a texture, not a list, and
  // every extra card is another shadow to composite.
  const stack = dc.useMemo(() => {
    if (!live.length) return [];
    const rotated = live.slice(qi).concat(live.slice(0, qi));
    return rotated.slice(0, 5).map((id, i) => ({ id, i, paper: byId[id] }));
  }, [live, qi, byId]);

  const current = reading ? byId[reading] : null;
  const related = dc.useMemo(
    () => relatedTo(current, papers, byId),
    [current, papers, byId]
  );

  const openDrawer = drawers.find((d) => d.id === open) ?? null;
  const total = papers.length;

  const [fitRef, fitH] = useFitHeight(full);

  const cls = ["pv", "pvd", skin];
  if (full) cls.push("is-full");
  cls.push(motion ? "has-motion" : "no-motion");

  return (
    <>
      <Styles webfonts={webfonts} />
      <DrawerStyles />
      <div class={cls.join(" ")} ref={fitRef} style={fitH ? { "--pv-vh": `${fitH}px` } : null}>
        <div class="pv-case">
          <i class="pv-frame" aria-hidden="true" />

          <div class="pv-head">
            <i class="pv-fan" aria-hidden="true" />
            <span class="pv-name">{skin === "deco" ? "ARCHIVE" : "SCRIPTORIVM"}</span>
            <i class="pv-sep" />
            {/* the drawer's name, and nothing about what has been done to it */}
            <span class="pv-crumb">{openDrawer ? openDrawer.label : ""}</span>
            <span class="pv-tally">
              {`${total} PAPERS · ${drawers.length} DRAWER${drawers.length === 1 ? "" : "S"}`}
            </span>
          </div>

          <div class="pvd-stack">
            {drawers.length === 0 && (
              <div class="pv-empty">
                nothing tagged #{[].concat(tag).join(" / #")}
              </div>
            )}
            {drawers.map((d) => (
              <Drawer
                key={d.id}
                drawer={d}
                open={d.id === open}
                depth={depth}
                leaves={leaves}
                flat={flat}
                perRow={perRow}
                collapsed={collapsed}
                step={step}
                queue={live}
                flying={fly}
                onOpen={() => setOpen(d.id)}
                onShut={() => setOpen(null)}
                onQueue={toQueue}
                onRead={read}
                onDissolve={toPile}
              />
            ))}
          </div>

          {/* ── the corner: what is waiting, and what was pushed aside ──── */}
          <div class="pvd-corner">
            <div
              class={"pvd-pile" + (livePile.length ? " is-live" : "")}
              onClick={() => livePile.length && setFanOpen(true)}
              title={livePile.length ? `${livePile.length} dissolved` : "nothing dissolved"}
            >
              <span
                class="pvd-pile-edges"
                style={{ "--edge-h": `${livePile.length ? Math.min(3 + livePile.length * 3, 22) : 3}px` }}
              />
              <span class="pvd-corner-label">DISSOLVED {livePile.length}</span>
            </div>
            <div class="pvd-tray-btn" onClick={() => setQueueOpen(true)} title="the reading queue">
              <div class="pvd-tray-leaves">
                {live.slice(0, 5).map((id, i) => (
                  <span key={id} class="pvd-tray-leaf" style={{ "--w": `${44 - i * 4}px`, "--o": 0.9 - i * 0.13 }} />
                ))}
              </div>
              <span class="pvd-corner-label is-bright">QUEUE {live.length}</span>
            </div>
          </div>

          {/* ── the dissolved pile, fanned out ─────────────────────────── */}
          {fanOpen && livePile.length > 0 && (
            <div class="pvd-veil is-fan" onClick={() => setFanOpen(false)}>
              <div class="pvd-fan" onClick={(e) => e.stopPropagation()}>
                <span class="pvd-veil-title">DISSOLVED</span>
                <div class="pvd-fan-row">
                  {livePile.slice(0, 7).map((id, i, arr) => {
                    const p = byId[id];
                    return (
                      <div
                        key={id}
                        class="pvd-fan-card"
                        style={{ "--rot": `${((i - (arr.length - 1) / 2) * 4.5).toFixed(1)}deg` }}
                        onClick={() => revive(id)}
                        title={p.title}
                      >
                        <span class="pvd-fan-year">{p.year ?? "—"}</span>
                        <i class="pvd-fan-rule" />
                        <span class="pvd-fan-title">{p.title}</span>
                        <i class="pvd-grow" />
                        <span class="pvd-fan-foot">{footOf(p)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── the reading queue ──────────────────────────────────────── */}
          {queueOpen && (
            <div
              class="pvd-veil is-queue"
              onClick={() => setQueueOpen(false)}
              onWheel={(e) => {
                if (!live.length) return;
                e.preventDefault();
                setQi((i) => (i + (e.deltaY > 0 ? 1 : -1) + live.length) % live.length);
              }}
            >
              <div class="pvd-veil-head" onClick={(e) => e.stopPropagation()}>
                <span class="pvd-veil-title">THE READING QUEUE</span>
                <i class="pv-sep" />
                <span class="pvd-veil-pos">
                  {live.length ? `${qi + 1} of ${live.length}` : "the queue is empty"}
                </span>
              </div>

              {live.length > 0 ? (
                <div class="pvd-stackbox" onClick={(e) => e.stopPropagation()}>
                  {stack.map(({ id, i, paper }) => (
                    <div
                      key={id}
                      class="pvd-qwrap"
                      style={{
                        "--i": i,
                        zIndex: 40 - i,
                        animation: dissolving === id
                          ? "pvFlyLeft .42s cubic-bezier(.3,.1,.6,1) both" : "none",
                        pointerEvents: i === 0 ? "auto" : "none",
                      }}
                    >
                      <div
                        class="pvd-qcard"
                        title={`${paper.title}\nclick · read   right-click · dissolve`}
                        onClick={() => read(id)}
                        onContextMenu={(e) => { e.preventDefault(); toPile(id, "queue"); }}
                      >
                        {/* No page image here. A card put a rasterised page in
                            a 520px box, which is a thumbnail of a thumbnail,
                            and it pushed the pip and the venue out of line to
                            make room. The card is a card; the page is what you
                            get when you open it. */}
                        <div class="pvd-qtop">
                          <span class="pvd-qvenue">
                            {[paper.venue, paper.year].filter(Boolean).join(" · ")}
                          </span>
                          <i class="pv-rule" />
                          <Pip paper={paper} size={16} />
                        </div>
                        <span class="pvd-qtitle">{paper.title}</span>
                        <span class="pvd-qauthors">{paper.authorsFull}</span>
                        {paper.affiliationLine && (
                          <span class="pvd-qaffil">{paper.affiliationLine}</span>
                        )}
                        <i class="pvd-grow" />
                        <span class="pvd-qfoot">{footOf(paper)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div class="pvd-qempty" onClick={(e) => e.stopPropagation()}>
                  <span class="pvd-veil-title">QUEUE CLEAR</span>
                  {seen.length > 0 && (
                    <div class="pv-cards">
                      {seen.slice(0, 5).filter((id) => byId[id]).map((id) => (
                        <div key={id} class="pv-mini" onClick={() => revive(id)}>
                          <span class="pv-mini-t">{byId[id].title}</span>
                          <span class="pv-mini-f">{footOf(byId[id])}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <button class="pv-open" onClick={() => { setQueue(unreadOf(papers, queueSize)); setQi(0); }}>
                    REFILL FROM UNREAD
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── one paper, open ────────────────────────────────────────── */}
          {current && (
            <ReadingPanel
              paper={current}
              related={related}
              stain={readingStain}
              queued={live}
              onQueue={toQueue}
              onClose={() => setReading(null)}
              onPick={(id) => read(id)}
            />
          )}
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  <DrawerStyles /> — everything only the chest needs.
//  The palette, the reading panel and the shared ornaments live in core.jsx;
//  this is the furniture.
// ════════════════════════════════════════════════════════════════════════════
const STYLE_ID = "paper-drawers-datacore-styles";

const CSS = `
/* ── the stack of drawers ─────────────────────────────────────────────── */
.pvd-stack {
  flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain;
  padding: 24px 30px 104px; display: flex; flex-direction: column; gap: 12px;
  perspective: 1700px; perspective-origin: 50% 26%;
}
/* THE DRAWER IS NOT A preserve-3d CONTEXT, and this is the reason clicking a
   leaf did nothing for three rounds.
   Inside a preserve-3d subtree Chromium hit-tests against the flattening
   plane, and every descendant that gets its own composited layer — a leaf has
   a transform, a filter and a running animation, so it gets three reasons —
   drops out of the hit test. elementFromPoint over the whole face of a leaf
   returned .pvd-row, its grandparent, which has no handler on it: the click
   was landing on the tray behind the paper. elementsFromPoint still listed the
   leaf, which is what made this look impossible; that call penetrates, and a
   real pointer does not.
   The 3D is kept where it is actually wanted — perspective here so the flap
   folds on a hinge, translateZ from the stack's perspective so an open drawer
   comes forward — and neither of those needs the children flattened together. */
.pvd-drawer {
  perspective: 1400px; transform: translateZ(0); filter: brightness(.96);
}
.pvd-drawer.is-open { transform: translateZ(var(--drop)); filter: none; }
.pv.has-motion .pvd-drawer { transition: transform .4s cubic-bezier(.22,.8,.28,1), filter .3s; }

/* ── shut: the drawer front ───────────────────────────────────────────── */
.pvd-front {
  position: relative; display: flex; align-items: center; gap: 15px;
  padding: 13px 18px; cursor: pointer; background-image: var(--pv-front);
  border: 1px solid var(--pv-line);
}
.pv.medieval .pvd-front {
  border-radius: 2px;
  box-shadow: 0 3px 8px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,232,186,.08);
}
.pv.deco .pvd-front {
  padding: 13px 20px; gap: 16px;
  box-shadow: inset 0 0 0 4px #141330, inset 0 0 0 5px rgba(227,194,74,.14);
}

.pvd-numeral {
  flex: none; width: 32px; height: 32px; display: flex; align-items: center;
  justify-content: center; border-radius: 50%;
  background: radial-gradient(60% 60% at 34% 28%,#f0d69a,#a9832f 62%,#6d5119 100%);
  box-shadow: inset 0 1px 1px rgba(255,248,224,.7), 0 2px 4px rgba(0,0,0,.45);
  font-family: var(--pv-display); font-weight: 500; font-size: 11.5px; line-height: 1;
  color: #2a1d08;
}
.pv.deco .pvd-numeral { display: none; }

/* the deco drawer tag: a hanging flag with the index on it */
.pvd-flag {
  position: relative; flex: none; width: 26px; height: 36px; display: none;
  align-items: flex-start; justify-content: center; padding-top: 5px;
  font-family: var(--pv-mono); font-size: 11px; line-height: 1; letter-spacing: .06em;
  color: var(--pv-gold);
}
.pvd-flag::before {
  content: ""; position: absolute; inset: 0; background: var(--pv-gold); opacity: .7;
  -webkit-mask-image: var(--ad-flag); -webkit-mask-size: 100% 100%; -webkit-mask-repeat: no-repeat;
}
.pv.deco .pvd-flag { display: flex; }

/* the engraved label plate: a gilt frame around a cream ground */
.pvd-plate {
  flex: 1; min-width: 0; display: flex; align-items: baseline; gap: 13px;
  padding: 9px 15px 10px;
}
.pv.medieval .pvd-plate {
  border: 2px solid transparent; border-radius: 2px;
  background:
    linear-gradient(178deg,#f3e6c8,#e6d4ae) padding-box,
    linear-gradient(180deg,#d9b96e,#9a7526) border-box;
  box-shadow: 0 2px 5px rgba(0,0,0,.4);
}
.pv.deco .pvd-plate { padding: 0; gap: 14px; background: none; }
.pvd-plate-label {
  flex: none; font-family: var(--pv-display); font-weight: 500; font-size: 17px;
  line-height: 1.2; letter-spacing: var(--pv-tab);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.pv.medieval .pvd-plate-label { color: #2a1d10; }
.pv.deco .pvd-plate-label { font-weight: 400; font-size: 16px; color: #f0e9d8; }
.pvd-plate-rule { flex: 1; height: 1px; background: rgba(42,29,16,.22); }
.pv.deco .pvd-plate-rule {
  height: 12px; background: var(--pv-line);
  -webkit-mask-image: linear-gradient(to right,transparent 26px,#000 26px,#000 calc(100% - 26px),transparent calc(100% - 26px)),
    var(--ad-hrl),var(--ad-hrr);
  -webkit-mask-size: 100% 1px,26px 12px,26px 12px;
  -webkit-mask-position: center,left center,right center; -webkit-mask-repeat: no-repeat;
  align-self: center;
}
.pvd-plate-tag { flex: none; font-family: var(--pv-mono); font-size: 11px; letter-spacing: .1em; }
.pv.medieval .pvd-plate-tag { color: rgba(42,29,16,.6); }
.pv.deco .pvd-plate-tag { color: var(--pv-gold); }
.pvd-plate-count {
  flex: none; font-family: var(--pv-display); font-weight: 500; font-size: 12px;
  letter-spacing: .08em;
}
.pv.medieval .pvd-plate-count { color: rgba(42,29,16,.72); }
.pv.deco .pvd-plate-count { font-family: var(--pv-mono); color: rgba(240,233,216,.5); letter-spacing: .16em; }

.pvd-handle {
  flex: none; width: 66px; height: 12px; border-radius: 7px;
  background: linear-gradient(180deg,#e2c37c,#8d6a20);
  box-shadow: 0 2px 4px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,250,228,.7);
}
.pv.deco .pvd-handle {
  width: 54px; height: 8px; border-radius: 0; background: var(--pv-gold); opacity: .55;
  box-shadow: none; clip-path: polygon(8px 0,46px 0,54px 8px,0 8px);
}

/* ── open: the well ───────────────────────────────────────────────────── */
.pvd-well {
  position: relative; background-image: var(--pv-well);
  border: 1px solid var(--pv-line); border-radius: 2px 2px 0 0;
  box-shadow: inset 0 18px 30px rgba(0,0,0,.72);
}
.pv.deco .pvd-well { border-radius: 0; box-shadow: inset 0 16px 28px rgba(0,0,0,.7); }
/* head and flap are the drawer's own woodwork, and both shut it */
.pvd-well-head { display: flex; align-items: center; gap: 12px; padding: 14px 22px 10px; cursor: pointer; }
.pvd-well-head:hover .pvd-well-label { color: var(--pv-cream); }
.pvd-flap { cursor: pointer; }
.pvd-well-label {
  flex: none; font-family: var(--pv-display); font-weight: 500; font-size: 11px;
  line-height: 1; letter-spacing: .2em; color: var(--pv-gold);
}
.pv.deco .pvd-well-label { font-weight: 400; font-size: 14px; color: #f0e9d8; }
.pvd-well-tag, .pvd-well-rows, .pvd-well-count {
  flex: none; font-family: var(--pv-mono); font-size: 10px; letter-spacing: .12em;
  color: var(--pv-gold-dim);
}
.pv.deco .pvd-well-tag { color: var(--pv-gold); }
.pvd-well-count { color: var(--pv-cream-dim); }
.pvd-step {
  flex: none; cursor: pointer; padding: 6px 9px; background: rgba(0,0,0,.24);
  border: 1px solid var(--pv-line); color: var(--pv-cream-dim);
  font-family: var(--pv-mono); font-size: 9.5px; line-height: 1;
}
.pvd-step:hover { background: rgba(0,0,0,.42); color: var(--pv-cream); }
.pv.deco .pvd-step { background: transparent; color: var(--pv-gold); }
.pv.deco .pvd-step:hover { background: rgba(227,194,74,.14); }

/* the tray of leaves, snapping row by row */
.pvd-tray {
  height: 290px; overflow-y: auto; scroll-snap-type: y mandatory;
  padding: 6px 22px 10px; display: flex; flex-direction: column; gap: 18px;
}
.pv.deco .pvd-tray { height: 242px; padding: 4px 20px 12px; gap: 16px; }
.pvd-row { flex: none; scroll-snap-align: start; display: flex; gap: 18px; }
.pv.deco .pvd-row { gap: 16px; }

.pvd-list { max-height: 430px; overflow-y: auto; padding: 0 22px 6px;
  display: flex; flex-direction: column; gap: 5px; }
.pv.deco .pvd-list { max-height: 400px; padding: 0 20px 8px; }

.pvd-more { display: flex; align-items: center; gap: 12px; padding: 8px 22px 14px; }
.pvd-more span { flex: none; font-family: var(--pv-mono); font-size: 9.5px;
  letter-spacing: .12em; color: var(--pv-gold-dim); opacity: .8; }

/* ── the front, dropped on its hinge ──────────────────────────────────── */
.pvd-flap {
  display: flex; align-items: center; gap: 13px; padding: 5px 18px 7px;
  transform-origin: top center; transform: rotateX(-74deg);
  background-image: var(--pv-front); border: 1px solid var(--pv-line); border-top: none;
  box-shadow: 0 18px 26px rgba(0,0,0,.5);
}
.pv.deco .pvd-flap { padding: 11px 16px; gap: 14px; }
.pv.has-motion .pvd-flap { transition: transform .42s cubic-bezier(.22,.8,.28,1); }
.pvd-flap-idx { font-family: var(--pv-mono); font-size: 10px; letter-spacing: .16em;
  color: var(--pv-cream-dim); }
.pvd-flap-label { font-family: var(--pv-display); font-size: 14px; line-height: 1.2;
  letter-spacing: var(--pv-tab); color: #f0e9d8; }
.pv.medieval .pvd-flap-label { font-size: 16px; font-weight: 500; }
.pvd-flap-tag { font-family: var(--pv-mono); font-size: 10px; letter-spacing: .1em;
  color: var(--pv-gold); }
.pvd-flap-rule { flex: 1; height: 1px; background: var(--pv-line-soft); }

/* ════ one leaf ═══════════════════════════════════════════════════════════ */
.pvd-leaf-wrap { flex: none; }
.pvd-leaf {
  position: relative; width: 198px; height: 250px; box-sizing: border-box;
  cursor: pointer; transform: rotate(var(--tilt));
}
.pv.has-motion .pvd-leaf {
  transition: transform .26s cubic-bezier(.22,.8,.28,1), filter .26s,
    border-color .22s, box-shadow .22s;
}
.pvd-grow { flex: 1; }
.pvd-tiny { width: 7px !important; height: 7px !important; }
/* Anything printed on paper inherits the paper's own inks. The pip reads
   --pv-gold and --pv-track, and #d9b96e on cream is a ring you cannot see; the
   values below are the ones the study used on its cream cards. Re-pointing the
   variables beats writing the pip four more times. */
.pv.medieval .pvd-leaf, .pv.medieval .pvd-line,
.pv.medieval .pvd-qcard, .pv.medieval .pvd-fan-card {
  --pv-gold: #a9832f; --pv-track: rgba(42,29,16,.2); --pv-line: rgba(42,29,16,.28);
}

/* — scriptorium: a torn sheet — */
/* which face this leaf wears. One variable, two values, named in the props. */
.pv.medieval .pvd-leaf { --pv-leaf: var(--pv-leaf-scroll); }
.pv.medieval .pvd-leaf.is-flat { --pv-leaf: var(--pv-leaf-sheet); }
.pv.medieval .pvd-leaf { filter: drop-shadow(0 7px 11px rgba(0,0,0,.55)); }
.pv.medieval .pvd-leaf:hover {
  transform: translateY(-14px) rotate(0deg);
  filter: drop-shadow(0 16px 20px rgba(0,0,0,.6)) brightness(1.03);
}
/* The leaf face IS the mask: the same photographed sheet supplies the paper's
   fibre and its torn outline, which is why the two agree. --pv-leaf is set per
   leaf style, so a whole tray changes face by swapping one variable.
   Alternate leaves are mirrored, exactly as the study does it, so five sheets
   in a row are not five prints of the same tear. */
.pv.medieval .pvd-leaf-paper {
  position: absolute; inset: 0; pointer-events: none;
  background:
    repeating-linear-gradient(180deg,rgba(90,58,32,0) 0 20px,rgba(90,58,32,.1) 20px 21px),
    var(--pv-leaf);
  background-size: 100% 100%, 100% 100%; background-repeat: no-repeat, no-repeat;
  -webkit-mask-image: var(--pv-leaf); -webkit-mask-size: 100% 100%; -webkit-mask-repeat: no-repeat;
  mask-image: var(--pv-leaf); mask-size: 100% 100%; mask-repeat: no-repeat;
  transform: translateZ(0);
}
.pv.medieval .pvd-leaf-wrap:nth-child(even) .pvd-leaf-paper { transform: scaleX(-1) translateZ(0); }
/* a light foxing stain, clipped to the sheet it is on */
.pv.medieval .pvd-leaf-stain {
  position: absolute; inset: 0; pointer-events: none;
  -webkit-mask-image: var(--pv-leaf); -webkit-mask-size: 100% 100%; -webkit-mask-repeat: no-repeat;
  mask-image: var(--pv-leaf); mask-size: 100% 100%; mask-repeat: no-repeat;
}
.pv.medieval .pvd-leaf-stain::before {
  content: ""; position: absolute; right: 2px; bottom: 9px; width: 84px; height: 78px;
  opacity: .85; transform: rotate(-13deg);
  background:
    radial-gradient(closest-side circle at 50% 50%,rgba(122,74,32,0) 58%,rgba(122,74,32,.3) 65%,
      rgba(86,46,14,.68) 73%,rgba(110,64,24,.34) 83%,rgba(122,74,32,0) 93%),
    radial-gradient(closest-side circle at 50% 50%,rgba(140,96,48,.14) 0 56%,rgba(140,96,48,0) 60%);
  -webkit-mask-image: conic-gradient(from 24deg,#000 0 12%,rgba(0,0,0,.28) 20%,#000 34%,
    rgba(0,0,0,.46) 52%,#000 68%,rgba(0,0,0,.32) 82%,#000 100%);
}
.pv.medieval .pvd-leaf-stain::after {
  content: ""; position: absolute; right: 12px; bottom: 2px; width: 9px; height: 8px;
  border-radius: 50%; opacity: .5;
  background: radial-gradient(closest-side circle,rgba(88,48,16,.52),rgba(92,52,18,0));
}
/* the rubric: the red rule a scribe ruled the margin with, and its hairline */
.pv.medieval .pvd-leaf-rubric {
  position: absolute; left: 15px; top: 32px; bottom: 16px; width: 3px; pointer-events: none;
  background: linear-gradient(180deg,#8d2f26,#5f1f18); opacity: .88;
}
.pv.medieval .pvd-leaf-rubric::after {
  content: ""; position: absolute; left: 8px; top: -3px; bottom: -4px; width: 1px;
  background: rgba(141,47,38,.22);
}
.pv.medieval .pvd-leaf.is-flat .pvd-leaf-rubric { top: 14px; bottom: 14px; left: 11px; }
.pv.medieval .pvd-leaf-body { padding: 31px 17px 16px 30px; }
.pv.medieval .pvd-leaf.is-flat .pvd-leaf-body { padding: 20px 17px 16px 26px; }
.pv.medieval .pvd-leaf-fanlet, .pv.medieval .pvd-leaf-inner,
.pv.medieval .pvd-leaf-corners, .pv.medieval .pvd-leaf-hr { display: none; }

/* — art deco: a lacquered card — */
.pv.deco .pvd-leaf {
  width: 198px; height: 200px; overflow: hidden;
  background:
    radial-gradient(115% 78% at 50% 0,rgba(227,194,74,.12),rgba(227,194,74,0) 62%),
    linear-gradient(178deg,#1f1d4e,#131228);
  border: 1px solid rgba(227,194,74,.34); box-shadow: 0 7px 16px rgba(0,0,0,.45);
  transform: rotate(calc(var(--tilt) * .4));
}
.pv.deco .pvd-leaf:hover {
  transform: translateY(-9px); border-color: rgba(227,194,74,.72);
  box-shadow: 0 18px 30px rgba(0,0,0,.6);
}
.pv.deco .pvd-leaf-paper, .pv.deco .pvd-leaf-rubric { display: none; }
.pv.deco .pvd-leaf-stain {
  position: absolute; right: -10px; bottom: 10px; width: 86px; height: 80px;
  pointer-events: none; opacity: .26; mix-blend-mode: screen; transform: rotate(-9deg);
  background: radial-gradient(closest-side circle at 50% 50%,rgba(227,194,74,0) 61%,
    rgba(227,194,74,.32) 70%,rgba(244,220,132,.5) 76%,rgba(227,194,74,.18) 86%,rgba(227,194,74,0) 95%);
  -webkit-mask-image: conic-gradient(from 40deg,#000 0 16%,rgba(0,0,0,.24) 26%,#000 44%,
    rgba(0,0,0,.4) 60%,#000 78%,rgba(0,0,0,.3) 90%,#000 100%);
}
.pv.deco .pvd-leaf-fanlet {
  position: absolute; right: -12px; bottom: -20px; width: 98px; height: 98px;
  background: var(--pv-gold); opacity: .1; transform: rotate(180deg); pointer-events: none;
  -webkit-mask-image: var(--ad-fan); -webkit-mask-size: contain; -webkit-mask-repeat: no-repeat;
}
.pv.deco .pvd-leaf-inner {
  position: absolute; inset: 4px; pointer-events: none; border: 1px solid rgba(227,194,74,.15);
}
.pv.deco .pvd-leaf-corners {
  position: absolute; inset: 7px; pointer-events: none; background: rgba(227,194,74,.55);
  -webkit-mask-image: var(--ad-bl),var(--ad-br);
  -webkit-mask-size: 18px 18px,18px 18px;
  -webkit-mask-position: left bottom,right bottom; -webkit-mask-repeat: no-repeat;
}
.pv.deco .pvd-leaf-body { padding: 8px 13px 12px; }

.pvd-leaf-body {
  position: relative; height: 100%; box-sizing: border-box;
  display: flex; flex-direction: column; gap: 8px;
}
.pv.deco .pvd-leaf-body { gap: 7px; }
.pvd-leaf-top { display: flex; align-items: center; gap: 8px; }
.pv.deco .pvd-leaf-top {
  margin: -8px -13px 0; padding: 8px 13px 7px;
  background: linear-gradient(180deg,rgba(227,194,74,.16),rgba(227,194,74,.02));
  border-bottom: 1px solid rgba(227,194,74,.3);
}
.pvd-year { font-family: var(--pv-mono); font-weight: 500; font-size: 10px; line-height: 1;
  letter-spacing: .14em; color: var(--pv-accent); }
.pv.deco .pvd-year { font-weight: 400; letter-spacing: .2em; color: var(--pv-gold); }
.pvd-leaf-hr { flex: none; height: 9px; }

/* Three lines of title, one of affiliation. A leaf is 250px of paper and the
   things on it are in priority order — clamping is what keeps a paper with a
   long title and six labs from pushing its own venue off the bottom. */
.pvd-leaf-title {
  font-size: 15px; line-height: 1.42; font-weight: 500; text-wrap: pretty;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.pv.medieval .pvd-leaf-title { color: #2a1d10; }
.pv.deco .pvd-leaf-title { font-weight: 400; font-size: 13.5px; line-height: 1.46; color: #f4eddc;
  -webkit-line-clamp: 3; }
.pvd-leaf-authors {
  font-size: 12px; line-height: 1.5;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.pv.medieval .pvd-leaf-authors { font-style: italic; color: rgba(42,29,16,.62); }
.pv.deco .pvd-leaf-authors { font-size: 10.5px; line-height: 1.4; color: rgba(240,233,216,.52); }
.pvd-leaf-affil {
  margin-top: -4px; font-size: 10px; line-height: 1.35;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.pv.medieval .pvd-leaf-affil { color: rgba(42,29,16,.44); }
.pv.deco .pvd-leaf-affil { font-size: 9.5px; color: rgba(240,233,216,.36); }
.pvd-leaf-foot { display: flex; align-items: center; gap: 7px;
  font-family: var(--pv-mono); font-size: 9px; line-height: 1.4; letter-spacing: .07em; }
.pv.medieval .pvd-leaf-foot { color: rgba(42,29,16,.5); }
.pv.deco .pvd-leaf-foot { letter-spacing: .14em; color: rgba(227,194,74,.55); }

/* the stamp: struck at an angle, and multiplied into the paper under it */
.pvd-stamp {
  align-self: flex-end; transform: rotate(-8deg); mix-blend-mode: multiply;
  font-family: var(--pv-mono); font-weight: 500; font-size: 9px; line-height: 1;
  letter-spacing: .22em; color: rgba(141,47,38,.74);
  border: 2px double rgba(141,47,38,.5); padding: 5px 7px 4px 9px;
}
.pv.deco .pvd-stamp {
  align-self: flex-start; transform: none; mix-blend-mode: normal; font-weight: 400;
  font-size: 8.5px; letter-spacing: .18em; color: var(--pv-gold);
  border: 1px solid rgba(227,194,74,.42); padding: 4px 6px;
}
.pvd-stamp.is-inline { align-self: center; transform: none; flex: none; font-size: 8.5px;
  letter-spacing: .1em; border-width: 1px; padding: 4px 6px; }

/* ════ one line, for drawerContents="rows" ═══════════════════════════════ */
.pvd-line {
  display: flex; align-items: center; gap: 14px; cursor: pointer; padding: 11px 14px;
  border: 1px solid rgba(90,58,32,.3); border-left: 4px solid var(--pv-accent);
  background: linear-gradient(178deg,#f6ecd3,#ece2c6); color: #2a1d10;
  transition: background .18s, border-color .18s;
}
.pvd-line:hover { background: linear-gradient(178deg,#fbf3df,#f0e6ca); border-color: rgba(141,47,38,.45); }
.pv.deco .pvd-line {
  gap: 13px; background: #16153a; color: #f0e9d8;
  border: 1px solid rgba(227,194,74,.2); border-left: 3px solid var(--pv-gold);
}
.pv.deco .pvd-line:hover { background: #1d1c46; border-color: rgba(227,194,74,.55); }
.pvd-line-year { flex: none; width: 44px; font-family: var(--pv-mono); font-size: 11px;
  line-height: 1; letter-spacing: .1em; color: var(--pv-accent); }
.pv.deco .pvd-line-year { color: var(--pv-gold); letter-spacing: .12em; }
.pvd-line-title { flex: 1; min-width: 0; font-size: 15px; line-height: 1.42; font-weight: 500;
  text-wrap: pretty; }
.pv.deco .pvd-line-title { font-weight: 400; font-size: 14px; }
/* names on top, lab underneath — one cell, two lines, both clipped */
.pvd-line-authors { flex: none; width: 186px; display: flex; flex-direction: column; }
.pvd-line-authors b, .pvd-line-authors i {
  display: block; font-size: 12px; line-height: 1.4; font-weight: 400;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.pvd-line-authors i { font-size: 10px; font-style: normal; opacity: .68; }
.pv.medieval .pvd-line-authors b { font-style: italic; color: rgba(42,29,16,.6); }
.pv.medieval .pvd-line-authors i { color: rgba(42,29,16,.5); }
.pv.deco .pvd-line-authors { width: 180px; }
.pv.deco .pvd-line-authors b { font-size: 11.5px; color: rgba(240,233,216,.5); }
.pv.deco .pvd-line-authors i { color: rgba(240,233,216,.4); }
.pvd-line-foot { flex: none; width: 118px; text-align: right; font-family: var(--pv-mono);
  font-size: 9.5px; line-height: 1.4; letter-spacing: .06em; }
.pv.medieval .pvd-line-foot { color: rgba(42,29,16,.5); }
.pv.deco .pvd-line-foot { letter-spacing: .12em; color: rgba(227,194,74,.5); }

/* ════ the corner ═══════════════════════════════════════════════════════ */
.pvd-corner {
  position: absolute; left: 26px; bottom: 22px; z-index: 20;
  display: flex; align-items: flex-end; gap: 16px;
}
.pvd-pile, .pvd-tray-btn {
  display: flex; flex-direction: column; gap: 7px; align-items: flex-start;
  padding: 10px 12px; border-radius: 2px; cursor: default;
}
.pvd-pile { border: 1px dashed var(--pv-line); background: rgba(28,20,16,.6); }
.pv.deco .pvd-pile { background: rgba(14,13,32,.78); }
.pvd-pile.is-live { cursor: pointer; }
.pvd-tray-btn { cursor: pointer; border: 1px solid var(--pv-line); background: rgba(36,26,18,.75); }
.pv.deco .pvd-tray-btn { background: rgba(22,21,58,.9); }
.pvd-pile-edges {
  display: block; width: 46px; border-radius: 2px; height: var(--edge-h);
  background: rgba(217,185,110,.2);
}
.pvd-pile.is-live .pvd-pile-edges {
  background: repeating-linear-gradient(180deg,#e6d4ae 0 2px,#b99a5e 2px 3px);
}
.pv.deco .pvd-pile.is-live .pvd-pile-edges {
  background: repeating-linear-gradient(180deg,rgba(227,194,74,.7) 0 2px,rgba(227,194,74,.2) 2px 3px);
}
.pvd-tray-leaves { display: flex; flex-direction: column; gap: 2px; min-height: 22px;
  justify-content: flex-end; }
.pvd-tray-leaf { display: block; height: 3px; border-radius: 1px; width: var(--w);
  background: linear-gradient(90deg,#f3e6c8,#c8a75c); opacity: var(--o); }
.pv.deco .pvd-tray-leaf { background: var(--pv-gold); }
.pvd-corner-label { font-family: var(--pv-mono); font-size: 8.5px; letter-spacing: .13em;
  color: var(--pv-cream-dim); }
.pvd-corner-label.is-bright { color: var(--pv-gold); }

/* ════ the two overlays ═════════════════════════════════════════════════ */
.pvd-veil {
  position: absolute; inset: 0; z-index: 60; background: var(--pv-veil);
  backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px);
  animation: pvFade .22s ease both;
}
.pvd-veil.is-fan { z-index: 70; display: flex; align-items: flex-end; padding: 0 0 30px 30px; }
.pvd-veil.is-queue { display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 26px; }
.pvd-veil-title {
  font-family: var(--pv-display); font-weight: 500; font-size: 12px; line-height: 1;
  letter-spacing: .22em; color: var(--pv-gold);
}
.pv.deco .pvd-veil-title { font-weight: 400; font-size: 13px; letter-spacing: .26em; }
.pvd-veil-head { display: flex; align-items: center; gap: 14px; }
.pvd-veil-pos { font-family: var(--pv-mono); font-size: 10px; letter-spacing: .14em;
  color: var(--pv-cream-dim); }

.pvd-fan { display: flex; flex-direction: column; gap: 14px; }
.pvd-fan-row { display: flex; align-items: flex-end; gap: 12px; }
.pvd-fan-card {
  position: relative; flex: none; width: 172px; height: 208px; cursor: pointer;
  box-sizing: border-box; padding: 15px 15px 13px; display: flex; flex-direction: column; gap: 8px;
  background: var(--pv-paper); border: 1px solid var(--pv-line);
  box-shadow: 0 14px 26px rgba(0,0,0,.5);
  transform: rotate(var(--rot)); transform-origin: bottom center;
  transition: transform .24s cubic-bezier(.22,.8,.28,1), border-color .2s;
}
.pv.medieval .pvd-fan-card { border-color: rgba(90,58,32,.4); border-left: 4px solid var(--pv-accent); }
.pv.deco .pvd-fan-card { background: linear-gradient(178deg,#1b1a42,#141330); }
.pvd-fan-card:hover { transform: translateY(-14px) rotate(0deg); border-color: var(--pv-gold); }
.pvd-fan-rule { flex: none; height: 1px; background: var(--pv-line-soft); }
.pvd-fan-year { font-family: var(--pv-mono); font-weight: 500; font-size: 9.5px; line-height: 1;
  letter-spacing: .14em; color: var(--pv-accent); }
.pv.deco .pvd-fan-year { font-weight: 400; letter-spacing: .16em; color: var(--pv-gold); }
.pvd-fan-title { font-size: 13.5px; line-height: 1.4; text-wrap: pretty; }
.pv.medieval .pvd-fan-title { color: #2a1d10; }
.pv.deco .pvd-fan-title { font-size: 13px; line-height: 1.44; color: #f0e9d8; }
.pvd-fan-foot { font-family: var(--pv-mono); font-size: 8.5px; letter-spacing: .12em; }
.pv.medieval .pvd-fan-foot { color: rgba(42,29,16,.5); }
.pv.deco .pvd-fan-foot { color: rgba(240,233,216,.45); }

/* the queue, as a stack you look down onto — the study's size, which was right */
.pvd-stackbox { position: relative; width: 520px; height: 330px; }
.pvd-qwrap {
  position: absolute; inset: 0;
  transform: translateY(calc(var(--i) * -13px)) scale(calc(1 - var(--i) * .045));
  transition: transform .34s cubic-bezier(.22,.8,.28,1);
}
.pvd-qcard {
  position: relative; height: 100%; box-sizing: border-box; cursor: pointer;
  padding: 26px 28px 22px 34px; display: flex; flex-direction: column; gap: 11px;
  background: var(--pv-paper); border: 1px solid var(--pv-line);
  box-shadow: 0 22px 42px rgba(0,0,0,.55);
}
.pv.medieval .pvd-qcard {
  border-color: rgba(90,58,32,.4); color: var(--pv-ink);
  border-left: 6px solid transparent;
  background:
    linear-gradient(178deg,#f6ecd3,#e9dcbd) padding-box,
    linear-gradient(180deg,#8d2f26,#5f1f18) border-box;
}
.pv.deco .pvd-qcard {
  padding: 26px 30px 22px; background: linear-gradient(178deg,#1b1a42,#141330);
  outline: 1px solid rgba(227,194,74,.3); outline-offset: -5px;
}
.pvd-qwrap:not(:first-child) .pvd-qcard { box-shadow: 0 10px 20px rgba(0,0,0,.4); filter: brightness(.9); }
.pvd-qtop { display: flex; align-items: center; gap: 10px; }
.pvd-qvenue { flex: none; font-family: var(--pv-mono); font-size: 10px; line-height: 1;
  letter-spacing: .15em; color: var(--pv-accent); }
.pv.deco .pvd-qvenue { letter-spacing: .2em; color: var(--pv-gold); }
.pvd-qtitle { font-size: 23px; line-height: 1.32; font-weight: 500; text-wrap: pretty; }
.pv.medieval .pvd-qtitle { color: #22170d; }
.pv.deco .pvd-qtitle { font-weight: 400; font-size: 22px; line-height: 1.34; color: #f4eedd; }
.pvd-qauthors { font-size: 13px; line-height: 1.5; }
.pv.medieval .pvd-qauthors { font-style: italic; color: rgba(42,29,16,.64); }
.pv.deco .pvd-qauthors { color: rgba(240,233,216,.58); }
.pvd-qaffil { font-size: 11.5px; line-height: 1.45; }
.pv.medieval .pvd-qaffil { color: rgba(42,29,16,.46); }
.pv.deco .pvd-qaffil { color: rgba(240,233,216,.4); }
.pvd-qfoot { font-family: var(--pv-mono); font-size: 9px; letter-spacing: .13em; }
.pv.medieval .pvd-qfoot { color: rgba(42,29,16,.44); }
.pv.deco .pvd-qfoot { color: rgba(227,194,74,.5); }

.pvd-qempty {
  width: 460px; box-sizing: border-box; padding: 30px 32px 32px;
  display: flex; flex-direction: column; gap: 16px;
  background: var(--pv-paper-flat); border: 1px solid var(--pv-line);
}
.pv.medieval .pvd-qempty { color: var(--pv-ink); }
.pv.deco .pvd-qempty { background: #16153a; }
.pvd-qempty .pv-open { align-self: flex-start; padding: 10px 16px; }

/* motion off means motion off, everywhere in the chest */
.pv.no-motion .pvd-drawer, .pv.no-motion .pvd-flap, .pv.no-motion .pvd-leaf,
.pv.no-motion .pvd-qwrap, .pv.no-motion .pvd-fan-card { transition: none; }
.pv.no-motion .pvd-leaf-wrap, .pv.no-motion .pvd-line-wrap { animation: none !important; }
`;

function DrawerStyles() {
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

return {
  Drawers, Chest, DrawerStyles, Leaf, Line, Drawer,
  LEAF_TILT, ROW_STEP, LEAF_FACES, faceOf,
};
