// ════════════════════════════════════════════════════════════════════════════
//  views.jsx  —  three other ways into the same papers
//  Location: Meta/Obsidian/_datacore/paper/views.jsx
//
//  The chest of drawers answers "what have I got, by topic". These answer the
//  questions it cannot:
//
//    <Constellation/>   what cites what. Topics are clusters, node size is how
//                       often a paper has been cited, and an edge is a relation
//                       you actually wrote down in frontmatter.
//    <Pinboard/>        a board you arrange by hand. Drag the cards where they
//                       belong to you; string joins the ones sharing a topic.
//    <ContactSheet/>    every first page at once. The one view where you find
//                       a paper by recognising it rather than by reading it.
//
//  Each takes over its own note:
//
//    ```datacorejsx
//    const { Constellation } = await dc.require("Meta/Obsidian/_datacore/paper/views.jsx");
//    return function View() {
//      return <Constellation
//        design="art deco"
//        tag={["paper"]}
//      />;
//    };
//    ```
//
//  REQUIRED       design "medieval" | "art deco"
//  ALL THREE      tag "paper" (or a list) · folder · full · webfonts · height
//  CONSTELLATION  edges "all" | "links"
//  PINBOARD       perRow 6 · spread
//  CONTACT SHEET  columns 10 · thumbs true
//
//  `design` is mandatory, exactly as in drawers.jsx, and for the same reason.
//  `tag` takes one tag or a list, exactly as <Shelves> does — see usePapers in
//  core.jsx for what collecting on a subject rather than on #paper does to the
//  topic colours.
//
//  ── ON THE PINBOARD ───────────────────────────────────────────────────────
//  There is no card/thread switch. The study had one — a mode that shrank every
//  card to a coloured strip so the string between them showed better — and it
//  turned the board into a diagram of a board. A pinboard whose cards you
//  cannot read is a graph, and the graph is <Constellation/>, which does it
//  properly. Cards, always; the string stays.
//
//  ── ON THE CONTACT SHEET ──────────────────────────────────────────────────
//  These are real first pages, rasterised out of the PDFs, not a drawing of
//  one. That is worth a hundred pages of paper but not a hundred renders on
//  mount, so a frame only asks for its picture once it has scrolled into
//  view — see useInView.
//
//  NOTE: never declare a local named `h` in this file — it is the JSX pragma.
// ════════════════════════════════════════════════════════════════════════════

const core = await dc.require("Meta/Obsidian/_datacore/paper/core.jsx");

const {
  designClass, DesignError, usePapers, indexBy, relatedTo, edgesOf,
  Pip, PageSheet, ReadingPanel, Styles, useFitHeight, useEscape,
  footOf, fieldsOf, clamp, hashOf,
} = core;

// ── topic colours ───────────────────────────────────────────────────────────
/* Seven per design, assigned by position in the sorted topic list rather than
   by hash: a hash gives you two near-identical greens next to each other about
   as often as not, and the whole point of the colour is telling clusters apart. */
const PALETTE = {
  medieval: ["#c98a2f", "#5f9e5a", "#8d6bb0", "#4f93b8", "#b8674f", "#5e8fa8", "#a8894f"],
  deco: ["#e3c24a", "#4f9e86", "#cd5f45", "#5a72b5", "#9268b8", "#3f9aa8", "#c76f8e"],
};

const GRAPH_W = 820, GRAPH_H = 546;

/** Topic → colour, and the order the legend is drawn in. */
function useTopics(papers, skin) {
  return dc.useMemo(() => {
    const counts = new Map();
    for (const p of papers) counts.set(p.topic, (counts.get(p.topic) ?? 0) + 1);
    const names = Array.from(counts.keys()).sort(
      (a, b) => counts.get(b) - counts.get(a) || a.localeCompare(b)
    );
    const pal = PALETTE[skin];
    const color = {};
    names.forEach((t, i) => { color[t] = pal[i % pal.length]; });
    return { names, color, counts };
  }, [papers, skin]);
}

/**
 * Where every node sits, in graph units.
 *
 * Topics get a cell each on a grid; the papers in a topic sit on a ring inside
 * their cell, offset by the topic's index so two adjacent clusters do not line
 * their papers up in the same direction. Deterministic, so the picture is the
 * same every time you open the note — a graph that reshuffles on each render
 * is one you can never learn.
 */
function layoutNodes(papers, topics) {
  const n = Math.max(1, topics.names.length);
  const cols = Math.min(4, Math.ceil(Math.sqrt(n)));
  const rows = Math.ceil(n / cols);
  const cellW = GRAPH_W / cols, cellH = GRAPH_H / rows;
  const ring = Math.min(cellW, cellH) * 0.34;

  const pos = {};
  topics.names.forEach((t, ti) => {
    const cx = cellW * (ti % cols) + cellW / 2;
    const cy = cellH * Math.floor(ti / cols) + cellH / 2;
    const mine = papers.filter((p) => p.topic === t);
    mine.forEach((p, pi) => {
      // one paper sits in the middle of its cell rather than orbiting nothing
      if (mine.length === 1) { pos[p.id] = { x: cx, y: cy }; return; }
      const a = (pi / mine.length) * Math.PI * 2 + ti;
      pos[p.id] = { x: cx + Math.cos(a) * ring, y: cy + Math.sin(a) * ring * 0.94 };
    });
  });
  return pos;
}

/** Node radius from times-cited. Logarithmic: 40 and 40 000 are not 1000x apart. */
const radiusOf = (p) => 8 + Math.round(clamp(0, Math.log10(1 + (p.cites ?? 0)) * 2.2, 9));

// ════════════════════════════════════════════════════════════════════════════
//  Constellation
// ════════════════════════════════════════════════════════════════════════════
function Constellation(props) {
  let skin;
  try { skin = designClass(props.design, "<Constellation>"); }
  catch (e) { return <DesignError error={e} />; }
  return <ConstellationBody {...props} skin={skin} />;
}

function ConstellationBody({
  skin, tag = "paper", folder = null, edges = "all",
  full = true, height = 620, webfonts = true,
}) {
  const papers = usePapers({ tag, folder });
  const byId = dc.useMemo(() => indexBy(papers), [papers]);
  const topics = useTopics(papers, skin);
  const pos = dc.useMemo(() => layoutNodes(papers, topics), [papers, topics]);
  const links = dc.useMemo(() => edgesOf(papers, byId, edges), [papers, byId, edges]);

  const [sel, setSel] = dc.useState(null);
  const [reading, setReading] = dc.useState(null);
  useEscape(() => setReading(null));

  const current = (reading && byId[reading]) || null;
  const chosen = (sel && byId[sel]) || papers[0] || null;

  const touching = dc.useMemo(() => {
    if (!chosen) return [];
    return links
      .filter((e) => e.from === chosen.id || e.to === chosen.id)
      .slice(0, 6)
      .map((e) => {
        const other = byId[e.from === chosen.id ? e.to : e.from];
        const way = e.kind === "thread" ? "SAME TOPIC"
          : e.from === chosen.id ? "CITES" : "CITED BY";
        return { paper: other, why: way };
      })
      .filter((x) => x.paper);
  }, [links, chosen, byId]);

  const hot = new Set(chosen ? [chosen.id] : []);
  const near = new Set();
  for (const e of links) {
    if (e.from === chosen?.id) near.add(e.to);
    if (e.to === chosen?.id) near.add(e.from);
  }

  const [fitRef, fitH] = useFitHeight(full);
  const cls = ["pv", "pvv", "pvv-graph", skin];
  if (full) cls.push("is-full");

  return (
    <>
      <Styles webfonts={webfonts} />
      <ViewStyles />
      <div
        class={cls.join(" ")}
        ref={fitRef}
        style={full ? (fitH ? { "--pv-vh": `${fitH}px` } : null) : { "--pv-h": `${height}px` }}
      >
        <div class="pv-case">
          <i class="pv-frame" aria-hidden="true" />
          <div class="pv-head">
            <i class="pv-fan" aria-hidden="true" />
            <span class="pv-name">CONSTELLATION</span>
            <i class="pv-sep" />
            <span class="pv-crumb">{chosen ? `${chosen.topic} · ${chosen.title}` : "nothing selected"}</span>
            <span class="pv-tally">
              {`${links.length} EDGES · SIZE = TIMES CITED`}
            </span>
          </div>

          <div class="pvv-split">
            <div class="pvv-sky">
              <svg viewBox={`0 0 ${GRAPH_W} ${GRAPH_H}`} class="pvv-web" preserveAspectRatio="none">
                {links.map((e, i) => {
                  const a = pos[e.from], b = pos[e.to];
                  if (!a || !b) return null;
                  const lit = hot.has(e.from) || hot.has(e.to);
                  return (
                    <line
                      key={i}
                      x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                      class={"pvv-edge" + (lit ? " is-lit" : "") + (e.kind === "thread" ? " is-thread" : "")}
                    />
                  );
                })}
              </svg>

              {papers.map((p) => {
                const at = pos[p.id];
                if (!at) return null;
                const r = radiusOf(p);
                const on = p.id === chosen?.id;
                const lit = on || near.has(p.id);
                return (
                  <div
                    key={p.id}
                    class={"pvv-node" + (on ? " is-on" : "") + (lit ? " is-lit" : "")}
                    style={{
                      left: `${(at.x / GRAPH_W) * 100}%`,
                      top: `${(at.y / GRAPH_H) * 100}%`,
                      "--dot": `${r}px`,
                      "--topic": topics.color[p.topic],
                      zIndex: on ? 10 : 2,
                    }}
                    title={`${p.title}\nclick · select   double-click · read`}
                    /* one handler, clicks counted off MouseEvent.detail —
                       onDoubleClick is a React name Preact never binds */
                    onClick={(e) => (e.detail >= 2 ? setReading(p.id) : setSel(p.id))}
                  >
                    <span class="pvv-dot" />
                    <span class="pvv-label">{p.title}</span>
                  </div>
                );
              })}

              <div class="pvv-legend">
                {topics.names.map((t) => (
                  <span key={t} class="pvv-key" style={{ "--topic": topics.color[t] }}>
                    {t} <b>{topics.counts.get(t)}</b>
                  </span>
                ))}
              </div>
              {papers.length === 0 && <div class="pv-empty">nothing tagged #{[].concat(tag).join(" / #")}</div>}
            </div>

            <div class="pvv-side">
              {chosen && (
                <>
                  <div class="pv-eyebrow">
                    <span class="pv-lozenge" />
                    <span>SELECTED</span>
                    <i class="pv-rule" />
                  </div>
                  {/* The title opens the reading panel; the page opens the PDF.
                      Two targets, two destinations, neither of them a filename
                      pretending to be a button. */}
                  <span
                    class="pvv-side-title"
                    title="read"
                    onClick={() => setReading(chosen.id)}
                  >{chosen.title}</span>
                  <span class="pvv-side-authors">{chosen.authorsFull}</span>
                  {chosen.affiliationLine && (
                    <span class="pvv-side-affil">{chosen.affiliationLine}</span>
                  )}
                  {fieldsOf(chosen)
                    .filter((f) => f.label !== "AUTHORS" && f.label !== "AFFILIATION")
                    .map((f) => (
                      <div class="pv-field" key={f.label}>
                        <span class="pv-caps">{f.label}</span>
                        <span class="pv-field-v">{f.value}</span>
                      </div>
                    ))}
                  {touching.length > 0 && (
                    <div class="pvv-side-block">
                      <span class="pv-caps">Cites · cited by</span>
                      <div class="pv-cards">
                        {touching.map((x) => (
                          <div class="pv-mini" key={x.paper.id} onClick={() => setSel(x.paper.id)}>
                            <span class="pv-mini-t">{x.paper.title}</span>
                            <span class="pv-mini-f">{`${x.why} · ${footOf(x.paper)}`}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <PageSheet paper={chosen} width={300} />
                </>
              )}
            </div>
          </div>

          {current && (
            <ReadingPanel
              paper={current}
              related={relatedTo(current, papers, byId)}
              onClose={() => setReading(null)}
              onPick={(id) => setReading(id)}
            />
          )}
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  Pinboard
// ════════════════════════════════════════════════════════════════════════════
const CARD_W = 196, CARD_H = 142;

function Pinboard(props) {
  let skin;
  try { skin = designClass(props.design, "<Pinboard>"); }
  catch (e) { return <DesignError error={e} />; }
  return <PinboardBody {...props} skin={skin} />;
}

function PinboardBody({
  skin, tag = "paper", folder = null, perRow = 6, spread = 1,
  full = true, height = 680, webfonts = true,
}) {
  const papers = usePapers({ tag, folder });
  const byId = dc.useMemo(() => indexBy(papers), [papers]);
  const topics = useTopics(papers, skin);

  /**
   * Where the cards start.
   *
   * A grid with a deterministic jitter on it, so the board looks pinned by hand
   * rather than laid out by a spreadsheet, and looks the same every time. The
   * board itself grows with the pile — a fixed 2400x1600 is a lot of empty cork
   * under nine papers and not nearly enough under two hundred.
   */
  const start = dc.useMemo(() => {
    const gapX = Math.round((CARD_W + 176) * spread);
    const gapY = Math.round((CARD_H + 120) * spread);
    const out = {};
    papers.forEach((p, i) => {
      const seed = hashOf(p.path);
      out[p.id] = {
        x: 70 + (i % perRow) * gapX + (seed % 11) * 9,
        y: 70 + Math.floor(i / perRow) * gapY + (Math.floor(seed / 11) % 9) * 11,
        rot: [-3.2, 2.4, -1.6, 3, -2.2, 1.8][seed % 6],
      };
    });
    const rows = Math.max(1, Math.ceil(papers.length / perRow));
    return {
      pos: out,
      w: 140 + perRow * gapX,
      h: 140 + rows * gapY,
    };
  }, [papers, perRow, spread]);

  const [moved, setMoved] = dc.useState(() => new Map());
  const [sel, setSel] = dc.useState(null);
  const [reading, setReading] = dc.useState(null);
  const [drag, setDrag] = dc.useState(null);
  const boardRef = dc.useRef(null);
  useEscape(() => setReading(null));

  const at = (id) => moved.get(id) ?? start.pos[id];

  /**
   * Drag, measured against the board rather than the window.
   *
   * The offset is taken from the board's own box, so a card you pick up after
   * scrolling the board sideways does not jump by the scroll distance the
   * moment you move the mouse.
   */
  const onDown = (p) => (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const r = boardRef.current?.getBoundingClientRect();
    const here = at(p.id);
    setSel(p.id);
    setDrag({
      id: p.id,
      dx: e.clientX - (r?.left ?? 0) - here.x,
      dy: e.clientY - (r?.top ?? 0) - here.y,
      from: { x: e.clientX, y: e.clientY },
      shifted: false,
    });
  };

  const onMove = (e) => {
    if (!drag) return;
    const r = boardRef.current?.getBoundingClientRect();
    const x = clamp(0, e.clientX - (r?.left ?? 0) - drag.dx, start.w - CARD_W);
    const y = clamp(0, e.clientY - (r?.top ?? 0) - drag.dy, start.h - CARD_H);
    const far = Math.abs(e.clientX - drag.from.x) + Math.abs(e.clientY - drag.from.y) > 4;
    if (far && !drag.shifted) setDrag({ ...drag, shifted: true });
    setMoved((prev) => new Map(prev).set(drag.id, { ...at(drag.id), x, y }));
  };

  // A drag is not a click. Without the distance latch, letting go of a card you
  // nudged by two pixels opens it.
  const onUp = () => {
    if (drag && !drag.shifted) setReading(drag.id);
    setDrag(null);
  };

  /**
   * The string.
   *
   * A run through each topic in date order, plus every other card in the topic
   * you have picked up. Not every pair: a topic of sixty papers is one thousand
   * seven hundred and seventy curves, which is both a solid wall of colour and
   * a repaint on every mouse move. The chain says the same thing — these belong
   * together, in this order — and it stays readable at any size.
   */
  const threads = dc.useMemo(() => {
    const bins = new Map();
    for (const p of papers) {
      if (!bins.has(p.topic)) bins.set(p.topic, []);
      bins.get(p.topic).push(p);
    }
    const out = [], drawn = new Set();
    const curve = (from, to, topic, lit) => {
      const key = from.id < to.id ? `${from.id}|${to.id}` : `${to.id}|${from.id}`;
      if (drawn.has(key)) return;
      const a = at(from.id), b = at(to.id);
      if (!a || !b) return;
      drawn.add(key);
      const x1 = a.x + CARD_W / 2, y1 = a.y + 6;
      const x2 = b.x + CARD_W / 2, y2 = b.y + 6;
      out.push({
        key,
        d: `M${x1} ${y1} Q${(x1 + x2) / 2} ${Math.max(y1, y2) + 120} ${x2} ${y2}`,
        color: topics.color[topic],
        lit,
      });
    };

    for (const [topic, list] of bins) {
      const run = list.slice().sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
      // the picked-up card's strands go down first: `curve` refuses a pair it
      // has already drawn, so whichever version is laid first is the one that
      // survives, and the lit one has to win
      const here = sel ? run.find((p) => p.id === sel) : null;
      if (here) for (const p of run) if (p.id !== sel) curve(here, p, topic, true);
      for (let i = 1; i < run.length; i++) curve(run[i - 1], run[i], topic, false);
    }
    // the lit strands last, so they sit over the run rather than under it
    return out.sort((a, b) => Number(a.lit) - Number(b.lit));
  }, [papers, moved, start, sel, topics]);

  const current = (reading && byId[reading]) || null;
  const chosen = (sel && byId[sel]) || null;

  const [fitRef, fitH] = useFitHeight(full);
  const cls = ["pv", "pvv", "pvv-board", skin];
  if (full) cls.push("is-full");

  return (
    <>
      <Styles webfonts={webfonts} />
      <ViewStyles />
      <div
        class={cls.join(" ")}
        ref={fitRef}
        style={full ? (fitH ? { "--pv-vh": `${fitH}px` } : null) : { "--pv-h": `${height}px` }}
      >
        <div class="pv-case">
          <i class="pv-frame" aria-hidden="true" />
          <div class="pv-head">
            <i class="pv-fan" aria-hidden="true" />
            <span class="pv-name">PINBOARD</span>
            <i class="pv-sep" />
            <span class="pv-crumb">{chosen ? chosen.title : `${papers.length} pinned`}</span>
            <span class="pv-tally">{`${topics.names.length} TOPICS`}</span>
          </div>

          <div class="pvv-cork">
            <div
              class="pvv-board"
              ref={boardRef}
              style={{ width: `${start.w}px`, height: `${start.h}px` }}
              onMouseMove={onMove}
              onMouseUp={onUp}
              onMouseLeave={() => setDrag(null)}
            >
              <svg
                class="pvv-string"
                viewBox={`0 0 ${start.w} ${start.h}`}
                width={start.w}
                height={start.h}
              >
                {threads.map((t) => (
                  <path
                    key={t.key}
                    d={t.d}
                    fill="none"
                    stroke={t.color}
                    stroke-width={t.lit ? 2.2 : 1}
                    stroke-linecap="round"
                    opacity={t.lit ? 0.85 : 0.16}
                  />
                ))}
              </svg>

              {papers.map((p) => {
                const here = at(p.id);
                const dragging = drag?.id === p.id;
                return (
                  <div
                    key={p.id}
                    class={"pvv-card" + (p.id === sel ? " is-on" : "") + (dragging ? " is-dragging" : "")}
                    style={{
                      left: `${here.x}px`, top: `${here.y}px`,
                      width: `${CARD_W}px`, height: `${CARD_H}px`,
                      "--rot": `${dragging ? 0 : here.rot}deg`,
                      "--topic": topics.color[p.topic],
                      zIndex: dragging ? 60 : p.id === sel ? 20 : 5,
                    }}
                    title={`${p.title}\ndrag · move   click · read`}
                    onMouseDown={onDown(p)}
                  >
                    <span class="pvv-pin" />
                    <div class="pvv-card-body">
                      <div class="pvv-card-top">
                        <Pip paper={p} size={10} />
                        <span class="pvv-card-venue">
                          {[p.venue, p.year].filter(Boolean).join(" ")}
                        </span>
                      </div>
                      <span class="pvv-card-title">{p.title}</span>
                      <i class="pvv-grow" />
                      <i class="pvv-card-rule" />
                      <span class="pvv-card-first">{p.first}</span>
                      {p.affiliationLine && (
                        <span class="pvv-card-affil">{p.affiliationLine}</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {papers.length === 0 && <div class="pv-empty">nothing tagged #{[].concat(tag).join(" / #")}</div>}
            </div>
          </div>

          {current && (
            <ReadingPanel
              paper={current}
              related={relatedTo(current, papers, byId)}
              onClose={() => setReading(null)}
              onPick={(id) => setReading(id)}
            />
          )}
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  Contact sheet
// ════════════════════════════════════════════════════════════════════════════
/**
 * Has this frame been seen yet?
 *
 * A contact sheet of two hundred papers is two hundred PDF rasters, and doing
 * them all on mount locks the pane for as long as that takes. The observer
 * fires once per frame and then disconnects — a page that has been rendered
 * stays rendered, and pdf.jsx caches the image anyway.
 */
function useInView(rootMargin = "300px") {
  const ref = dc.useRef(null);
  const [seen, setSeen] = dc.useState(false);

  dc.useEffect(() => {
    if (seen) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((x) => x.isIntersecting)) { setSeen(true); io.disconnect(); }
    }, { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [seen, rootMargin]);

  return [ref, seen];
}

function Frame({ paper, color, thumbs, onOpen }) {
  const [ref, seen] = useInView();
  return (
    <div
      class="pvv-frame"
      ref={ref}
      style={{ "--topic": color }}
      title={paper.title}
      onClick={onOpen}
    >
      {thumbs && seen
        ? <PageSheet paper={paper} width={190} />
        : <span class="pvv-frame-blank" aria-hidden="true" />}
      <span class="pvv-frame-year">{paper.year ?? "—"}</span>
      <Pip paper={paper} size={8} />
      <span class="pvv-frame-title">{paper.title}</span>
    </div>
  );
}

function ContactSheet(props) {
  let skin;
  try { skin = designClass(props.design, "<ContactSheet>"); }
  catch (e) { return <DesignError error={e} />; }
  return <ContactSheetBody {...props} skin={skin} />;
}

function ContactSheetBody({
  skin, tag = "paper", folder = null, columns = 10, thumbs = true,
  sort = "year", full = true, height = 640, webfonts = true,
}) {
  const papers = usePapers({ tag, folder });
  const byId = dc.useMemo(() => indexBy(papers), [papers]);
  const topics = useTopics(papers, skin);

  const sheets = dc.useMemo(() => {
    const by =
      sort === "cited" ? (a, b) => (b.cites ?? 0) - (a.cites ?? 0)
        : sort === "title" ? (a, b) => a.title.localeCompare(b.title)
          : sort === "topic" ? (a, b) => a.topic.localeCompare(b.topic) || (b.year ?? 0) - (a.year ?? 0)
            : (a, b) => (b.year ?? 0) - (a.year ?? 0) || a.title.localeCompare(b.title);
    return papers.slice().sort(by);
  }, [papers, sort]);

  const [reading, setReading] = dc.useState(null);
  useEscape(() => setReading(null));
  const current = (reading && byId[reading]) || null;

  const [fitRef, fitH] = useFitHeight(full);
  const cls = ["pv", "pvv", "pvv-contact", skin];
  if (full) cls.push("is-full");

  return (
    <>
      <Styles webfonts={webfonts} />
      <ViewStyles />
      <div
        class={cls.join(" ")}
        ref={fitRef}
        style={full ? (fitH ? { "--pv-vh": `${fitH}px` } : null) : { "--pv-h": `${height}px` }}
      >
        <div class="pv-case">
          <i class="pv-frame" aria-hidden="true" />
          <div class="pv-head">
            <i class="pv-fan" aria-hidden="true" />
            <span class="pv-name">CONTACT SHEET</span>
            <i class="pv-sep" />
            <span class="pv-crumb" />
            <span class="pv-tally">{`${sheets.length} FIRST PAGES`}</span>
          </div>

          <div class="pvv-grid" style={{ "--cols": columns }}>
            {sheets.map((p) => (
              <Frame
                key={p.id}
                paper={p}
                color={topics.color[p.topic]}
                thumbs={thumbs}
                onOpen={() => setReading(p.id)}
              />
            ))}
            {sheets.length === 0 && <div class="pv-empty">nothing tagged #{[].concat(tag).join(" / #")}</div>}
          </div>

          {current && (
            <ReadingPanel
              paper={current}
              related={relatedTo(current, papers, byId)}
              onClose={() => setReading(null)}
              onPick={(id) => setReading(id)}
            />
          )}
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  <ViewStyles /> — the three views. Palette and reading panel are core.jsx's.
// ════════════════════════════════════════════════════════════════════════════
const STYLE_ID = "paper-views-datacore-styles";

const CSS = `
.pvv-split { flex: 1; min-height: 0; display: flex; overflow: hidden; }
.pvv-grow { flex: 1; }

/* ── constellation ────────────────────────────────────────────────────── */
.pvv-sky { flex: 1; position: relative; min-width: 0; }
.pvv-web { position: absolute; inset: 0; width: 100%; height: 100%; }
.pvv-edge { stroke: var(--pv-line-soft); stroke-width: .8; }
.pvv-edge.is-thread { stroke: var(--pv-line-soft); opacity: .55; stroke-dasharray: 3 4; }
.pvv-edge.is-lit { stroke: var(--pv-gold); stroke-width: 1.6; opacity: 1; }

.pvv-node { position: absolute; width: 0; height: 0; cursor: pointer; }
.pvv-dot {
  position: absolute; left: 50%; top: 50%; display: block;
  width: var(--dot); height: var(--dot); border-radius: 50%;
  transform: translate(-50%,-50%); background: var(--topic);
  box-shadow: 0 0 0 1px rgba(0,0,0,.45); opacity: .72;
  transition: box-shadow .2s, opacity .2s;
}
.pv.deco .pvv-dot { border-radius: 1px; transform: translate(-50%,-50%) rotate(45deg); }
.pvv-node.is-lit .pvv-dot { opacity: 1; box-shadow: 0 0 0 2px var(--pv-gold-dim); }
.pvv-node.is-on .pvv-dot {
  opacity: 1; box-shadow: 0 0 0 3px var(--pv-gold-dim), 0 0 16px var(--pv-gold-dim);
}
.pvv-label {
  position: absolute; left: 50%; top: calc(var(--dot) / 2 + 5px);
  transform: translateX(-50%); display: block; width: 116px; text-align: center;
  font-family: var(--pv-mono); font-size: 8.5px; line-height: 1.2; letter-spacing: .04em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; pointer-events: none;
  color: rgba(240,224,196,.34);
}
.pv.deco .pvv-label { letter-spacing: .1em; color: rgba(240,233,216,.32); }
.pvv-node.is-lit .pvv-label { color: var(--pv-cream-dim); }
.pvv-node.is-on .pvv-label { color: var(--pv-cream); }

.pvv-legend {
  position: absolute; left: 18px; bottom: 16px; display: flex; flex-wrap: wrap;
  gap: 8px; max-width: 60%;
}
.pvv-key {
  padding: 5px 8px; font-family: var(--pv-mono); font-size: 8.5px; letter-spacing: .1em;
  color: var(--pv-cream-dim); border-left: 3px solid var(--topic);
  background: rgba(10,9,24,.66);
}
.pv.medieval .pvv-key { background: rgba(28,20,12,.66); }
.pv.deco .pvv-key { box-shadow: inset 0 0 0 1px var(--pv-line-soft); }
.pvv-key b { font-weight: 500; opacity: .6; }

.pvv-side {
  width: 340px; flex: none; overflow-y: auto; padding: 22px 22px 26px;
  display: flex; flex-direction: column; gap: 15px;
  border-left: 1px solid var(--pv-line);
}
.pv.medieval .pvv-side { background: #1c1610; }
.pv.deco .pvv-side { background: #14132e; }
.pvv-side-title {
  font-size: 18px; line-height: 1.34; text-wrap: pretty; color: var(--pv-cream);
  cursor: pointer; transition: color .14s ease-out;
}
.pvv-side-title:hover { color: var(--pv-gold); }
/* the page sits last in the margin, and is the only way from here to the PDF */
.pvv-side .pv-sheet { margin-top: 2px; }
.pvv-side-authors { font-size: 12.5px; line-height: 1.5; color: var(--pv-cream-dim); }
.pv.medieval .pvv-side-authors { font-style: italic; }
.pvv-side-affil { font-size: 11px; line-height: 1.45; color: rgba(240,224,196,.4); }
.pvv-side-block { display: flex; flex-direction: column; gap: 8px; }
/* the panel is dark on both designs, so the light-ground rules do not apply */
.pvv-side .pv-eyebrow { color: var(--pv-gold); }
.pvv-side .pv-field { border-bottom-color: var(--pv-line-soft); }
.pvv-side .pv-field-v { color: var(--pv-cream); }
.pvv-side .pv-caps { color: var(--pv-gold-dim); }
.pvv-side .pv-mini { background: rgba(0,0,0,.28); border-color: var(--pv-line-soft); }
.pvv-side .pv-mini:hover { border-color: var(--pv-gold-dim); background: rgba(0,0,0,.42); }
.pvv-side .pv-mini-t { color: var(--pv-cream); }
.pvv-side .pv-mini-f { color: rgba(240,224,196,.45); }

/* ── pinboard ─────────────────────────────────────────────────────────── */
.pvv-cork { flex: 1; min-height: 0; overflow: auto; }
.pv.medieval .pvv-cork {
  background: #5c4023; background-image: radial-gradient(140% 100% at 50% 0%,#6b4b29 0%,#4a3319 100%);
}
.pv.deco .pvv-cork {
  background: #151433; background-image: radial-gradient(130% 100% at 50% 0%,#26235a 0%,#0d0c1e 100%);
}
.pvv-board { position: relative; }
.pv.deco .pvv-board {
  background-image:
    repeating-linear-gradient(90deg,rgba(227,194,74,.05) 0 1px,transparent 1px 96px),
    repeating-linear-gradient(0deg,rgba(227,194,74,.05) 0 1px,transparent 1px 96px);
}
.pvv-string { position: absolute; left: 0; top: 0; pointer-events: none; }

.pvv-card {
  position: absolute; box-sizing: border-box; cursor: grab; user-select: none;
  background: var(--pv-paper); border: 1px solid rgba(90,58,32,.32);
  box-shadow: 0 8px 16px rgba(0,0,0,.4);
  transform: rotate(var(--rot));
  transition: transform .2s cubic-bezier(.22,.8,.28,1), box-shadow .2s;
}
.pv.deco .pvv-card {
  border-color: rgba(227,194,74,.6);
  box-shadow: 0 8px 16px rgba(0,0,0,.4), inset 0 0 0 3px #f4eedd, inset 0 0 0 4px rgba(22,21,71,.28);
}
.pvv-card.is-on { box-shadow: 0 16px 30px rgba(0,0,0,.5); transform: rotate(var(--rot)) scale(1.03); }
.pvv-card.is-dragging { cursor: grabbing; transition: none; box-shadow: 0 26px 44px rgba(0,0,0,.55); }
.pvv-pin {
  position: absolute; left: 50%; top: -7px; width: 13px; height: 13px; border-radius: 50%;
  transform: translateX(-50%);
  background: radial-gradient(60% 60% at 34% 28%,#f6d9a0,#9c2f24 62%,#5d1a13 100%);
  box-shadow: 0 2px 4px rgba(0,0,0,.5);
}
.pv.deco .pvv-pin {
  top: -8px; border-radius: 0; transform: translateX(-50%) rotate(45deg);
  background: linear-gradient(135deg,#f6e29a,#c9a63a);
  box-shadow: 0 3px 5px rgba(0,0,0,.55), inset 0 0 0 1px rgba(255,255,255,.4);
}
.pvv-card-body {
  height: 100%; box-sizing: border-box; padding: 18px 14px 13px;
  display: flex; flex-direction: column; gap: 7px; color: var(--pv-ink);
}
.pvv-card-top { display: flex; align-items: center; gap: 7px; }
.pvv-card-venue {
  font-family: var(--pv-mono); font-size: 8.5px; letter-spacing: .1em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.pv.medieval .pvv-card-venue { color: rgba(42,29,16,.58); }
.pv.deco .pvv-card-venue { letter-spacing: .18em; color: rgba(22,21,71,.6); }
.pvv-card-title {
  font-size: 13px; line-height: 1.4; font-weight: 500; text-wrap: pretty;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.pv.deco .pvv-card-title { font-weight: 400; line-height: 1.44; color: #16154a; }
.pvv-card-rule { flex: none; height: 1px; background: rgba(22,21,71,.26); display: none; }
.pv.deco .pvv-card-rule { display: block; }
.pvv-card-first, .pvv-card-affil {
  font-size: 10.5px; line-height: 1.35;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.pvv-card-affil { font-size: 9.5px; opacity: .74; }
.pv.medieval .pvv-card-first { font-style: italic; color: rgba(42,29,16,.6); }
.pv.medieval .pvv-card-affil { color: rgba(42,29,16,.55); }
.pv.deco .pvv-card-first { font-size: 10px; color: rgba(22,21,71,.6); }
.pv.deco .pvv-card-affil { color: rgba(22,21,71,.55); }
/* A pinned card is cream, and it belongs to a topic — so its pip is drawn in
   the topic's own colour on the paper's own track, not in the case's gold. */
.pvv-card { --pv-gold: var(--topic); --pv-track: rgba(42,29,16,.18); --pv-line: rgba(42,29,16,.24); }
.pv.deco .pvv-card { --pv-track: rgba(22,21,71,.16); --pv-line: rgba(22,21,71,.3); }

/* ── contact sheet ────────────────────────────────────────────────────── */
.pvv-grid {
  flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden;
  padding: 30px 30px 40px; display: grid; align-content: start;
  grid-template-columns: repeat(var(--cols),1fr); gap: 13px;
}
.pvv-frame {
  position: relative; aspect-ratio: 17/22; cursor: pointer; overflow: hidden;
  background: var(--pv-paper); border: 1px solid rgba(90,58,32,.4);
  border-left: 2px solid var(--topic); transform-origin: center;
  transition: transform .2s cubic-bezier(.22,.8,.28,1), box-shadow .2s, border-color .2s;
}
.pv.deco .pvv-frame { border-color: rgba(227,194,74,.45); border-left: 2px solid var(--topic); }
.pvv-frame:hover {
  transform: scale(1.26) translateY(-4px); z-index: 9;
  box-shadow: 0 16px 28px rgba(0,0,0,.62); border-color: var(--pv-gold);
}
/* PageSheet brings its own border and hover; inside a frame it is the picture */
.pvv-frame .pv-sheet { position: absolute; inset: 0; aspect-ratio: auto; border: none; }
.pvv-frame .pv-sheet-wait { font-size: 6.5px; letter-spacing: .06em; padding: 3px 4px; background: none; }
.pvv-frame-blank {
  position: absolute; inset: 14px 8px 12px; display: block;
  background: repeating-linear-gradient(180deg,transparent 0 5px,rgba(42,29,16,.16) 5px 6px);
}
.pv.deco .pvv-frame-blank { background: repeating-linear-gradient(180deg,transparent 0 5px,rgba(22,21,71,.14) 5px 6px); }
.pvv-frame-year {
  position: absolute; left: 5px; top: 4px; z-index: 2;
  font-family: var(--pv-mono); font-size: 6.5px; letter-spacing: .08em;
  padding: 1px 3px; border-radius: 2px; background: rgba(255,253,244,.8); color: rgba(42,29,16,.7);
}
/* on a cream frame the case's gold vanishes — same trick as the drawers */
.pvv-frame { --pv-gold: var(--topic); --pv-track: rgba(42,29,16,.2); --pv-line: rgba(42,29,16,.28); }
.pvv-frame .pv-pip { position: absolute; right: 5px; top: 4px; z-index: 2; }
.pvv-frame-title {
  position: absolute; left: 0; right: 0; bottom: 0; z-index: 2; padding: 4px 5px;
  max-height: 44%; overflow: hidden;
  font-family: var(--pv-mono); font-size: 6.5px; line-height: 1.34;
  background: rgba(26,17,10,.86); color: #f3e6c8;
}
.pv.deco .pvv-frame-title { background: rgba(11,10,26,.9); color: #f4eedd; }
`;

function ViewStyles() {
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
  Constellation, Pinboard, ContactSheet,
  ViewStyles, Frame, useInView, useTopics, layoutNodes, radiusOf,
  PALETTE, GRAPH_W, GRAPH_H, CARD_W, CARD_H,
};
