// ════════════════════════════════════════════════════════════════════════════
//  patterns.jsx  —  progress indicators, lighting, neglect
//  Location: Meta/Obsidian/_datacore/book/patterns.jsx
//
//  Kept apart from the board material so the three compose freely:
//    <Shelves shelf="oak" progress="spotlight" lamp="pointer" webs bookends />
//
//  progress patterns
//    "crack"      the board splits under the book's weight, spreading outward
//    "spotlight"  a picture light per book; the bulb burns warmer and brighter
//                 the further you have read, and the light lands on the cover
//    "slip"       a paper slip tipped in at your page, carrying the number
//    "ribbon"     a satin bookmark down the cover
//    "bar"        the plain hairline
//    "none"
//
//  lamp
//    "pointer"    one warm light for the row, following your cursor
//    "rail"       a lamp per book, all hanging from one rail at a single
//                 height — fixture, cone and drifting motes
//    false        no lighting
//
//  How the rail and the spotlight pattern share the beams:
//
//    progress="spotlight", lamp=false   beams show reading colour at rest
//    progress="spotlight", lamp="rail"  beams sit neutral; hovering a book
//                                       reveals that book's reading colour
//    progress=anything else, lamp="rail"
//                                       rail idles low, and hovering lights
//                                       that book alone while the rest darken
//
//  Cobwebs and the spider live in critters.jsx.
//
//  NOTE: never declare a local named `h` in this file — it is the JSX pragma.
// ════════════════════════════════════════════════════════════════════════════

const core = await dc.require("Meta/Obsidian/_datacore/book/core.jsx");
const { hashOf, clamp } = core;

const PROGRESS_PATTERNS = ["crack", "spotlight", "slip", "ribbon", "bar", "none"];
const LAMP_MODES = ["pointer", "rail"];

// ════════════════════════════════════════════════════════════════════════════
//  Spotlight — the lamp warms up as you read
//
//  Four shades of amber differing only in brightness was too subtle to read.
//  This is a real colour-temperature sweep instead, the range an actual set of
//  bulbs covers, and it runs cold-to-warm:
//
//    unread      6500K   the clinical blue-white of a lamp you never switched on
//    begun       4000K   neutral office white
//    underway    3000K   soft warm, the reading-lamp default
//    nearly done 2200K   deep amber, the light you actually want to sit under
//
//  Hue and brightness move together, so an untouched book and a nearly-finished
//  one are unmistakable at a glance — and every value is a colour a real lamp
//  can produce, so the shelf still reads as lit rather than gelled.
// ════════════════════════════════════════════════════════════════════════════
const SPOT_BANDS = [
  { upto: 0,   rgb: "166, 197, 236", i: 0.30, k: "6500K", name: "cold"        },
  { upto: 34,  rgb: "224, 231, 236", i: 0.54, k: "4000K", name: "neutral"     },
  { upto: 75,  rgb: "255, 214, 158", i: 0.80, k: "3000K", name: "soft warm"   },
  { upto: 100, rgb: "255, 176,  92", i: 1.00, k: "2200K", name: "amber"       },
];

/** The reading-lamp default, and the same bulb turned right down. */
const LAMP_NEUTRAL = { rgb: "255, 214, 158", i: 0.80, name: "3000K" };
const LAMP_IDLE    = { rgb: "236, 208, 168", i: 0.26, name: "standby" };

const spotBand = (pct) =>
  SPOT_BANDS.find((b) => pct <= b.upto) ?? SPOT_BANDS[SPOT_BANDS.length - 1];

const brighter = (b, by = 0.2) => ({ rgb: b.rgb, i: Math.min(1, b.i + by) });

/**
 * Resting and hover colour for one book's beam.
 *
 *   "progress"  reading colour at rest, a touch brighter on hover
 *   "reveal"    neutral at rest, the book's reading colour on hover
 *   "solo"      standby at rest, full warm on hover (neighbours darken in CSS)
 */
const beamVars = (book, mode) => {
  const band = spotBand(book.pct);
  const [rest, hover] =
      mode === "progress" ? [band, brighter(band)]
    : mode === "reveal"   ? [LAMP_NEUTRAL, band]
    :                       [LAMP_IDLE, LAMP_NEUTRAL];

  return {
    "--beam-rgb": rest.rgb,    "--beam-i": rest.i.toFixed(2),
    "--beam-rgb-h": hover.rgb, "--beam-i-h": hover.i.toFixed(2),
  };
};

/**
 * One lamp over one book: the fixture head, its cone, and the pool it casts.
 *
 * The head is the study's spotlight fixture — stem, shade, and an LED that
 * takes the book's reading colour — but there is one per book hanging from a
 * shared rail rather than a single fixture pinned to the shelf. Two cones,
 * resting and hover, cross-fade by opacity.
 */
function Beam() {
  return (
    <>
      <div class="hcs-lampunit" aria-hidden="true">
        <div class="hcs-lamphead"><i /><b /><u /></div>
        <div class="hcs-beam"><i /><i /><i /></div>
        <div class="hcs-beam is-hover" />
      </div>
      <div class="hcs-pool" aria-hidden="true" />
    </>
  );
}

/**
 * The wash that puts the lamp's colour ON the artwork rather than in front of
 * it. soft-light keeps the cover's own values and shifts only its temperature,
 * which is what makes a cold book look unlit and a warm one look inviting.
 */
function Tint() { return <div class="hcs-tint" aria-hidden="true" />; }

function Rail() { return <div class="hcs-rail" aria-hidden="true" />; }

// ════════════════════════════════════════════════════════════════════════════
//  Crack
// ════════════════════════════════════════════════════════════════════════════
function crackPaths(seed, { span = 50, height = 14, segments = 5 } = {}) {
  let s = hashOf(seed) || 1;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const mid = height / 2;
  // 1.6 of headroom top and bottom, so a 1.4-wide round-capped stroke plus the
  // 0.7 lip offset still land inside the viewBox
  const pad = 1.6;

  const arm = (dir) => {
    const pts = [[50, mid]];
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const wander = mid + (rnd() - 0.5) * height * 0.78 * (0.35 + t);
      pts.push([50 + dir * t * span, clamp(pad, wander, height - pad)]);
    }
    return "M" + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L");
  };

  return [arm(-1), arm(1)];
}

function Crack({ book }) {
  const [left, right] = dc.useMemo(() => crackPaths(book.path), [book.path]);
  const t = clamp(0, book.pct / 100, 1);
  const dash = { strokeDasharray: 1, strokeDashoffset: 1 - t };

  return (
    <svg class="hcs-crack" viewBox="0 0 100 14" preserveAspectRatio="none" aria-hidden="true">
      <g class="hcs-crack-lip" transform="translate(0,0.7)">
        <path d={left} pathLength="1" style={dash} />
        <path d={right} pathLength="1" style={dash} />
      </g>
      <g class="hcs-crack-dark">
        <path d={left} pathLength="1" style={dash} />
        <path d={right} pathLength="1" style={dash} />
      </g>
    </svg>
  );
}

function Ribbon({ book }) {
  return <div class="hcs-ribbon" style={{ "--p": book.pct.toFixed(1) }} />;
}

function Bar({ book }) {
  return <div class="hcs-mini"><i style={{ width: `${book.pct}%` }} /></div>;
}

/**
 * A slip of paper tipped in at your page — it travels along the top edge as
 * you advance, and carries the page number. More legible than a ribbon and
 * more physical than a bar.
 */
function Slip({ book }) {
  return (
    <div class="hcs-slip" style={{ "--p": book.pct.toFixed(1) }}>
      <i>{book.progress}</i>
    </div>
  );
}

/** A folded corner that grows with how much of the book you have turned. */
function Dogear({ book }) {
  if (book.pct < 8) return null;
  return (
    <div
      class="hcs-dogear"
      style={{ "--d": (clamp(0, book.pct, 100) / 100).toFixed(3) }}
      aria-hidden="true"
    />
  );
}

/**
 * One entry point for both layers.
 *   layer "art"   rides with the book when it lifts — the ribbon
 *   layer "board" stays on the shelf — the crack, the hairline bar
 */
function Progress({ book, pattern, layer = "board" }) {
  if (!book.pages || pattern === "none" || !pattern) return null;
  if (pattern === "spotlight") return null;          // drawn by the Beam
  if (pattern === "ribbon") return layer === "art" ? <Ribbon book={book} /> : null;
  if (pattern === "slip") return layer === "art" ? <Slip book={book} /> : null;
  if (layer !== "board") return null;
  if (pattern === "crack") return <Crack book={book} />;
  return <Bar book={book} />;
}

// ════════════════════════════════════════════════════════════════════════════
//  Pointer lamp — one warm light for the whole row
//
//  A single pair of overlays spanning the row, rather than a light per book:
//  the falloff is then physically consistent across neighbours, and only one
//  element changes per frame. Colours are tungsten, roughly 2700K.
// ════════════════════════════════════════════════════════════════════════════
function Lamp() {
  return (
    <>
      <div class="hcs-lamp-shade" aria-hidden="true" />
      <div class="hcs-lamp-glow" aria-hidden="true" />
    </>
  );
}

/** Spread onto the row element. rAF-throttled, and never triggers a re-render. */
const lampHandlers = (enabled) => enabled ? {
  onMouseMove: (e) => {
    const el = e.currentTarget;
    const x = e.clientX;
    if (el._lampRaf) return;
    el._lampRaf = requestAnimationFrame(() => {
      el._lampRaf = 0;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--lamp-x", `${(x - r.left).toFixed(0)}px`);
    });
  },
  onMouseEnter: (e) => e.currentTarget.style.setProperty("--lamp-on", "1"),
  onMouseLeave: (e) => {
    const el = e.currentTarget;
    el.style.setProperty("--lamp-on", "0");
    if (el._lampRaf) { cancelAnimationFrame(el._lampRaf); el._lampRaf = 0; }
  },
} : {};

// ════════════════════════════════════════════════════════════════════════════
//  Time of day — the room the case is standing in
// ════════════════════════════════════════════════════════════════════════════
const tintForHour = (hr) =>
    hr < 6  ? { rgb: "64, 88, 140",   a: 0.22, label: "night"   }
  : hr < 10 ? { rgb: "196, 212, 236", a: 0.13, label: "morning" }
  : hr < 17 ? { rgb: "255, 252, 244", a: 0.05, label: "midday"  }
  : hr < 21 ? { rgb: "255, 172,  92", a: 0.15, label: "evening" }
  :           { rgb: "64, 88, 140",   a: 0.22, label: "night"   };

/** Re-checked every ten minutes, so the library drifts through the day. */
function useDaylight(enabled) {
  const [t, setT] = dc.useState(() => tintForHour(new Date().getHours()));
  dc.useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(
      () => setT(tintForHour(new Date().getHours())), 600000);
    return () => window.clearInterval(id);
  }, [enabled]);
  return t;
}

function Daylight({ tint }) {
  return (
    <div
      class="hcs-daylight"
      style={{ "--day-rgb": tint.rgb, "--day-a": tint.a }}
      title={tint.label}
      aria-hidden="true"
    />
  );
}

function GlassDoors() { return <div class="hcs-glass" aria-hidden="true" />; }

return {
  PROGRESS_PATTERNS, LAMP_MODES,
  tintForHour, useDaylight, Daylight, GlassDoors, SPOT_BANDS, LAMP_NEUTRAL, LAMP_IDLE,
  spotBand, beamVars, Beam, Rail, Tint,
  crackPaths, Crack, Ribbon, Bar, Slip, Dogear, Progress,
  Lamp, lampHandlers,
};
