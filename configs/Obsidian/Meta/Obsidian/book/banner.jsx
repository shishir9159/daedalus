// ════════════════════════════════════════════════════════════════════════════
//  banner.jsx  —  shopfront signs above the case, and the pull chain
//  Location: Meta/Obsidian/_datacore/book/banner.jsx
//
//  Ported from the "Dogear Shelf" design studies. Six signs, one argument:
//
//    "steel"          a steel box with a neon tube script — the default
//    "marquee"        theatre marquee, chasing bulbs top and bottom
//    "painted"        a ghost sign faded into the brick, no light at all
//    "flap"           a split-flap departure board that flips in on load
//    "deco sunburst"  the art deco study's fascia: a fan, stepped gilt rules
//                     and rays thrown up the wall behind the title
//    "deco marquee"   the same study's marquee, stepped gold over a black box
//
//  The last two come from shelf="art deco", but nothing ties them to it — any
//  sign goes with any shelf, which is the point of them being one argument.
//
//  Pull the chain at the right to cut the sign; the case drops to an
//  after-hours glow. The chain is skipped for "painted", which was never lit.
//
//  NEON COLOURS
//    The study ships four, and its default is the ice blue #4fd8ff:
//      #4fd8ff  ice blue   (design default)
//      #ff5fa2  hot pink
//      #7bff8f  acid green
//      #ffae3d  amber
//    Any hex works — pass neon="#rrggbb". The colour drives the tube glow, the
//    text halo and the wash the sign throws onto the wall behind the case.
//
//  Monoton is what makes the steel sign read as neon. It is pulled from Google
//  Fonts below; delete that @import if you would rather stay offline, and the
//  sign falls back to the theme's interface font.
//
//  NOTE: never declare a local named `h` in this file — it is the JSX pragma.
// ════════════════════════════════════════════════════════════════════════════

const core = await dc.require("Meta/Obsidian/_datacore/book/core.jsx");
const { clamp } = core;

const BANNERS = ["steel", "marquee", "painted", "flap", "deco sunburst", "deco marquee"];

/** The study's palette. Index 0 is its default. */
const NEON_COLORS = ["#4fd8ff", "#ff5fa2", "#7bff8f", "#ffae3d"];

/** The art deco study's, for the two signs below. Index 0 is its default. */
const DECO_COLORS = ["#e3c24a", "#161547", "#c9ced3", "#7fd4c1"];

/** Signs that have something to switch off. */
const LIGHTABLE = new Set(["steel", "marquee", "flap", "deco sunburst", "deco marquee"]);

/** Signs that light in gold whatever `neon` says, because the metal is the sign. */
const DECO = new Set(["deco sunburst", "deco marquee"]);

// ── the sign faces ─────────────────────────────────────────────────────────
function SteelSign({ sign, subtitle, lit }) {
  return (
    <div class="hcb-steel">
      <div class="hcb-steel-face">
        <i class="hcb-screw tl" /><i class="hcb-screw tr" />
        <i class="hcb-screw bl" /><i class="hcb-screw br" />
        <div class={"hcb-neon" + (lit ? " is-on" : "")}>{sign}</div>
        {subtitle && (
          <div class="hcb-sub">
            <i /><span>{subtitle}</span><i />
          </div>
        )}
      </div>
    </div>
  );
}

function MarqueeSign({ sign, subtitle, lit }) {
  return (
    <div class="hcb-marquee">
      <div class="hcb-marquee-hood" />
      <div class="hcb-marquee-box">
        <div class={"hcb-bulbs is-top" + (lit ? " is-on" : "")} />
        <div class={"hcb-bulbs is-bottom" + (lit ? " is-on" : "")} />
        <div class={"hcb-marquee-text" + (lit ? " is-on" : "")}>{sign}</div>
        {subtitle && <div class="hcb-marquee-sub">{subtitle}</div>}
      </div>
    </div>
  );
}

function PaintedSign({ sign, subtitle }) {
  return (
    <div class="hcb-painted">
      <div class="hcb-painted-text">{sign}</div>
      {subtitle && <div class="hcb-painted-sub">{subtitle}</div>}
    </div>
  );
}

function FlapSign({ sign, subtitle, lit }) {
  const chars = String(sign ?? "").toUpperCase().split("");
  return (
    <div class="hcb-flap">
      <div class="hcb-flap-row">
        {chars.map((ch, i) => (
          <div class="hcb-tile" key={i}>
            <span style={{ animationDelay: `${i * 80}ms` }}>{ch === " " ? "" : ch}</span>
            <i class="hcb-tile-seam" />
          </div>
        ))}
      </div>
      <div class="hcb-flap-foot">
        <span>{subtitle}</span>
        <span class="hcb-flap-status">
          On shelf <i class={"hcb-pip" + (lit ? " is-on" : "")} />
        </span>
      </div>
    </div>
  );
}

/**
 * The art deco fascia: a sunburst thrown up the wall, the fan at the crown,
 * stepped gilt rules above and below, and chevrons flanking the title.
 *
 * Two rules of three above and three below is the whole trick — thick, thinner,
 * hairline, mirrored — and it is what makes a plain word read as a cinema. The
 * fan and the rays are masked gradients, so the sheen runs through the metal
 * and the letters from the same angle.
 */
function DecoSunburstSign({ sign, subtitle, lit }) {
  return (
    <div class="hcb-deco">
      <div class={"hcb-deco-rays" + (lit ? " is-on" : "")} />
      <i class="hcb-deco-fan" />

      <div class="hcb-deco-rules">
        <i class="is-a" /><i class="is-b" /><i class="is-c" />
      </div>

      <div class="hcb-deco-line">
        <div class="hcb-deco-chev"><i /><i /><i /></div>
        <div class={"hcb-deco-title" + (lit ? " is-on" : "")}>{sign}</div>
        <div class="hcb-deco-chev is-r"><i /><i /><i /></div>
      </div>

      <div class="hcb-deco-rules is-flipped">
        <i class="is-c" /><i class="is-b" /><i class="is-a" />
      </div>

      {subtitle && (
        <div class="hcb-deco-sub">
          <span class="hcb-deco-dots"><i /><i /><i /></span>
          <span>{subtitle}</span>
          <span class="hcb-deco-dots is-r"><i /><i /><i /></span>
        </div>
      )}
    </div>
  );
}

/** The same study's marquee: stepped gold over a black box, bulbs inside. */
function DecoMarqueeSign({ sign, subtitle, lit }) {
  return (
    <div class="hcb-decomq">
      <div class="hcb-decomq-step"><i class="is-a" /><i class="is-b" /><i class="is-c" /></div>
      <div class="hcb-decomq-box">
        <div class={"hcb-bulbs is-top is-deco" + (lit ? " is-on" : "")} />
        <div class={"hcb-bulbs is-bottom is-deco" + (lit ? " is-on" : "")} />
        <div class={"hcb-decomq-text" + (lit ? " is-on" : "")}>{sign}</div>
        {subtitle && <div class="hcb-decomq-sub">{subtitle}</div>}
      </div>
      <div class="hcb-decomq-foot" />
    </div>
  );
}

// ── the whole fascia ───────────────────────────────────────────────────────
function Banner({
  banner = "steel",
  sign = "LIBRARY",
  subtitle = "Books & Marginalia",
  neon = NEON_COLORS[0],
  lit = true,
  onToggle,
}) {
  const name = String(banner ?? "").toLowerCase();
  if (!banner || !BANNERS.includes(name)) return null;
  const canSwitch = LIGHTABLE.has(name);
  const on = canSwitch ? lit : true;
  const isDeco = DECO.has(name);

  // Each sign washes the wall in its own light: the marquee amber whatever the
  // neon colour, the flap barely at all, the deco pair in their own gold unless
  // you have asked for one of the deco palette's other three.
  const wash =
      name === "marquee" ? "#ffc078"
    : name === "flap"    ? "#9fb4c4"
    : isDeco             ? (NEON_COLORS.includes(neon) ? DECO_COLORS[0] : neon)
    :                      neon;
  const washA =
      name === "flap" ? 0.18
    : name === "deco sunburst" ? 0.28
    : name === "deco marquee" ? 0.34
    : name === "marquee" ? 0.38
    : 0.5;

  return (
    <div class="hcb" style={{ "--neon": neon, "--deco": wash }}>
      <div
        class="hcb-wash"
        style={{ background: `radial-gradient(closest-side, ${wash}, transparent)`,
                 opacity: on ? washA : 0 }}
        aria-hidden="true"
      />

      {/* the mount is only as wide as the sign, so the chain hangs beside it
          rather than out at the edge of the case */}
      <div class="hcb-mount">
        {name !== "painted" && !isDeco && <><i class="hcb-post is-l" /><i class="hcb-post is-r" /></>}

        {name === "steel"   && <SteelSign   sign={sign} subtitle={subtitle} lit={on} />}
        {name === "marquee" && <MarqueeSign sign={sign} subtitle={subtitle} lit={on} />}
        {name === "painted" && <PaintedSign sign={sign} subtitle={subtitle} />}
        {name === "flap"    && <FlapSign    sign={sign} subtitle={subtitle} lit={on} />}
        {name === "deco sunburst" && <DecoSunburstSign sign={sign} subtitle={subtitle} lit={on} />}
        {name === "deco marquee"  && <DecoMarqueeSign  sign={sign} subtitle={subtitle} lit={on} />}

        {canSwitch && onToggle && (
          <div
            class="hcb-chain"
            role="button"
            tabIndex={0}
            title={on ? "Pull to close" : "Pull to open"}
            onClick={onToggle}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onToggle()}
          >
            <i class="hcb-chain-cord" />
            <i class="hcb-chain-grip" />
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  styles
// ════════════════════════════════════════════════════════════════════════════
const BANNER_STYLE_ID = "book-datacore-banner-styles";

const BANNER_CSS = `@import url('https://fonts.googleapis.com/css2?family=Monoton&family=Barlow+Condensed:wght@400;600;700&family=Limelight&family=Federo&display=swap');

.hcb {
  position: relative; z-index: 4;
  display: flex; flex-direction: column; align-items: center;
  margin: 0 auto -6px; padding-top: 8px;
  font-family: 'Barlow Condensed', var(--font-interface), sans-serif;
}
.hcb-wash {
  position: absolute; top: -30px; left: 50%; translate: -50% 0;
  width: min(760px, 90%); height: 300px; pointer-events: none;
  mix-blend-mode: screen; filter: blur(46px); border-radius: 50%;
  transition: opacity .6s ease;
}
/* only as wide as the sign it holds, so anything hung off its edge lands
   beside the sign rather than at the far side of the case */
.hcb-mount { position: relative; display: inline-block; }

/* the two posts the sign hangs from */
.hcb-post {
  position: absolute; bottom: -18px; width: 9px; height: 24px;
  background: linear-gradient(90deg, #4c5157, #aab0b6 40%, #5d6268);
  box-shadow: 0 2px 4px rgba(0,0,0,.6);
}
.hcb-post.is-l { left: 26%; }
.hcb-post.is-r { right: 26%; }

/* ── the pull chain ───────────────────────────────────────────────────── */
.hcb-chain {
  position: absolute; top: -44px; right: -34px; bottom: 8px; width: 22px;
  display: flex; flex-direction: column; align-items: center;
  cursor: pointer; z-index: 6;
  transition: translate .12s ease-out;
}
.hcb-chain:hover { translate: 0 3px; }
.hcb-chain:active { translate: 0 6px; }
.hcb-chain:focus-visible { outline: 2px solid var(--text-accent); outline-offset: 3px; }
.hcb-chain-cord {
  width: 3px; flex: 1;
  background: repeating-linear-gradient(180deg, #cfd3d7 0 2px, #6f7479 2px 5px);
  box-shadow: 0 0 3px rgba(0,0,0,.7);
}
.hcb-chain-grip {
  width: 13px; height: 30px; border-radius: 7px; flex: none;
  background: linear-gradient(90deg, #8a6f34, #e2c37a 40%, #8a6f34);
  box-shadow: 0 3px 6px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.5);
}

/* ── 01 · steel and neon ──────────────────────────────────────────────── */
.hcb-steel {
  position: relative; padding: 9px; border-radius: 8px;
  background: linear-gradient(#b9bfc4, #6e747a 38%, #3f4348 62%, #8b9197);
  box-shadow: 0 18px 34px rgba(0,0,0,.65),
              inset 0 1px 0 rgba(255,255,255,.5), inset 0 -1px 0 rgba(0,0,0,.5);
}
.hcb-steel-face {
  position: relative; padding: 20px 58px 14px; border-radius: 3px;
  background-color: #413d39;
  background-image:
    radial-gradient(circle at 20% 30%, rgba(255,255,255,.05) 0 1.5px, transparent 2px),
    radial-gradient(circle at 70% 65%, rgba(0,0,0,.28) 0 2px, transparent 3px),
    radial-gradient(circle at 44% 82%, rgba(255,255,255,.04) 0 1px, transparent 2px),
    linear-gradient(#4b4642, #332f2c);
  background-size: 38px 31px, 53px 47px, 29px 23px, 100% 100%;
  box-shadow: inset 0 2px 6px rgba(0,0,0,.75), inset 0 -2px 0 rgba(255,255,255,.05);
}
.hcb-screw {
  position: absolute; width: 11px; height: 11px; border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #dfe4e8, #6d7379 60%, #3a3e42);
  box-shadow: 0 1px 2px rgba(0,0,0,.7);
}
.hcb-screw.tl { top: 8px; left: 9px; }
.hcb-screw.tr { top: 8px; right: 9px; }
.hcb-screw.bl { bottom: 8px; left: 9px; }
.hcb-screw.br { bottom: 8px; right: 9px; }

.hcb-neon {
  font-family: 'Monoton', var(--font-interface), cursive;
  font-size: clamp(30px, 5vw, 58px); line-height: 1.05; letter-spacing: .06em;
  text-align: center; color: #3f4448;
  -webkit-text-stroke: 1px rgba(255,255,255,.10);
  text-shadow: 0 1px 0 rgba(255,255,255,.05), 0 -1px 2px rgba(0,0,0,.8);
  transition: color .4s, text-shadow .4s;
}
.hcb-neon.is-on {
  color: #f4feff; -webkit-text-stroke: 0;
  text-shadow: 0 0 4px #fff, 0 0 12px var(--neon), 0 0 26px var(--neon),
               0 0 56px var(--neon), 0 0 100px var(--neon);
  animation: hcb-flick 7s linear infinite;
}
@keyframes hcb-flick {
  0%,100% { opacity: 1 } 42% { opacity: 1 } 43% { opacity: .55 } 44% { opacity: 1 }
  78% { opacity: 1 } 79% { opacity: .7 } 80.5% { opacity: 1 }
}

.hcb-sub {
  margin-top: 12px; display: flex; align-items: center; justify-content: center; gap: 14px;
  font-size: 14px; font-weight: 600; letter-spacing: .42em; text-transform: uppercase;
  color: #8d9296; text-shadow: 0 1px 0 rgba(255,255,255,.13), 0 -1px 1px rgba(0,0,0,.8);
}
.hcb-sub i { width: 56px; height: 1px; background: rgba(255,255,255,.22); }

/* ── 02 · marquee bulbs ───────────────────────────────────────────────── */
.hcb-marquee { position: relative; width: min(600px, 92%); }
.hcb-marquee-hood {
  height: 24px; margin: 0 -20px;
  clip-path: polygon(3.4% 0, 96.6% 0, 100% 100%, 0 100%);
  background: linear-gradient(180deg, #333c38, #141917);
  box-shadow: 0 10px 20px rgba(0,0,0,.6);
}
.hcb-marquee-box {
  position: relative; padding: 28px 46px 22px;
  background: linear-gradient(180deg, #141211, #201d1a 55%, #0d0c0b);
  border-left: 7px solid #2c2926; border-right: 7px solid #2c2926;
  box-shadow: 0 26px 44px rgba(0,0,0,.7), inset 0 0 50px rgba(0,0,0,.85);
}
.hcb-bulbs {
  position: absolute; left: 13px; right: 13px; height: 14px; opacity: .22;
  background-image: radial-gradient(circle at 7px 7px, #fff6de 0 3.2px, #d9a94e 3.9px, rgba(0,0,0,0) 5px);
  background-size: 26px 14px; background-repeat: repeat-x;
  transition: opacity .4s;
}
.hcb-bulbs.is-top { top: 8px; }
.hcb-bulbs.is-bottom { bottom: 8px; }
.hcb-bulbs.is-on {
  opacity: 1; filter: drop-shadow(0 0 7px rgba(255,205,125,.95));
  animation: hcb-chase 1.2s steps(2) infinite;
}
@keyframes hcb-chase { to { background-position: 52px 0; } }

.hcb-marquee-text {
  text-align: center; font-weight: 700;
  font-size: clamp(34px, 6vw, 62px); line-height: 1; letter-spacing: .14em;
  text-transform: uppercase; color: #4a453e;
  text-shadow: 0 1px 0 rgba(255,255,255,.05);
  transition: color .4s, text-shadow .4s;
}
.hcb-marquee-text.is-on {
  color: #fff3d8;
  text-shadow: 0 0 10px rgba(255,214,150,.9), 0 0 34px rgba(255,190,110,.55);
}
.hcb-marquee-sub {
  margin-top: 10px; text-align: center; font-size: 12px; font-weight: 500;
  letter-spacing: .5em; text-transform: uppercase; color: #b0894f;
}

/* ── 03 · painted ghost sign ──────────────────────────────────────────── */
.hcb-painted { position: relative; width: min(720px, 94%); padding: 8px 0 20px; text-align: center; }
.hcb-painted-text {
  font-weight: 600; font-size: clamp(46px, 8vw, 90px); line-height: .95;
  letter-spacing: .12em; text-transform: uppercase;
  color: rgba(236,225,201,.55); text-shadow: 0 3px 0 rgba(0,0,0,.45);
  -webkit-mask-image: linear-gradient(102deg, rgba(0,0,0,.3) 3%, #000 18%, rgba(0,0,0,.5) 34%, #000 52%, rgba(0,0,0,.4) 66%, #000 82%, rgba(0,0,0,.25) 98%);
  mask-image: linear-gradient(102deg, rgba(0,0,0,.3) 3%, #000 18%, rgba(0,0,0,.5) 34%, #000 52%, rgba(0,0,0,.4) 66%, #000 82%, rgba(0,0,0,.25) 98%);
}
.hcb-painted-sub {
  margin-top: 16px; font-size: 12px; font-weight: 500;
  letter-spacing: .54em; text-transform: uppercase; color: rgba(216,206,188,.4);
}

/* ── 04 · split-flap board ────────────────────────────────────────────── */
.hcb-flap {
  position: relative; padding: 14px 16px 11px; border-radius: 5px;
  background: linear-gradient(180deg, #767c81, #3d4247 38%, #23272b);
  box-shadow: 0 22px 40px rgba(0,0,0,.7),
              inset 0 1px 0 rgba(255,255,255,.4), inset 0 -2px 0 rgba(0,0,0,.5);
}
.hcb-flap-row { display: flex; gap: 5px; perspective: 600px; transform-style: preserve-3d; }
.hcb-tile {
  position: relative; width: 56px; height: 76px; border-radius: 3px; overflow: hidden;
  background: linear-gradient(180deg, #262a2e, #161a1d 49%, #0f1214 51%, #1c2023);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.1), 0 4px 7px rgba(0,0,0,.6);
  display: flex; align-items: center; justify-content: center;
}
.hcb-tile span {
  font-weight: 600; font-size: 54px; color: #ece7da;
  text-shadow: 0 2px 5px rgba(0,0,0,.9);
  animation: hcb-flap .55s cubic-bezier(.3,1.4,.5,1) both;
  will-change: transform;
}
@keyframes hcb-flap {
  0%   { transform: rotateX(-88deg); opacity: 0 }
  60%  { transform: rotateX(12deg); opacity: 1 }
  100% { transform: none; opacity: 1 }
}
.hcb-tile-seam {
  position: absolute; left: 0; right: 0; top: 50%; height: 1px;
  background: rgba(0,0,0,.9); box-shadow: 0 1px 0 rgba(255,255,255,.06);
}
.hcb-flap-foot {
  margin-top: 10px; display: flex; align-items: center; justify-content: space-between;
  padding: 0 3px; font-size: 10px; font-weight: 600;
  letter-spacing: .32em; text-transform: uppercase; color: #9aa0a5;
}
.hcb-flap-status { display: flex; align-items: center; gap: 8px; color: #7d848a; letter-spacing: .26em; }
.hcb-pip {
  width: 9px; height: 9px; border-radius: 50%; background: #3a3d40;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.1); transition: all .4s;
}
.hcb-pip.is-on { background: #ffc46a; box-shadow: 0 0 8px rgba(255,190,110,.95); }


/* ── 05 · art deco sunburst ───────────────────────────────────────────── */
/*
 * One gradient does all the metal — --sheen — so every gilt edge and the
 * letters themselves catch the light from the same 150deg. The rays are a
 * repeating conic gradient masked to a soft disc, which is a fan of light
 * rather than a fan of hard wedges.
 */
/* The fan is declared here, not borrowed from the deco SHELF: either sign goes
   with either shelf, so a deco banner over an oak case must still have one. */
.hcb-deco {
  --sheen: linear-gradient(150deg, #e3c24a 0%, #e8c953 26%, #eedc8f 45%, #f7efc9 51%, #e5c65b 80%);
  --sheen-deep: linear-gradient(150deg, #a2822a, #e3c24a 50%, #a2822a);
  --fan: url("data:image/svg+xml,%3Csvg width='13.533353mm' height='13.665177mm' viewBox='0 0 13.533353 13.665177' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3CclipPath clipPathUnits='userSpaceOnUse' id='c'%3E%3Crect style='fill:%23ffffff;stroke:none' width='13.533353' height='13.665177' x='86.292633' y='113.41824' /%3E%3C/clipPath%3E%3C/defs%3E%3Cg transform='translate(-86.292633,-113.41824)'%3E%3Cg clip-path='url(%23c)' style='fill:none;stroke:%23000000;stroke-width:0.264999'%3E%3Cpath d='m 93.059653,127.08343 a 6.766336,6.766336 0 0 1 6.766336,-6.76634' /%3E%3Cpath d='m 86.293106,120.31709 a 6.766336,6.766336 0 0 1 6.766336,6.76634' /%3E%3Cpath d='m 86.29772,120.31709 a 6.766336,6.766336 0 0 1 6.766336,-6.76633 6.766336,6.766336 0 0 1 6.766336,6.76633' /%3E%3Cpath d='m 93.059874,127.1504 c -0.01,-1.5182 0.319616,-3.03719 0.987396,-4.44032 1.087733,-2.28553 2.979917,-4.06856 5.289083,-5.02655' /%3E%3Cpath d='m 93.059133,127.15011 c -0.01822,-4.33881 1.731996,-8.53918 4.893523,-11.58816' /%3E%3Cpath d='m 93.059678,127.12677 c -0.0045,-4.49797 0.69305,-8.97012 2.068264,-13.25456' /%3E%3Cpath d='m 93.05944,127.14092 c 0.01,-1.5182 -0.319616,-3.03719 -0.987396,-4.44032 -1.087733,-2.28553 -2.979917,-4.06856 -5.289083,-5.02655' /%3E%3Cpath d='m 93.060181,127.14063 c 0.01822,-4.33881 -1.731996,-8.53918 -4.893523,-11.58816' /%3E%3Cpath d='m 93.059636,127.11729 c 0.0045,-4.49797 -0.69305,-8.97012 -2.068264,-13.25456' /%3E%3Cpath d='M 93.059651,127.08342 V 113.55076' /%3E%3Cpath d='m 86.292873,120.39394 c -0.01,-1.5182 0.319616,-3.03719 0.987396,-4.44032 1.087733,-2.28553 2.979917,-4.06856 5.289083,-5.02655' /%3E%3Cpath d='m 86.292132,120.39365 c -0.01822,-4.33881 1.731996,-8.53918 4.893523,-11.58816' /%3E%3Cpath d='m 86.292677,120.37031 c -0.0045,-4.49797 0.69305,-8.97012 2.068264,-13.25456' /%3E%3Cpath d='M 86.29265,120.32696 V 106.7943' /%3E%3Cpath d='m 99.82532,120.38446 c 0.01,-1.5182 -0.319616,-3.03719 -0.987396,-4.44032 -1.087733,-2.28553 -2.979917,-4.06856 -5.289083,-5.02655' /%3E%3Cpath d='m 99.826061,120.38417 c 0.01822,-4.33881 -1.731996,-8.53918 -4.893523,-11.58816' /%3E%3Cpath d='m 99.825516,120.36083 c 0.0045,-4.49797 -0.69305,-8.97012 -2.068264,-13.25456' /%3E%3Cpath d='M 99.825531,120.32696 V 106.7943' /%3E%3Cpath d='m 86.293329,133.91673 c -0.01,-1.5182 0.319616,-3.03719 0.987396,-4.44032 1.087733,-2.28553 2.979917,-4.06856 5.289083,-5.02655' /%3E%3Cpath d='m 86.292588,133.91644 c -0.01822,-4.33881 1.731996,-8.53918 4.893523,-11.58816' /%3E%3Cpath d='m 86.293133,133.8931 c -0.0045,-4.49797 0.69305,-8.97012 2.068264,-13.25456' /%3E%3Cpath d='M 86.293106,133.84975 V 120.31709' /%3E%3Cpath d='m 99.825778,133.90725 c 0.01,-1.5182 -0.319616,-3.03719 -0.987396,-4.44032 -1.087733,-2.28553 -2.979917,-4.06856 -5.289083,-5.02655' /%3E%3Cpath d='m 99.826519,133.90696 c 0.01822,-4.33881 -1.731996,-8.53918 -4.893523,-11.58816' /%3E%3Cpath d='m 99.825974,133.88362 c 0.0045,-4.49797 -0.69305,-8.97012 -2.068264,-13.25456' /%3E%3Cpath d='M 99.825989,133.84975 V 120.31709' /%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
  position: relative; width: min(820px, 96%); padding: 22px 0 10px;
  display: flex; flex-direction: column; align-items: center;
  font-family: 'Federo', var(--font-interface), sans-serif;
}
.hcb-deco-rays {
  position: absolute; left: 50%; bottom: -6px; translate: -50% 0;
  width: 104%; height: 400px; pointer-events: none; opacity: .1;
  background: repeating-conic-gradient(from 196deg at 50% 100%,
    rgba(227,194,74,.55) 0deg 1deg, rgba(227,194,74,0) 1deg 8deg);
  -webkit-mask-image: radial-gradient(closest-side at 50% 100%, rgba(0,0,0,.95) 6%, rgba(0,0,0,.4) 46%, transparent 80%);
  mask-image: radial-gradient(closest-side at 50% 100%, rgba(0,0,0,.95) 6%, rgba(0,0,0,.4) 46%, transparent 80%);
  transition: opacity .6s ease;
}
.hcb-deco-rays.is-on { opacity: .5; }

.hcb-deco-fan {
  display: block; width: 56px; height: 56px; opacity: .9;
  background-image: var(--sheen);
  -webkit-mask-image: var(--fan); mask-image: var(--fan);
  -webkit-mask-size: contain; mask-size: contain;
  -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat;
}

/* thick, thinner, hairline — mirrored underneath */
.hcb-deco-rules {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  width: 100%; margin-top: 14px;
}
.hcb-deco-rules.is-flipped { margin-top: 0; }
.hcb-deco-rules i { display: block; }
.hcb-deco-rules .is-a { width: 64%; height: 5px; background-image: var(--sheen); box-shadow: 0 1px 3px rgba(0,0,0,.7); }
.hcb-deco-rules .is-b { width: 74%; height: 3px; background-image: var(--sheen-deep); opacity: .85; }
.hcb-deco-rules .is-c { width: 81%; height: 1px; background: rgba(227,194,74,.45); }

.hcb-deco-line {
  position: relative; margin: 10px 0 8px;
  display: flex; align-items: center; gap: 26px;
}
.hcb-deco-chev { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; }
.hcb-deco-chev.is-r { align-items: flex-start; }
.hcb-deco-chev i { display: block; height: 3px; background: #e3c24a; }
.hcb-deco-chev i:nth-child(1) { width: 52px; opacity: .9; }
.hcb-deco-chev i:nth-child(2) { width: 34px; opacity: .6; }
.hcb-deco-chev i:nth-child(3) { width: 18px; opacity: .35; }

.hcb-deco-title {
  font-family: 'Limelight', var(--font-interface), serif;
  font-size: clamp(38px, 6.4vw, 82px); line-height: 1;
  letter-spacing: .05em; text-transform: uppercase;
  background-image: linear-gradient(150deg, #c8a63a 0%, #e3c24a 26%, #f0dd94 45%, #fdf7d8 51%, #dcbc4e 80%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  filter: brightness(.42) drop-shadow(0 1px 0 rgba(0,0,0,.7));
  transition: filter .5s ease;
}
.hcb-deco-title.is-on {
  filter: drop-shadow(0 0 14px var(--deco, #e3c24a)) drop-shadow(0 2px 0 rgba(0,0,0,.6));
}

.hcb-deco-sub {
  margin-top: 16px; display: flex; align-items: center; gap: 16px;
  font-size: 13px; letter-spacing: .52em; text-transform: uppercase;
  color: rgba(233,222,193,.62);
}
.hcb-deco-dots { display: flex; align-items: center; gap: 5px; }
.hcb-deco-dots i { display: block; border-radius: 50%; background: rgba(227,194,74,.35); }
.hcb-deco-dots i:nth-child(1) { width: 4px; height: 4px; }
.hcb-deco-dots i:nth-child(2) { width: 6px; height: 6px; background: rgba(227,194,74,.55); }
.hcb-deco-dots i:nth-child(3) { width: 9px; height: 9px; background: #e3c24a; }
.hcb-deco-dots.is-r { flex-direction: row-reverse; }

/* ── 06 · art deco marquee ────────────────────────────────────────────── */
.hcb-decomq {
  --sheen: linear-gradient(150deg, #e3c24a 0%, #e8c953 26%, #eedc8f 45%, #f7efc9 51%, #e5c65b 80%);
  --sheen-deep: linear-gradient(150deg, #8f7326, #e3c24a 50%, #8f7326);
  position: relative; width: min(790px, 97%);
  font-family: 'Federo', var(--font-interface), sans-serif;
}
.hcb-decomq-step { display: flex; flex-direction: column; align-items: center; gap: 3px; }
.hcb-decomq-step i { display: block; }
.hcb-decomq-step .is-a { width: 46%; height: 7px; background-image: var(--sheen); }
.hcb-decomq-step .is-b { width: 70%; height: 9px; background-image: var(--sheen-deep); }
.hcb-decomq-step .is-c { width: 97%; height: 13px; background-image: var(--sheen); box-shadow: 0 10px 22px rgba(0,0,0,.7); }
.hcb-decomq-box {
  position: relative; padding: 28px 46px 22px;
  background: linear-gradient(180deg, #101315, #1a1e21 55%, #0b0d0f);
  border-left: 6px solid #1e2327; border-right: 6px solid #1e2327;
  box-shadow: 0 26px 44px rgba(0,0,0,.72), inset 0 0 56px rgba(0,0,0,.85);
}
.hcb-bulbs.is-deco {
  background-image: radial-gradient(circle at 7px 7px, #fff6de 0 3.2px, #e3c24a 3.9px, rgba(0,0,0,0) 5px);
}
.hcb-bulbs.is-deco.is-on { filter: drop-shadow(0 0 7px rgba(240,215,130,.95)); }
.hcb-decomq-text {
  text-align: center; font-family: 'Limelight', var(--font-interface), serif;
  font-size: clamp(32px, 6vw, 66px); line-height: 1; letter-spacing: .07em;
  text-transform: uppercase; color: #3e3a31;
  text-shadow: 0 1px 0 rgba(255,255,255,.04);
  transition: color .4s, text-shadow .4s;
}
.hcb-decomq-text.is-on {
  color: #fdf6de;
  text-shadow: 0 0 10px rgba(240,220,150,.85), 0 0 36px rgba(227,194,74,.55);
}
.hcb-decomq-sub {
  margin-top: 13px; text-align: center; font-size: 12px;
  letter-spacing: .5em; text-transform: uppercase; color: #c9a63f;
}
.hcb-decomq-foot {
  height: 12px; margin: 0 -6px;
  background-image: var(--sheen-deep); box-shadow: 0 8px 18px rgba(0,0,0,.6);
}

/* the chain, in the deco idiom: a faceted brass drop rather than a bead */
.hcb:has(.hcb-deco) .hcb-chain-cord,
.hcb:has(.hcb-decomq) .hcb-chain-cord {
  width: 2px; background: repeating-linear-gradient(180deg, #e8d391 0 2px, #8a6f34 2px 5px);
}
.hcb:has(.hcb-deco) .hcb-chain-grip,
.hcb:has(.hcb-decomq) .hcb-chain-grip {
  width: 14px; height: 24px; border-radius: 0;
  background-image: linear-gradient(150deg, #8a6f34, #e3c24a 45%, #f5ebc4 51%, #8a6f34);
  clip-path: polygon(50% 0, 100% 26%, 100% 74%, 50% 100%, 0 74%, 0 26%);
}

@media (prefers-reduced-motion: reduce) {
  .hcs:not(.has-motion) .hcb-neon.is-on,
  .hcs:not(.has-motion) .hcb-bulbs.is-on,
  .hcs:not(.has-motion) .hcb-tile span { animation: none; }
}
.hcs.no-motion .hcb-neon.is-on,
.hcs.no-motion .hcb-bulbs.is-on,
.hcs.no-motion .hcb-tile span { animation: none; }
`;

function BannerStyles() {
  dc.useEffect(() => {
    let el = document.getElementById(BANNER_STYLE_ID);
    if (!el) {
      el = document.createElement("style");
      el.id = BANNER_STYLE_ID;
      document.head.appendChild(el);
    }
    if (el.textContent !== BANNER_CSS) el.textContent = BANNER_CSS;
  }, []);
  return null;
}

return { BANNERS, NEON_COLORS, DECO_COLORS, LIGHTABLE, DECO, Banner, BannerStyles };
