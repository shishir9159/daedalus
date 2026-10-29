// ════════════════════════════════════════════════════════════════════════════
//  cobweb.jsx  —  cobwebs, pixel-art or smooth
//  Location: Meta/Obsidian/_datacore/book/cobweb.jsx
//
//  A renderer for MakhamDev's "Cobweb" Pixel Composer project
//  (https://pixel-composer.com/projects/Cobweb/): rings and spokes of sagging
//  cables, blended over a vignetted gradient and posterized to a palette — or
//  stroked as anti-aliased curves (`pixelated={false}`). Positions are in units
//  of the canvas's shorter side, so a web keeps its shape at any size.
//
//    const { Cobweb } = await dc.require("Meta/Obsidian/_datacore/book/cobweb.jsx");
//
//  NOTE: never declare a local named `h` in this file — it is the JSX pragma.
// ════════════════════════════════════════════════════════════════════════════

const CORNERS = ["top-left", "top-right", "bottom-left", "bottom-right"];

const DEFAULTS = {
  // Canvas size, in pixels.
  width: 64,
  height: 64,
  // Any string or number (a book's path, say) picks a pattern of its own: a
  // value for every option from `corner` to `phase` that isn't passed explicitly.
  seed: undefined,
  // One of CORNERS. Positions below are for "top-left"; the other corners mirror them.
  corner: "top-left",
  // Size of the web, scaling it about its corner.
  reach: 1,
  // Closed outline of the web: Pixel Composer's points on its 64px canvas.
  outline: [[3.35, 4.374], [63.457, 1.543], [29.736, 46.956], [5.064, 54.803]].map(([x, y]) => [x / 64, y / 64]),
  // Hub of the web; the inner rings are the outline scaled around it.
  center: [15.662 / 64, 22.805 / 64],
  spokes: 8,
  // Moves the spokes along the outline, as a fraction of the gap between two.
  twist: 0,
  // Scale of each ring about the hub; 1 is the outline.
  rings: [1, 0.6776, 0.6776 * 0.4924],
  // How far a strand hangs, as a fraction of its length.
  sag: 0.27,
  // Anchors per spoke; each stretch between two anchors sags on its own.
  spokeAnchors: 3,
  // Random wobble of the anchors.
  jitter: 0,
  // Fraction of strands that have snapped.
  torn: 0,
  // Where in the sway cycle the web starts, so neighbouring webs don't move in step.
  phase: 0,
  // How much the sag swings over a cycle of `time` (0..1).
  sway: 0.3,
  time: 0,
  // false: no backdrop, only strands of `color` on a transparent canvas, to lay over a picture.
  backdrop: true,
  color: "#ffffff",
  webOpacity: 0.35,
  gradientTop: "#808080",
  gradientBottom: "#000000",
  vignetteStrength: 31.624,
  vignetteExtent: 0.25,
  palette: ["#ff8274", "#d53c6a", "#7c183c", "#460e2b", "#31051e", "#1f0510", "#130208"],
};

const rgb = (hex) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

// Little-endian RGBA, as canvas ImageData lays it out.
const pack = ([r, g, b], a = 255) => (a << 24) | (b << 16) | (g << 8) | r;

const lerp = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];

// Repeatable random numbers in [0, 1) for any seed: FNV-1a driving mulberry32.
function random(seed) {
  let s = 2166136261;
  for (const c of String(seed)) s = Math.imul(s ^ c.codePointAt(0), 16777619);
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

// The pattern a seed picks.
function variant(seed) {
  const r = random(seed), between = (a, b) => a + (b - a) * r(), int = (a, b) => Math.floor(between(a, b + 1));
  const outline = DEFAULTS.outline.map(([x, y]) => [x * between(0.75, 1.05), y * between(0.75, 1.05)]);
  // Hub: a weighted mean of the outline's points, pulled towards the corner one.
  const weights = outline.map((_, i) => (i ? between(0.2, 1.2) : between(1.5, 3)));
  const sum = weights.reduce((a, b) => a + b);
  const center = outline.reduce(([x, y], p, i) => [x + (p[0] * weights[i]) / sum, y + (p[1] * weights[i]) / sum], [0, 0]);
  const count = int(2, 5), inner = between(0.2, 0.45);
  return {
    // Mostly the top corners: down low, the sag piles the web against the edge.
    corner: CORNERS[r() < 0.8 ? int(0, 1) : int(2, 3)],
    reach: between(0.6, 1),
    outline,
    center,
    spokes: int(5, 11),
    twist: r(),
    rings: Array.from({ length: count }, (_, i) => 1 - (i * (1 - inner)) / (count - 1)),
    sag: between(0.15, 0.38),
    spokeAnchors: int(2, 4),
    jitter: between(0, 0.025),
    torn: r() < 0.4 ? between(0.03, 0.2) : 0,
    phase: r(),
  };
}

/** Every option for `opts`: as passed, else as its seed picks, else the default. */
function resolve(opts = {}) {
  const given = Object.fromEntries(Object.entries(opts).filter(([, v]) => v != null));
  return { ...DEFAULTS, ...("seed" in given && variant(given.seed)), ...given };
}

// Get-or-make from a Map used as a least-recently-used cache of `limit` entries.
function memo(cache, limit, key, make) {
  let v = cache.get(key);
  if (v === undefined) {
    v = make();
    if (cache.size >= limit) cache.delete(cache.keys().next().value);
  } else cache.delete(key);
  cache.set(key, v);
  return v;
}

// Point at fraction t of the way around a closed polyline, by arc length.
function sampler(pts) {
  let total = 0;
  const segs = pts.map((a, i) => {
    const b = pts[(i + 1) % pts.length];
    const seg = { a, b, len: Math.hypot(b[0] - a[0], b[1] - a[1]), start: total };
    total += seg.len;
    return seg;
  });
  return (t) => {
    const d = (((t % 1) + 1) % 1) * total;
    const s = segs.find((s) => d <= s.start + s.len) ?? segs.at(-1);
    return lerp(s.a, s.b, s.len ? (d - s.start) / s.len : 0);
  };
}

// Final colour of every pixel without (bg) and with (fg) a strand on it. It
// depends only on the look, so every web that looks alike shares it.
const looks = new Map();
function look(o) {
  const { width: w, height: ht, webOpacity: a, vignetteStrength, vignetteExtent } = o;
  const key = [w, ht, a, o.backdrop, o.color, vignetteStrength, vignetteExtent, o.gradientTop, o.gradientBottom, o.palette].join();
  return memo(looks, 16, key, () => {
    const bg = new Uint32Array(w * ht), fg = new Uint32Array(w * ht);
    if (!o.backdrop) return { bg, fg: fg.fill(pack(rgb(o.color), Math.round(a * 255))) };

    const top = rgb(o.gradientTop), bot = rgb(o.gradientBottom), pal = o.palette.map(rgb);
    const packed = pal.map((c) => pack(c));
    // Posterize: nearest palette colour in RGB.
    const nearest = (r, g, b) => {
      let best = 0, bestD = Infinity;
      for (let p = 0; p < pal.length; p++) {
        const d = (r - pal[p][0]) ** 2 + (g - pal[p][1]) ** 2 + (b - pal[p][2]) ** 2;
        if (d < bestD) { bestD = d; best = p; }
      }
      return packed[best];
    };
    for (let y = 0, i = 0; y < ht; y++) {
      const v = (y + 0.5) / ht;
      const row = top.map((c, ch) => c + (bot[ch] - c) * v);
      for (let x = 0; x < w; x++, i++) {
        const u = (x + 0.5) / w;
        // Vignette: (u(1-v) · v(1-u) · strength) ^ extent, clamped to 1.
        const vig = Math.min(1, (u * (1 - v) * v * (1 - u) * vignetteStrength) ** vignetteExtent);
        const r = row[0] * vig, g = row[1] * vig, b = row[2] * vig;
        bg[i] = nearest(r, g, b);
        fg[i] = nearest(r * (1 - a) + 255 * a, g * (1 - a) + 255 * a, b * (1 - a) + 255 * a);
      }
    }
    return { bg, fg };
  });
}

// Indices of the pixels the strands (ax, ay, bx, by, ...) cover at a given sag.
// A strand is a parabola pulled straight down, stepped every half pixel and
// joined with 1px Bresenham lines.
function raster(lines, sag, w, ht) {
  const hit = new Uint8Array(w * ht);
  let count = 0;
  for (let s = 0; s < lines.length; s += 4) {
    const ax = lines[s], ay = lines[s + 1], dx = lines[s + 2] - ax, dy = lines[s + 3] - ay, len = Math.hypot(dx, dy);
    const drop = sag * len, steps = Math.max(2, Math.ceil(len * 2));
    let x0 = Math.floor(ax), y0 = Math.floor(ay);
    for (let i = 1; i <= steps; i++) {
      const u = i / steps;
      const x1 = Math.floor(ax + dx * u), y1 = Math.floor(ay + dy * u + drop * 4 * u * (1 - u));
      const bw = Math.abs(x1 - x0), bh = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      for (let err = bw + bh; ;) {
        if (x0 >= 0 && y0 >= 0 && x0 < w && y0 < ht && !hit[y0 * w + x0]) { hit[y0 * w + x0] = 1; count++; }
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= bh) { err += bh; x0 += sx; }
        if (e2 <= bw) { err += bw; y0 += sy; }
      }
    }
  }
  const idx = new (w * ht > 65536 ? Uint32Array : Uint16Array)(count);
  for (let i = 0, j = 0; j < count; i++) if (hit[i]) idx[j++] = i;
  return idx;
}

const webs = new Map(), masks = new Map();
let ids = 0;

// Lays out the strands once; a frame then only looks up (or rasterizes) its pixels.
function layout(o) {
  const { width: w, height: ht, spokes } = o;
  const r = random([o.seed, "strands"]);
  // Design units to pixels, mirrored into the chosen corner.
  const s = Math.min(w, ht) * o.reach, flipX = o.corner.endsWith("right"), flipY = o.corner.startsWith("bottom");
  const px = ([x, y]) => [flipX ? w - x * s : x * s, flipY ? ht - y * s : y * s];
  const wobble = ([x, y]) => (o.jitter ? [x + (r() * 2 - 1) * o.jitter * s, y + (r() * 2 - 1) * o.jitter * s] : [x, y]);
  const hub = px(o.center), lines = [];
  const chain = (pts) => {
    for (let i = 1; i < pts.length; i++) if (r() >= o.torn) lines.push(...pts[i - 1], ...pts[i]);
  };

  // One anchor per spoke around the outline; each ring is that loop scaled around the hub.
  const sample = sampler(o.outline.map(px));
  const rim = Array.from({ length: spokes }, (_, i) => wobble(sample((i + o.twist) / spokes)));
  for (const k of o.rings) {
    const ring = rim.map((p) => wobble(lerp(hub, p, k)));
    chain([...ring, ring[0]]);
  }
  const n = Math.max(2, o.spokeAnchors);
  for (const p of rim) {
    chain(Array.from({ length: n }, (_, j) => {
      const q = lerp(p, hub, j / (n - 1));
      return j && j < n - 1 ? wobble(q) : q;
    }));
  }

  const id = ++ids;
  const sagAt = (time) => o.sag * (1 + o.sway * Math.sin((time + o.phase) * Math.PI * 2));
  let colours;
  return {
    width: w,
    height: ht,
    color: o.color,
    opacity: o.webOpacity,
    paint(out = new Uint32Array(w * ht), time = o.time) {
      const sag = sagAt(time);
      const hit = memo(masks, 4096, id + ":" + sag, () => raster(lines, sag, w, ht));
      const { bg, fg } = (colours ??= look(o));
      out.set(bg);
      for (let i = 0; i < hit.length; i++) out[hit[i]] = fg[hit[i]];
      return out;
    },
    // The strands as one path, for an anti-aliased stroke. A strand's parabola
    // is the quadratic Bézier whose control point sits twice its drop below
    // the midpoint, so this is the same curve raster() steps along.
    trace(ctx, time = o.time) {
      const sag = sagAt(time);
      ctx.beginPath();
      for (let s = 0; s < lines.length; s += 4) {
        const ax = lines[s], ay = lines[s + 1], bx = lines[s + 2], by = lines[s + 3];
        ctx.moveTo(ax, ay);
        ctx.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + 2 * sag * Math.hypot(bx - ax, by - ay), bx, by);
      }
    },
  };
}

/**
 * The web for `opts` (see DEFAULTS). Equal options give the same cached web,
 * laid out once however many books show it. `web.paint(out?, time?)` draws it
 * into `out`, a width×height Uint32Array of RGBA pixels (e.g. a view over
 * ImageData), and returns it.
 *
 * Only DEFAULTS' keys count: Datacore's JSX adds `__self` (a component, or
 * window) and `__source` to every element's props, and `__self` is circular.
 */
const OPTIONS = Object.keys(DEFAULTS);
const cobweb = (opts = {}) => {
  const own = {};
  for (const k of OPTIONS) if (opts[k] != null) own[k] = opts[k];
  return memo(webs, 256, JSON.stringify(own), () => layout(resolve(own)));
};

// ── the component ──────────────────────────────────────────────────────────
/**
 * A cobweb on a canvas, drawn at native resolution and upscaled with
 * nearest-neighbour filtering. Every option in DEFAULTS is also a prop.
 *
 *   <Cobweb scale={8} />                                         the original web
 *   <Cobweb seed={book.$path} />                                 a web of the book's own
 *   <Cobweb seed={book.$path} spokes={12} corner="top-right" />  ...with some options pinned
 *
 * `scale` is CSS px per web pixel. `fill` instead stretches the canvas across
 * its parent, which must be positioned — over a cover, say:
 *
 *   <div style={{ position: "relative" }}>
 *     <img src={cover} />
 *     <Cobweb fill animate seed={book.$path} backdrop={false} width={48} height={72} webOpacity={0.5} />
 *   </div>
 *
 * `pixelated` (the default) draws the web at its own resolution and upscales
 * it with nearest-neighbour filtering. `pixelated={false}` strokes the strands
 * as anti-aliased curves at the screen's resolution instead, `lineWidth` CSS
 * px thick, in `color` at `webOpacity`; the backdrop is pixel-only.
 *
 * Animated webs only draw while on screen, at `fps` frames a second, looping
 * every `period` seconds. They hold still if the system asks for reduced
 * motion (on Windows: Animation effects off), unless `animate="always"`.
 */
function Cobweb({
  scale = 6, fill = false, pixelated = true, lineWidth = 1,
  animate = false, period = 3, fps = 12, class: className, style, ...opts
}) {
  const canvas = dc.useRef(null);
  const web = cobweb(opts);
  const moving = animate === "always" || (animate && !calm?.matches);
  // canvas pixels per web pixel
  const density = pixelated ? 1 : scale * (globalThis.devicePixelRatio || 1);
  const mode = pixelated ? "pixels" : density + ":" + lineWidth;

  // Paints only what isn't on the canvas already, always from the latest
  // props, so the animation never restarts when they change.
  const shown = dc.useRef({});
  const draw = dc.useRef(null);
  draw.current = (time) => {
    const s = shown.current;
    if (s.web === web && s.time === time && s.mode === mode) return;
    Object.assign(s, { web, time, mode });
    if (pixelated) show(canvas.current, web, time);
    else stroke(canvas.current, web, time, density, lineWidth / scale);
  };

  dc.useEffect(() => {
    if (!moving) draw.current();
  });

  dc.useEffect(() => {
    if (!moving) return;
    // Whole frames only: they repeat every period, so each one's pixels are worked out once.
    const n = Math.max(1, Math.round(period * fps));
    return watch(canvas.current, (now) => draw.current((Math.floor((now / 1000 / period) * n) % n) / n));
  }, [moving, period, fps]);

  return (
    <canvas
      ref={canvas}
      width={Math.round(web.width * density)}
      height={Math.round(web.height * density)}
      class={className}
      aria-hidden="true"
      style={{
        imageRendering: pixelated ? "pixelated" : "auto",
        ...(fill ? FILL : { width: web.width * scale, height: web.height * scale }),
        ...style,
      }}
    />
  );
}

const FILL = { position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" };
const calm = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");

// One ImageData per size, shared by every canvas: putImageData copies it straight away.
const images = new Map();
function show(canvas, web, time) {
  const key = web.width + "x" + web.height;
  let [image, pixels] = images.get(key) ?? [];
  if (!image) images.set(key, [(image = new ImageData(web.width, web.height)), (pixels = new Uint32Array(image.data.buffer))]);
  web.paint(pixels, time);
  canvas.getContext("2d").putImageData(image, 0, 0);
}

// The smooth web: `density` canvas pixels per web pixel, strands `width` web pixels thick.
function stroke(canvas, web, time, density, width) {
  const ctx = canvas.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(density, 0, 0, density, 0, 0);
  ctx.globalAlpha = web.opacity;
  ctx.strokeStyle = web.color;
  ctx.lineWidth = width;
  ctx.lineCap = ctx.lineJoin = "round";
  web.trace(ctx, time);
  ctx.stroke();
}

// Animated webs share one IntersectionObserver and one frame loop. Only webs on
// screen are drawn; the loop sleeps while there are none or the window is hidden.
const ticks = new Map(), onScreen = new Set();
let observer, frame = 0;
const loop = (now) => {
  frame = 0;
  for (const el of onScreen) ticks.get(el)(now);
  wake();
};
const wake = () => {
  if (!frame && onScreen.size && !document.hidden) frame = requestAnimationFrame(loop);
};
function watch(el, tick) {
  observer ??= (document.addEventListener("visibilitychange", wake), new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting && ticks.has(e.target)) onScreen.add(e.target);
      else onScreen.delete(e.target);
    }
    wake();
  }));
  ticks.set(el, tick);
  observer.observe(el);
  return () => {
    ticks.delete(el);
    onScreen.delete(el);
    observer.unobserve(el);
  };
}

return { CORNERS, DEFAULTS, resolve, cobweb, Cobweb };
