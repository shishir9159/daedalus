// ════════════════════════════════════════════════════════════════════════════
//  critters.jsx  —  cobwebs and the spider
//  Location: Meta/Obsidian/_datacore/book/critters.jsx
//
//  Ported from the "Long unread" design study. Two things matter about the
//  technique, and both fix the stretching the old SVG version had:
//
//    · a web is built from absolutely-positioned divs anchored at a 0x0 point
//      and measured in px — spokes are 1px-tall gradient bars rotated about
//      their left edge, ring segments are `border-bottom` on a 50%-rounded box
//      so the thread sags. Nothing scales, so nothing distorts.
//    · the whole web sits inside an `overflow: hidden` frame, so it is clipped
//      to the cover or the shelf rather than squashed to fit it.
//
//  The spider hangs on a one-pixel thread and sways. Its legs are the top and
//  right borders of a box with a 100% corner radius, rotated — which gives a
//  tapering curve no border-radius alone would.
//
//  NOTE: never declare a local named `h` in this file — it is the JSX pragma.
// ════════════════════════════════════════════════════════════════════════════

const core = await dc.require("Meta/Obsidian/_datacore/book/core.jsx");
const { hashOf, clamp } = core;

const WEB_COLOR = "#e9e3d5";

// ── deterministic noise (mulberry32) ───────────────────────────────────────
const rng = (seed) => {
  let a = seed >>> 0;
  return () => {
    a += 0x6D2B79F5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const rgba = (hex, a) => {
  const raw = String(hex || WEB_COLOR).replace("#", "");
  const n = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${clamp(0, a, 1).toFixed(3)})`;
};

/**
 * A corner web. Spokes radiate from the anchor across the arc a0..a1; ring
 * segments hang between adjacent spokes, sagging back toward the anchor.
 * Returns ready-to-spread style objects.
 */
function buildWeb({
  seed, radius, a0, a1, spokes: n, rings,
  color = WEB_COLOR, opacity = 0.62, torn = true,
}) {
  const R = rng(seed);
  const spread = (a1 - a0) / (n - 1);
  const th = [], len = [];

  for (let i = 0; i < n; i++) {
    const jit = (i === 0 || i === n - 1) ? 0 : (R() - 0.5) * spread * 0.55;
    th.push(a0 + spread * i + jit);
    len.push(radius * (0.84 + R() * 0.32));
  }

  const parts = [];

  for (let i = 0; i < n; i++) {
    const a = opacity * (0.72 + R() * 0.34);
    parts.push({
      position: "absolute", left: 0, top: 0, height: "1px",
      width: `${len[i].toFixed(1)}px`,
      transformOrigin: "0 50%",
      transform: `rotate(${th[i].toFixed(2)}deg)`,
      background: `linear-gradient(90deg, ${rgba(color, a)} 0%, ${rgba(color, a * 0.7)} 62%, ${rgba(color, 0)} 100%)`,
    });
  }

  for (let k = 0; k < rings; k++) {
    const base = (k + 1) / (rings + 0.55);
    for (let i = 0; i < n - 1; i++) {
      if (torn && R() < 0.08) continue;                    // a strand has gone
      const r1 = len[i] * base * (0.9 + R() * 0.2);
      const r2 = len[i + 1] * base * (0.9 + R() * 0.2);
      const t1 = th[i] * Math.PI / 180, t2 = th[i + 1] * Math.PI / 180;
      const x1 = r1 * Math.cos(t1), y1 = r1 * Math.sin(t1);
      const dx = r2 * Math.cos(t2) - x1, dy = r2 * Math.sin(t2) - y1;
      const L = Math.hypot(dx, dy);
      const ang = Math.atan2(dy, dx) * 180 / Math.PI;
      const sag = Math.max(3, L * (0.13 + R() * 0.13)) * 2;
      const a = opacity * (0.34 + R() * 0.5) * (1 - base * 0.2);
      parts.push({
        position: "absolute", boxSizing: "border-box",
        left: `${x1.toFixed(1)}px`, top: `${y1.toFixed(1)}px`,
        width: `${L.toFixed(1)}px`, height: `${sag.toFixed(1)}px`,
        marginTop: `${(-sag / 2).toFixed(1)}px`,
        transformOrigin: "0 50%", transform: `rotate(${ang.toFixed(2)}deg)`,
        borderBottom: `1px solid ${rgba(color, a)}`, borderRadius: "50%",
      });
    }
  }

  return parts;
}

const Strands = ({ parts, left, top }) => (
  <div class="hcs-web-anchor" style={{ left, top }}>
    {parts.map((s, i) => <div key={i} style={s} />)}
  </div>
);

// ── neglect ────────────────────────────────────────────────────────────────
const WEB_STEPS = [21, 60, 120, 240];   // days at which each level begins

const webLevel = (days) => {
  let lvl = 0;
  for (const d of WEB_STEPS) if (days >= d) lvl++;
  return lvl;                            // 0..4
};

const mtimeOf = (path) =>
  app.vault.getAbstractFileByPath(path)?.stat?.mtime ?? null;

function useNeglect(path, enabled = true) {
  const [level, setLevel] = dc.useState(0);
  dc.useEffect(() => {
    if (!enabled || !path) { setLevel(0); return; }
    const m = mtimeOf(path);
    setLevel(m ? webLevel((Date.now() - m) / 86400000) : 0);
  }, [path, enabled]);
  return level;
}

// ── the web on a cover ─────────────────────────────────────────────────────
// spokes / rings / reach, as a fraction of the cover width, per level
const WEB_DENSITY = [
  null,
  { spokes: 4, rings: 2, reach: 0.46 },
  { spokes: 5, rings: 3, reach: 0.66 },
  { spokes: 7, rings: 4, reach: 0.88 },
  { spokes: 9, rings: 5, reach: 1.10 },
];

/**
 * `width` and `height` are the box the web is hanging in, not the web's own
 * size — it works out its reach from them.
 *
 * That distinction is the fix for "the webs stopped showing". A web used to be
 * sized off a single number the caller had already massaged (spine thickness
 * times 2.2), so when the case was rescaled and a spine went from 250px tall to
 * 430px, its web stayed the size it had been and ended up a knot in the top
 * corner of a box more than twice as tall — technically drawn, effectively
 * gone. A corner web reaches across the narrow side and about half way down the
 * long one, which is what the two dimensions together say and what one cannot.
 */
const webReach = (width, height) =>
  Math.max(width, Math.min(height * 0.5, width * 3));

function Cobweb({ level, seed, width = 135, height = width * 1.5, color = WEB_COLOR, opacity = 0.6 }) {
  const lvl = clamp(1, level | 0, 4);
  const d = WEB_DENSITY[lvl];
  const key = hashOf(seed);
  const span = webReach(width, height);

  const head = dc.useMemo(() => buildWeb({
    seed: key + 1207, radius: span * d.reach, a0: 2, a1: 88,
    spokes: d.spokes, rings: d.rings, color, opacity,
  }), [key, lvl, span, color, opacity]);

  // once it is properly abandoned, a second web takes the opposite corner
  const foot = dc.useMemo(() => buildWeb({
    seed: key + 5501, radius: span * d.reach * 0.5, a0: 184, a1: 266,
    spokes: Math.max(4, d.spokes - 2), rings: Math.max(2, d.rings - 1),
    color, opacity: opacity * 0.85,
  }), [key, lvl, span, color, opacity]);

  if (!level) return null;

  // The anchor sits just outside the corner so the strands come from beyond the
  // edge rather than starting on it — as a fraction of the reach, so it stays
  // in proportion on a spine and on a cover alike.
  const off = Math.round(span * 0.045);

  return (
    <div class="hcs-webs" aria-hidden="true">
      <Strands parts={head} left={`${-off}px`} top={`${-off - 2}px`} />
      {lvl >= 3 && (
        <Strands parts={foot} left={`calc(100% + ${off}px)`} top={`calc(100% + ${off + 2}px)`} />
      )}
    </div>
  );
}

/** The mark a book leaves on the board after standing untouched for months. */
function ShelfWear({ level }) {
  if (!level) return null;
  return <div class="hcs-wear" style={{ "--wear": level }} aria-hidden="true" />;
}

// ── the spider ─────────────────────────────────────────────────────────────
/**
 * `thread` is a length, and it takes a string as readily as a number, because
 * the shelf needs to express the drop against the compartment it is hanging in
 * — `calc(var(--head-h) + 45px)` — rather than as a constant that stops
 * reaching the book the moment the case is scaled.
 *
 * `scale` is likewise relative: the spider is furniture of the book beside it,
 * so at 1 it is roughly 68px across and callers divide the book's own width
 * down to whatever fraction of that looks like an animal rather than a pet.
 */
function Spider({ thread = 88, sway = true, scale = 1, period = 9, style }) {
  const drop = typeof thread === "number" ? `${thread}px` : String(thread);
  return (
    <div
      class={"hcs-spider" + (sway ? " is-sway" : "")}
      style={{ "--thread": drop, "--spider-scale": scale, "--sway": `${period}s`, ...(style ?? {}) }}
      aria-hidden="true"
    >
      <div class="hcs-thread">
        <div class="hcs-spider-body">
          <div class="hcs-legs"><i /><i /><i /><i /></div>
          <div class="hcs-legs is-mirror"><i /><i /><i /><i /></div>
          <div class="hcs-abdomen" />
          <div class="hcs-spider-head" />
          <div class="hcs-eye is-a" />
          <div class="hcs-eye is-b" />
        </div>
      </div>
    </div>
  );
}

/** A yellowed date-due card, left in the run nobody uses. */
function DueCard() {
  return (
    <div class="hcs-duecard" aria-hidden="true">
      <div class="hcs-duecard-head">Date Due</div>
      <div class="hcs-duecard-rules" />
      <div class="hcs-duecard-stamp">Returned</div>
      <div class="hcs-duecard-fold" />
    </div>
  );
}

/** Heaps of settled dust — fixed, not a dial. */
function DustHeaps() {
  return (
    <div class="hcs-heaps" aria-hidden="true">
      <i class="is-a" /><i class="is-b" /><i class="is-c" /><i class="is-d" />
      <i class="is-halo" />
    </div>
  );
}

// ── an empty shelf is simply an abandoned one ──────────────────────────────
function EmptyShelf({ seed = "empty", spider = true }) {
  const key = hashOf(seed);
  const web = dc.useMemo(() => buildWeb({
    seed: key + 9134, radius: 152, a0: 6, a1: 84,
    spokes: 5, rings: 3, opacity: 0.5,
  }), [key]);

  return (
    <div class="hcs-empty">
      <div class="hcs-webs">
        <Strands parts={web} left="12px" top="14px" />
      </div>
      <DueCard />
      <DustHeaps />
      {spider && <Spider style={{ left: "82%", top: "0px" }} thread={70} scale={0.9} period={11} />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  styles
// ════════════════════════════════════════════════════════════════════════════
const CRITTER_STYLE_ID = "book-datacore-critter-styles";

const CRITTER_CSS = `
/* Clipped to whatever it is laid over, so a web is cut off rather than
   squashed. z-index 5, not 4: the hardcover board overlay (hc-fx-lit::before)
   also asks for 4, and a tie is decided by document order — which the web won,
   but only by accident of where it sits in the markup. One above it is the
   thing that is actually meant.
   The drop shadow is what keeps a pale thread readable on a pale cover under a
   lamp; without it the web is #e9e3d5 on near-white and simply is not there. */
.hcs-webs {
  position: absolute; inset: 0; z-index: 5;
  overflow: hidden; pointer-events: none; border-radius: inherit;
  filter: drop-shadow(0 1px 1px rgba(0,0,0,.5));
}
.hcs-web-anchor { position: absolute; width: 0; height: 0; }

/* ── spider ───────────────────────────────────────────────────────────── */
.hcs-spider {
  position: absolute; z-index: 9; width: 0; height: 0;
  transform-origin: 0 0; pointer-events: none;
}
/* Longhand on purpose. Writing the animation shorthand with a var() for the
   duration is invalid at computed-value time until that variable resolves,
   and an invalid shorthand is thrown away whole — which left the spider
   hanging dead still. The longhands degrade one property at a time. */
.hcs-spider.is-sway {
  animation-name: hcs-sway;
  animation-duration: 9s;
  animation-duration: var(--sway, 9s);
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  will-change: transform;
}
/* Rest at zero, swing symmetrically either side. If anything ever freezes the
   animation the spider hangs straight down rather than stuck at an angle. */
@keyframes hcs-sway {
  0%, 100% { transform: rotate(0deg); }
  25%      { transform: rotate(-3.2deg); }
  75%      { transform: rotate(3.2deg); }
}
/* Reduced motion only wins if the view has not explicitly asked for the
   animation. The swaying spider and the flap board ARE the design, so
   <Shelves motion> keeps them running; motion={false} stops everything. */
@media (prefers-reduced-motion: reduce) {
  .hcs:not(.has-motion) .hcs-spider.is-sway { animation: none; }
}
.hcs.no-motion .hcs-spider.is-sway { animation: none; }

.hcs-thread {
  position: absolute; left: 0; top: 0; width: 1px; height: var(--thread, 88px);
  background: linear-gradient(180deg,
    rgba(233,227,213,.14), rgba(233,227,213,.42) 45%, rgba(233,227,213,.7));
}
.hcs-spider-body {
  position: absolute; left: 0; bottom: -1px; width: 0; height: 0;
  scale: var(--spider-scale, 1);
}

.hcs-legs { position: absolute; left: 0; top: 0; width: 0; height: 0; }
.hcs-legs.is-mirror { transform: scaleX(-1); }
/* each leg is the top+right border of a box with a full corner radius, rotated */
.hcs-legs i {
  position: absolute; display: block; box-sizing: border-box;
  border-top: 1.5px solid #6b6156; border-right: 1.5px solid #6b6156;
  border-top-right-radius: 100% 100%; transform-origin: 0 0;
}
.hcs-legs i:nth-child(1) { left: 4px; top: -7px; width: 25px; height: 13px; transform: rotate(-42deg); }
.hcs-legs i:nth-child(2) { left: 5px; top: -1px; width: 29px; height: 14px; transform: rotate(-15deg); }
.hcs-legs i:nth-child(3) { left: 5px; top:  5px; width: 27px; height: 13px; transform: rotate(8deg);
                           border-top-color: #635a50; border-right-color: #635a50; }
.hcs-legs i:nth-child(4) { left: 4px; top: 11px; width: 22px; height: 11px; transform: rotate(28deg);
                           border-top-color: #5b5349; border-right-color: #5b5349; }
.hcs-legs.is-mirror i:nth-child(1) { top: -8px; width: 24px; height: 12px; transform: rotate(-38deg); }
.hcs-legs.is-mirror i:nth-child(2) { top: -2px; width: 28px; height: 14px; transform: rotate(-12deg); }
.hcs-legs.is-mirror i:nth-child(3) { top:  4px; width: 26px; height: 13px; transform: rotate(11deg); }
.hcs-legs.is-mirror i:nth-child(4) { top: 10px; width: 21px; height: 11px; transform: rotate(31deg); }

.hcs-abdomen {
  position: absolute; left: -13px; top: 6px; width: 26px; height: 24px;
  border-radius: 52% 52% 46% 46%;
  background: radial-gradient(120% 100% at 36% 24%, #544a3e 0%, #241f1a 52%, #141110 100%);
  box-shadow: 0 0 0 .5px rgba(233,227,213,.1), 0 8px 12px rgba(0,0,0,.55);
}
.hcs-spider-head {
  position: absolute; left: -7px; top: -5px; width: 14px; height: 13px; border-radius: 50%;
  background: radial-gradient(110% 100% at 40% 28%, #4d443a 0%, #1e1a16 70%);
}
.hcs-eye { position: absolute; width: 2px; height: 2px; border-radius: 50%; }
.hcs-eye.is-a { left: -4px; top: -1px; background: rgba(233,227,213,.5); }
.hcs-eye.is-b { left:  2px; top: -1px; background: rgba(233,227,213,.4); }

/* ── empty shelf ──────────────────────────────────────────────────────── */
/* Stretched to the compartment rather than given --shelf-h of its own: the row
   already carries that height, and asking for it again INSIDE the row's
   headroom padding made an empty shelf taller than a full one. */
.hcs-empty {
  position: relative; flex: 1 1 auto; align-self: stretch; overflow: visible;
  min-height: 0; margin: 6px 0 4px;
}
.hcs-row.is-flat .hcs-empty { min-height: 120px; }
/* ── the empty run ────────────────────────────────────────────────────── */
/* A date-due card and heaps of settled dust. Fixed quantities: an abandoned
   shelf is abandoned, it is not a dial. */
.hcs-duecard {
  position: absolute; left: 12%; bottom: 2px; z-index: 3;
  width: 132px; height: 88px; padding: 9px 10px 0;
  rotate: -6deg; transform-origin: bottom left; border-radius: 2px;
  background: linear-gradient(160deg, #e6d9b4, #cdbe94 62%, #bcac81);
  box-shadow: 0 6px 12px rgba(0,0,0,.6),
              inset 0 1px 0 rgba(255,255,255,.4),
              inset 0 -8px 14px rgba(120,100,60,.28);
  pointer-events: none;
}
.hcs-duecard-head {
  font-family: var(--font-interface); font-size: 10px; font-weight: 600;
  letter-spacing: .32em; text-transform: uppercase; text-align: center; color: #6b5a34;
}
.hcs-duecard-rules {
  margin-top: 7px; height: 44px;
  background: repeating-linear-gradient(180deg, transparent 0 10px, rgba(110,92,54,.35) 10px 11px);
}
.hcs-duecard-stamp {
  position: absolute; right: 9px; top: 26px; width: 52px; height: 30px;
  rotate: -13deg; border: 2px solid rgba(96,58,92,.42); border-radius: 2px;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--font-interface); font-size: 9px; font-weight: 600;
  letter-spacing: .14em; text-transform: uppercase; color: rgba(96,58,92,.42);
}
.hcs-duecard-fold {
  position: absolute; left: 0; right: 0; bottom: 0; height: 9px;
  background: linear-gradient(180deg, rgba(0,0,0,0), rgba(90,72,38,.35));
}

/* heaps, clipped into little drifts rather than blurred blobs */
.hcs-heaps { position: absolute; inset: 0; pointer-events: none; }
.hcs-heaps i { position: absolute; bottom: 0; display: block; }
.hcs-heaps .is-a {
  left: 34%; width: 54px; height: 17px; opacity: .72; filter: blur(1.1px);
  background: linear-gradient(180deg, #ddd3b1, #a89d7e);
  clip-path: polygon(50% 0, 100% 100%, 0 100%);
}
.hcs-heaps .is-b {
  left: 56%; width: 74px; height: 23px; opacity: .74; filter: blur(1.2px);
  background: linear-gradient(180deg, #e0d6b4, #aa9f81);
  clip-path: polygon(50% 0, 74% 52%, 100% 100%, 0 100%, 26% 52%);
}
.hcs-heaps .is-c {
  right: 7%; width: 96px; height: 31px; opacity: .8; filter: blur(1.4px);
  background: linear-gradient(180deg, #e4dabb, #b6ab8c 70%, #988d70);
  clip-path: polygon(50% 0, 72% 46%, 100% 100%, 0 100%, 28% 46%);
}
.hcs-heaps .is-d {
  right: 19%; width: 48px; height: 15px; opacity: .66; filter: blur(1.2px);
  background: linear-gradient(180deg, #d8ceac, #a89d80);
  clip-path: polygon(50% 0, 100% 100%, 0 100%);
}
.hcs-heaps .is-halo {
  right: 6%; width: 132px; height: 9px; border-radius: 50%;
  background: rgba(198,188,163,.22); filter: blur(4px);
}

/* ── shelf wear ───────────────────────────────────────────────────────── */
.hcs-wear {
  position: absolute; z-index: 0; pointer-events: none;
  left: 1%; right: 1%; bottom: -7px; height: 16px; filter: blur(3px);
  background: radial-gradient(ellipse at center,
    rgba(0,0,0, calc(.09 + .055 * var(--wear, 0))) 0%, transparent 72%);
}
/* the pale rim of dust that builds around a book that never moves */
.hcs-wear::after {
  content: ""; position: absolute; left: 0; right: 0; bottom: 4px; height: 5px;
  opacity: calc(var(--wear, 0) * .22);
  background: radial-gradient(ellipse at center, rgba(226,219,199,.75), transparent 74%);
}
`;

function CritterStyles() {
  dc.useEffect(() => {
    let el = document.getElementById(CRITTER_STYLE_ID);
    if (!el) {
      el = document.createElement("style");
      el.id = CRITTER_STYLE_ID;
      document.head.appendChild(el);
    }
    if (el.textContent !== CRITTER_CSS) el.textContent = CRITTER_CSS;
  }, []);
  return null;
}

return {
  WEB_STEPS, WEB_DENSITY, WEB_COLOR,
  rng, rgba, buildWeb, webReach, webLevel, mtimeOf, useNeglect,
  Cobweb, Spider, ShelfWear, DueCard, DustHeaps, EmptyShelf, CritterStyles,
};
