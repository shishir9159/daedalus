// ════════════════════════════════════════════════════════════════════════════
//  critters.jsx  —  cobwebs and the spider
//  Location: Meta/Obsidian/_datacore/book/critters.jsx
//
//  Webs are smooth canvases from cobweb.jsx, sized to the cover or spine they
//  hang on and clipped to it, so they are cut off, never squashed.
//
//  The spider hangs on a one-pixel thread and sways. Its legs are the top and
//  right borders of a box with a 100% corner radius, rotated — a tapering
//  curve no border-radius alone gives.
//
//  NOTE: never declare a local named `h` in this file — it is the JSX pragma.
// ════════════════════════════════════════════════════════════════════════════

const core = await dc.require("Meta/Obsidian/_datacore/book/core.jsx");
const cw = await dc.require("Meta/Obsidian/_datacore/book/cobweb.jsx");
const { clamp } = core;
const { Cobweb: WebCanvas, CORNERS, resolve } = cw;

const WEB_COLOR = "#e9e3d5";
// seconds per breath of a web
const WEB_BREATH = 9;
// seconds per swing of the spider: a little quicker than the webs breathe
const SPIDER_SWING = 7;

/**
 * Seconds per cycle for a `sway` prop: true takes `fallback`, a positive number
 * is itself, and anything else (false, 0, -1) is null, which holds it still.
 */
const periodOf = (sway, fallback) =>
  sway === true ? fallback : Number(sway) > 0 ? Number(sway) : null;

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
// reach per level, as a fraction of webReach
const WEB_REACH = [0, 0.46, 0.66, 0.88, 1.1];

/**
 * How far a corner web reaches in a `width` × `height` box: across the narrow
 * side and about half way down the long one. Both sides matter — a web sized
 * off one stays a knot in the corner when the box grows.
 */
const webReach = (width, height) =>
  Math.max(width, Math.min(height * 0.5, width * 3));

/**
 * The web on a book, grown by `level` (0..4, from useNeglect; 0 draws nothing).
 * `width` and `height` are the box it hangs in, in CSS px, not the web's own
 * size. `seed` gives each book a web of its own; from level 3 a second, smaller
 * web takes the opposite corner. `color` and `opacity` are the strands'.
 * `sway` makes it breathe, even under reduced motion, as <Shelves motion> does
 * for the spider: true once every WEB_BREATH seconds, a number once every that
 * many, and false or -1 not at all.
 */
function Cobweb({ level, seed, width = 135, height = width * 1.5, color = WEB_COLOR, opacity = 0.6, sway = false }) {
  if (!level) return null;
  const lvl = clamp(1, level | 0, 4);
  const reach = (WEB_REACH[lvl] * webReach(width, height)) / Math.min(width, height);
  const corner = resolve({ seed }).corner;
  const breath = periodOf(sway, WEB_BREATH);
  const web = {
    fill: true, pixelated: false, scale: 1, backdrop: false, color,
    animate: breath ? "always" : false, period: breath ?? WEB_BREATH,
    width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)),
  };

  return (
    <div class="hcs-webs" aria-hidden="true">
      <WebCanvas {...web} seed={seed} reach={reach} webOpacity={opacity} />
      {lvl >= 3 && (
        // CORNERS lists each corner's opposite at the mirrored index
        <WebCanvas
          {...web} seed={`${seed}:foot`} corner={CORNERS[3 - CORNERS.indexOf(corner)]}
          reach={reach * 0.5} webOpacity={opacity * 0.85}
        />
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
 * `thread` is the drop: px as a number, or any CSS length, so the shelf can
 * hang it against the compartment — `calc(var(--head-h) + 45px)` — and it still
 * reaches the book when the case is scaled.
 *
 * `scale` is relative to the book beside it: at 1 the spider is roughly 68px
 * across, and callers scale it down from the book's own width until it looks
 * like an animal rather than a pet.
 *
 * `sway` swings it on its thread: true once every `period` seconds, a number
 * once every that many, false or -1 not at all. `style` positions it.
 */
function Spider({ thread = 88, sway = true, scale = 1, period = SPIDER_SWING, style }) {
  const drop = typeof thread === "number" ? `${thread}px` : String(thread);
  const swing = periodOf(sway, period);
  return (
    <div
      class={"hcs-spider" + (swing ? " is-sway" : "")}
      style={{ "--thread": drop, "--spider-scale": scale, "--sway": `${swing ?? period}s`, ...(style ?? {}) }}
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
/**
 * `seed` picks the web (the shelf's title, say), `spider` hangs one. `sway` is
 * the web's breath and `swing` the spider's, each as for Cobweb and Spider.
 */
function EmptyShelf({ seed = "empty", spider = true, sway = false, swing = SPIDER_SWING }) {
  const breath = periodOf(sway, WEB_BREATH);
  return (
    <div class="hcs-empty">
      <div class="hcs-webs" aria-hidden="true">
        <WebCanvas
          seed={seed} corner="top-left" backdrop={false} color={WEB_COLOR} webOpacity={0.5}
          pixelated={false} width={192} height={192} scale={1}
          animate={breath ? "always" : false} period={breath ?? WEB_BREATH}
          style={{ position: "absolute", left: "12px", top: "14px" }}
        />
      </div>
      <DueCard />
      <DustHeaps />
      {spider && <Spider style={{ left: "82%", top: "0px" }} thread={70} scale={0.9} sway={swing} />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  styles
// ════════════════════════════════════════════════════════════════════════════
const CRITTER_STYLE_ID = "book-datacore-critter-styles";

const CRITTER_CSS = `
/* Clipped to whatever it is laid over, so a web is cut off rather than
   squashed. z-index 5 sits above the hardcover board overlay
   (hc-fx-lit::before, at 4). The drop shadow keeps a pale web readable on a
   pale cover under a lamp. */
.hcs-webs {
  position: absolute; inset: 0; z-index: 5;
  overflow: hidden; pointer-events: none; border-radius: inherit;
  filter: drop-shadow(0 1px 1px rgba(0,0,0,.5));
}

/* ── spider ───────────────────────────────────────────────────────────── */
.hcs-spider {
  position: absolute; z-index: 9; width: 0; height: 0;
  transform-origin: 0 0; pointer-events: none;
}
/* Longhands on purpose: a shorthand with an unresolved var() is dropped whole,
   which froze the spider. Longhands degrade one property at a time. */
.hcs-spider.is-sway {
  animation-name: hcs-sway;
  animation-duration: 7s;
  animation-duration: var(--sway, 7s);
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  will-change: transform;
}
/* Rests at zero, so a frozen animation leaves it hanging straight down. */
@keyframes hcs-sway {
  0%, 100% { transform: rotate(0deg); }
  25%      { transform: rotate(-3.2deg); }
  75%      { transform: rotate(3.2deg); }
}
/* Reduced motion stops the sway unless <Shelves motion> asks for it. */
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
/* Stretched to the compartment, not given --shelf-h: the row already has that
   height, and asking again inside its headroom padding made an empty shelf
   taller than a full one. */
.hcs-empty {
  position: relative; flex: 1 1 auto; align-self: stretch; overflow: visible;
  min-height: 0; margin: 6px 0 4px;
}
.hcs-row.is-flat .hcs-empty { min-height: 120px; }
/* ── the empty run: a date-due card and heaps of settled dust ─────────── */
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
  WEB_STEPS, WEB_REACH, WEB_COLOR, WEB_BREATH, SPIDER_SWING,
  periodOf, webReach, webLevel, mtimeOf, useNeglect,
  Cobweb, Spider, ShelfWear, DueCard, DustHeaps, EmptyShelf, CritterStyles,
};
