/* ==========================================================================
   TRACKER REPORT  ·  Meta/Obsidian/_datacore/report/tracker-report.jsx
   --------------------------------------------------------------------------
   <WeeklyReport /> renders a week dashboard from either
     · the compact JSON payload embedded in the note it lives in  (after Crunch)
     · or the daily notes sitting next to it                       (before Crunch)

   Usage inside a note:
     ```datacorejsx
     const { WeeklyReport } = await dc.require("Meta/Obsidian/_datacore/report/tracker-report.jsx");
     return function View() { return <WeeklyReport />; };
     ```

   Props (all optional)
     theme      skin id.  Omitted -> picked from the active Obsidian theme,
                unless a swatch was clicked before (that choice is remembered).
     density    "comfortable" | "compact"
     compact    shorthand for density="compact"
     fullWidth  true (default) | false — false caps the report at 900px
     solo       true (default) — in reading mode, hide the note's fenced code
                blocks, which is where the crunched payload lives.  Nothing
                else in the note is touched.  false leaves them visible.
     folder     read the daily notes of another folder instead of this one
   ========================================================================== */

const LIB = "Meta/Obsidian/_datacore/report";
const core = await dc.require(LIB + "/tracker-core.jsx");
const themes = await dc.require(LIB + "/tracker-themes.jsx");

const hm = core.hm, clock = core.clock, pct = core.pct;
const MONTH_SHORT = core.MONTH_SHORT;
const SKIN_KEY = "tracker-skin";
const DENSITY_KEY = "tracker-density";

/* ==========================================================================
   PERFORMANCE PANEL
   --------------------------------------------------------------------------
   The figures shown in the "Performance" panel, in order.  Each entry pulls
   from the tally bullets in the daily notes: `match` lists the labels that
   feed it (compared loosely — case, punctuation and plurals are ignored).
     kind     "duration" -> stored in seconds, shown as 3h 20m
              anything else -> a plain count
     tasks    also add the ": 120 - 148 Pages" tallies written on task lines
   Add, remove or reorder entries here; nothing else needs to change.
   ========================================================================== */
const PERFORMANCE = [
  { label: "Pages Read", kind: "pages", match: ["android", "book", "research paper", "paper"], tasks: true },
  { label: "Deep Work", kind: "duration", match: ["deep work", "deepwork"] },
  { label: "Parried Urges", kind: "times", match: ["parried urges", "parried"] },
  { label: "Flashcard", kind: "count", match: ["flashcard", "flashcards"] }
];

const PANEL_TITLES = {
  plain: ["Time allocation", "Daily load", "Performance", "Sections", "Section × day",
    "Day rhythm", "Recurring tasks & streaks", "Full ledger"],
  med: ["The Measure of the Week", "The Days", "Performance", "Where the Hours Went",
    "The Tapestry", "The Book of Hours", "The Roll of Deeds", "The Full Ledger"],
  deco: ["Allocation", "Daily load", "Performance", "Sections", "Section × day",
    "Day rhythm", "Recurring & streaks", "Ledger"]
};

/* ------------------------------------------------------------------- utils */

/* An explicit prop is an instruction and wins; otherwise fall back to the last
   swatch / toggle the reader picked, and only then to the detected default. */
function readSkin(explicit) {
  if (explicit && themes.normalise(explicit) === explicit) return explicit;
  try {
    const v = window.localStorage.getItem(SKIN_KEY);
    if (v && themes.normalise(v) === v) return v;
  } catch (e) { /* ignore */ }
  return themes.detectSkin("industry");
}
function writeSkin(v) { try { window.localStorage.setItem(SKIN_KEY, v); } catch (e) { } }

function readDensity(explicit) {
  if (explicit === "compact" || explicit === "comfortable") return explicit;
  try {
    const v = window.localStorage.getItem(DENSITY_KEY);
    if (v === "compact" || v === "comfortable") return v;
  } catch (e) { /* ignore */ }
  return "comfortable";
}
function writeDensity(v) { try { window.localStorage.setItem(DENSITY_KEY, v); } catch (e) { } }

function openTarget(t, e) {
  e.preventDefault(); e.stopPropagation();
  try {
    if (t.link && t.link.external) { window.open(t.link.target, "_blank"); return; }
    const tgt = t.link ? t.link.target : t.dayName;
    app.workspace.openLinkText(tgt, t.dayPath || "", e.ctrlKey || e.metaKey);
  } catch (err) { /* ignore */ }
}

/* Art-Deco fills get the little inlaid-metal sheen the skin is built around. */
function decoFill(color, on) {
  if (!on) return color;
  return "linear-gradient(150deg," + color + " 0%,color-mix(in lab," + color + ",white 3%) 26%," +
    "color-mix(in lab," + color + ",white 20%) 45%,color-mix(in lab," + color + ",white 40%) 51%," +
    "color-mix(in lab," + color + ",white 7%) 80%)";
}

/* Relative luminance of a palette colour, so text laid over a strong fill can
   pick black or white instead of trusting the skin's --tk-onacc to suit every
   swatch (riso pink and glass indigo need opposite answers). */
function lum(c) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(c).trim());
  if (!m) return null;
  let s = m[1];
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  const v = [0, 2, 4].map(function (i) { return parseInt(s.slice(i, i + 2), 16) / 255; })
    .map(function (x) { return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
function onColor(c) {
  const l = lum(c);
  return l == null ? "var(--tk-onacc)" : (l > 0.42 ? "#15171d" : "#ffffff");
}

/* ==========================================================================
   HOST INTEGRATION · FULL WIDTH
   --------------------------------------------------------------------------
   Datacore blocks sit inside the note’s content column, which Obsidian caps
   at --file-line-width.  A CSS width can never beat that, so measure the pane
   and pull the report out over the margins.  When readable line length is
   already off the two widths match and nothing is applied.

   The last measurement is kept module-side and used to seed the next mount:
   a recycled section then starts at the right width instead of painting one
   narrow (and therefore taller) frame that shoves the scroll position. */
let LAST_WIDE = null;

function useFullWidth(enabled) {
  const seed = enabled ? LAST_WIDE : null;
  const ref = dc.useRef(null);
  const [style, setStyle] = dc.useState(seed);
  const last = dc.useRef(seed ? seed.width + "|" + seed.marginLeft : "");

  dc.useEffect(function () {
    const el = ref.current;
    if (!el) return;
    if (!enabled) { last.current = ""; setStyle(null); return; }
    const host = el.closest(".markdown-preview-view, .markdown-source-view, .view-content");
    const box = el.parentElement;
    if (!host || !box) return;

    let raf = 0;
    const measure = function () {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () {
        const gut = 26;
        const avail = Math.max(0, host.clientWidth - gut * 2);
        const own = box.clientWidth;
        const next = (avail > own + 8)
          ? { width: avail + "px", marginLeft: Math.round((own - avail) / 2) + "px",
              marginRight: Math.round((own - avail) / 2) + "px" }
          : null;
        const key = next ? next.width + "|" + next.marginLeft : "";
        if (key === last.current) return;      // guard against a resize loop
        last.current = key;
        LAST_WIDE = next;
        setStyle(next);
      });
    };
    measure();

    let ro = null;
    try { ro = new ResizeObserver(measure); ro.observe(host); ro.observe(box); } catch (e) { }
    window.addEventListener("resize", measure);
    return function () {
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [enabled]);

  return [ref, style];
}

/* ==========================================================================
   HOST INTEGRATION · READING-MODE CODE BLOCKS
   --------------------------------------------------------------------------
   In reading mode the crunched payload should not be on screen.  It lives in
   a fenced code block, so that is the only thing we hide: one positive rule
   against <pre>, nothing else touched.

   The earlier version hid every sizer child that was not the report, which
   meant a stylesheet in a permanent argument with Obsidian's reading view —
   it rebuilds those children as they scroll, so the report kept losing its
   exemption and the note went blank.  Hiding <pre> has no such problem:
   Datacore blocks render as div.block-language-datacorejsx, never <pre>, so
   the rule cannot reach the dashboard however often the view rebuilds it.
   A class left behind on a recycled leaf hides code blocks in the next note
   at worst — cosmetic, and the reference count clears it anyway. */
const CODE_CSS_ID = "tk-hidecode-css";
const CODE_CSS =
  ".markdown-preview-view.tk-hidecode pre{ display:none !important; }";

function ensureCodeCss() {
  if (typeof document === "undefined" || document.getElementById(CODE_CSS_ID)) return;
  try {
    const s = document.createElement("style");
    s.id = CODE_CSS_ID;
    s.textContent = CODE_CSS;
    document.head.appendChild(s);
  } catch (e) { /* ignore */ }
}

/* Reference counted, with a deferred release: Obsidian unmounts and remounts
   this block while recycling sections, and dropping the class in between
   would flash the payload on every scroll. */
const CODE_REFS = new WeakMap();

function useHideCode(ref, enabled) {
  dc.useEffect(function () {
    const el = ref.current;
    if (!el || !enabled) return;
    const view = el.closest(".markdown-preview-view");
    if (!view) return;                           // live preview / source — leave it be
    ensureCodeCss();
    CODE_REFS.set(view, (CODE_REFS.get(view) || 0) + 1);
    view.classList.add("tk-hidecode");
    return function () {
      CODE_REFS.set(view, Math.max(0, (CODE_REFS.get(view) || 0) - 1));
      setTimeout(function () {
        if (!CODE_REFS.get(view)) view.classList.remove("tk-hidecode");
      }, 0);
    };
  }, [enabled]);
}

const ROMAN = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
[50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
function roman(n) {
  n = Math.max(0, Math.round(n || 0));
  if (!n) return "";
  let out = "";
  ROMAN.forEach(function (r) { while (n >= r[0]) { out += r[1]; n -= r[0]; } });
  return out;
}

/* Performance figures, folded out of the week's tally bullets. */
function perfCards(d, pal) {
  const want = PERFORMANCE.map(function (p) {
    return p.match.map(function (m) { return core.normKey(m); });
  });
  return PERFORMANCE.map(function (p, i) {
    const keys = want[i];
    const parts = d.metrics.filter(function (m) { return keys.indexOf(m.key) >= 0; });
    const fmt = function (v) {
      return p.kind === "duration" ? hm(Math.round(v / 60)) : String(Math.round(v * 100) / 100);
    };
    const series = d.days.map(function (day, di) {
      let v = 0;
      parts.forEach(function (m) { v += (m.series[di] ? m.series[di].value : 0); });
      if (p.tasks) {
        const pd = d.perDay[di];
        if (pd) v += pd.pages || 0;
      }
      return { day: day, value: v, text: fmt(v) };
    });
    const total = series.reduce(function (a, s) { return a + s.value; }, 0);
    const active = series.filter(function (s) { return s.value > 0; }).length;
    return {
      key: p.label, label: p.label, color: pal[i % pal.length],
      total: fmt(total), series: series,
      sub: d.days.length
        ? (fmt(total / d.days.length) + " / day · " + active + "/" + d.days.length + " days")
        : ""
    };
  });
}

/* ------------------------------------------------------------- shared parts */

function SkinPicker(props) {
  return (
    <div class="tk-skins">
      {themes.SKIN_LIST.map(function (s) {
        return <button key={s.id} class={"tk-sw" + (props.value === s.id ? " on" : "")}
          style={{ background: s.swatch }} title={s.label}
          onClick={function () { props.onChange(s.id); }} />;
      })}
    </div>
  );
}

function Corner(props) {
  const kind = props.kind || "med";
  const deco = kind === "deco";
  const box = deco ? 60 : 44;
  const st = { top: "auto", bottom: "auto", left: "auto", right: "auto",
    width: (deco ? 58 : 44) + "px", height: (deco ? 58 : 44) + "px", opacity: deco ? .9 : .8 };
  st[props.v] = "9px"; st[props.hz] = "9px";
  const sx = props.hz === "right" ? -1 : 1, sy = props.v === "bottom" ? -1 : 1;
  const flip = "translate(" + (sx < 0 ? box : 0) + "," + (sy < 0 ? box : 0) + ") scale(" + sx + "," + sy + ")";
  return (
    <svg class="tk-corner" style={st} viewBox={"0 0 " + box + " " + box} fill="none">
      <g transform={flip}>
        {deco
          ? [
            <path key="a" d="M6 54 V6 H54" stroke="currentColor" stroke-width="1.5" />,
            <path key="b" d="M12 44 V12 H44" stroke="currentColor" stroke-width="1" opacity=".72" />,
            <path key="c" d="M18 31 V18 H31" stroke="currentColor" stroke-width="1" opacity=".48" />,
            <path key="d" d="M6 24 A18 18 0 0 1 24 6" stroke="currentColor" stroke-width="1" opacity=".55" />,
            <path key="e" d="M6 6 H11 V11 H6 Z" fill="currentColor" opacity=".85" />
          ]
          : [
            <path key="a" d="M3 3 H18 M3 3 V18" stroke="currentColor" stroke-width="1.3" />,
            <path key="b" d="M8 8 C8 17 17 8 26 8" stroke="currentColor" stroke-width="1" opacity=".85" />,
            <path key="c" d="M8 8 C17 8 8 17 8 26" stroke="currentColor" stroke-width="1" opacity=".85" />,
            <circle key="d" cx="8" cy="8" r="1.9" fill="currentColor" />,
            <path key="e" d="M26 8 q5 0 5 5 q0 -5 5 -5 q-5 0 -5 -5 q0 5 -5 5 z" fill="currentColor" opacity=".7" />
          ]}
      </g>
    </svg>
  );
}

function Reg(props) {
  const st = { top: "auto", bottom: "auto", left: "auto", right: "auto" };
  st[props.v] = "-7px"; st[props.hz] = "-7px";
  return (
    <svg class="tk-reg" style={st} viewBox="0 0 14 14" fill="none">
      <path d="M7 0 V14 M0 7 H14" stroke="currentColor" stroke-width="1" />
    </svg>
  );
}

const CORNERS = [["top", "left"], ["top", "right"], ["bottom", "left"], ["bottom", "right"]];

function Ornaments(props) {
  const f = props.flags;
  if (f.med) {
    return [
      <div key="f1" class="tk-frame" />, <div key="f2" class="tk-frame in" />
    ].concat(CORNERS.map(function (c, i) {
      return <Corner key={"c" + i} v={c[0]} hz={c[1]} kind="med" />;
    }));
  }
  if (f.deco) {
    return CORNERS.map(function (c, i) {
      return <Corner key={"c" + i} v={c[0]} hz={c[1]} kind="deco" />;
    });
  }
  if (f.ornate) {
    return [<div key="f1" class="tk-frame" />].concat(CORNERS.map(function (c, i) {
      return <Corner key={"c" + i} v={c[0]} hz={c[1]} kind="med" />;
    }));
  }
  if (f.ind) {
    return CORNERS.map(function (c, i) { return <Reg key={"r" + i} v={c[0]} hz={c[1]} />; });
  }
  return null;
}

/* Panel with the new header (ornament mark · title · rule · optional slot). */
function Panel(props) {
  return (
    <div class="tk-panel">
      <div class="tk-ph">
        <span class="mk">{props.mark}</span>
        <h3>{props.title}</h3>
        <span class="rule" />
        {props.tools || null}
        {props.note ? <span class="note">{props.note}</span> : null}
      </div>
      {props.children}
    </div>
  );
}

function Tile(props) {
  return (
    <div class="tk-tile">
      <div class="cap" style={{ background: props.color }} />
      <i>{props.label}</i>
      <b>{props.value}</b>
      <em>{props.sub}</em>
      <div class="tk-meter">
        <i style={{ width: Math.max(2, Math.min(100, props.meter || 0)) + "%", background: props.color }} />
      </div>
    </div>
  );
}

function Donut(props) {
  const size = 170, stroke = 20, r = 72, c = 2 * Math.PI * r;
  let acc = 0;
  const total = props.segments.reduce(function (s, x) { return s + x.value; }, 0) || 1;
  return (
    <div class="tk-donut" style={{ width: size + "px", height: size + "px" }}>
      <svg width={size} height={size} viewBox={"0 0 " + size + " " + size}>
        <circle cx={85} cy={85} r={r} fill="none" stroke="var(--tk-trk)" stroke-width={stroke} />
        {props.segments.map(function (s, i) {
          const len = (s.value / total) * c;
          const el = (
            <circle key={i} cx={85} cy={85} r={r} fill="none" stroke={s.color} stroke-width={stroke}
              stroke-dasharray={Math.max(0, len - 1.5) + " " + (c - Math.max(0, len - 1.5))}
              stroke-dashoffset={-acc} transform="rotate(-90 85 85)">
              <title>{s.name + " — " + s.label}</title>
            </circle>
          );
          acc += len;
          return el;
        })}
      </svg>
      <div class="tk-dmid"><b>{props.center}</b><i>{props.centerSub}</i></div>
    </div>
  );
}

/* --------------------------------------------------------------- big panels */

function DayColumns(props) {
  const d = props.data;
  const max = Math.max.apply(null, d.perDay.map(function (p) { return p.minutes; }).concat([1]));
  return (
    <div class="tk-days">
      {d.perDay.map(function (p) {
        const bh = Math.max(5, Math.round((p.minutes / max) * 128));
        const dh = p.minutes ? Math.round((p.doneMinutes / p.minutes) * 100) : 0;
        return (
          <div class="tk-day" key={p.day.name}
            title={p.day.weekday + " · " + p.done + "/" + p.total + " tasks · " + hm(p.doneMinutes) + " of " + hm(p.minutes)}>
            <div class="tk-dv">{p.done + "/" + p.total}</div>
            <div class="tk-col">
              <div class="tk-stack" style={{ height: bh + "px" }}>
                <i style={{ height: dh + "%", background: decoFill(props.accent, props.deco) }} />
              </div>
            </div>
            <div class="tk-dl">{p.day.weekdayShort}</div>
            <div class="tk-dv">{hm(p.minutes)}</div>
          </div>
        );
      })}
    </div>
  );
}

/* The rhythm axis spans the week's earliest activity to its latest, so a week
   that never starts before 06:00 does not waste a quarter of the track. */
function rhythmWindow(d) {
  let a = 1440, b = 0;
  d.perDay.forEach(function (p) {
    if (p.day.openedAt != null) a = Math.min(a, p.day.openedAt);
    p.blocks.forEach(function (x) {
      a = Math.min(a, x.start);
      b = Math.max(b, x.start + x.duration);
    });
  });
  if (b <= a) { a = 0; b = 1440; }
  a = Math.max(0, Math.floor(a / 60) * 60);
  b = Math.min(1440, Math.ceil(b / 60) * 60);
  return { a: a, span: Math.max(60, b - a), hA: a / 60, hB: Math.min(1440, b) / 60 };
}

function Timeline(props) {
  const d = props.data, w = rhythmWindow(d);
  const at = function (m) { return ((m - w.a) / w.span) * 100; };
  const hours = [];
  for (let hr = w.hA; hr <= w.hB; hr++) if (hr === w.hA || hr === w.hB || hr % 3 === 0) hours.push(hr);
  return (
    <div>
      <div class="tk-ax">
        {/* never bind `h` in a scope that builds JSX — it is the pragma */}
        {hours.map(function (hr) {
          return <span key={hr} style={{
            left: at(hr * 60) + "%",
            transform: hr === w.hA ? "translateX(0)" : hr === w.hB ? "translateX(-100%)" : "translateX(-50%)"
          }}>{String(hr).padStart(2, "0")}</span>;
        })}
      </div>
      {d.perDay.map(function (p) {
        return (
          <div class="tk-tr" key={p.day.name}>
            <div class="tk-tday">{p.day.weekdayShort}</div>
            <div class="tk-track">
              {hours.filter(function (hr) { return hr > w.hA && hr < w.hB; }).map(function (hr) {
                return <div key={hr} class={"tk-tick" + (hr % 6 === 0 ? " maj" : "")}
                  style={{ left: at(hr * 60) + "%" }} />;
              })}
              {p.blocks.map(function (b, i) {
                return <div key={i} class={"tk-blk" + (b.done ? "" : " undone")}
                  style={{
                    left: at(b.start) + "%",
                    width: (Math.max(b.duration, 6) / w.span * 100) + "%",
                    background: decoFill(b.color, props.deco), color: b.color
                  }}
                  title={clock(b.start) + "–" + clock(b.start + b.duration) + "  " + b.title + "  ·  " + b.section + (b.done ? "  ✓" : "")} />;
              })}
              {p.day.openedAt != null
                ? <div class="tk-open" style={{ left: at(p.day.openedAt) + "%" }}
                  title={"Note created " + clock(p.day.openedAt)} />
                : null}
            </div>
            <div class="tk-ttot">{hm(p.minutes)}</div>
          </div>
        );
      })}
    </div>
  );
}

function habitRows(d, min) {
  return d.habits.filter(function (x) { return x.marked || x.habitSection || x.dayCount >= min; });
}

/* Column widths for the streak grid.  Auto table layout lets the nowrap task
   titles claim the whole width and shoves every other column out past the
   scroll container, so the layout is fixed and the task column simply takes
   whatever is left.  Font sizes are untouched — only the geometry. */
const HB_DAY = 32, HB_DONE = 56, HB_RATE = 84, HB_STREAK = 60, HB_TIME = 64, HB_TASK = 168;

function Habits(props) {
  const d = props.data;
  const rows = habitRows(d, props.min);
  const [all, setAll] = dc.useState(false);
  const shown = all ? rows : rows.slice(0, 20);
  const minW = HB_TASK + d.days.length * HB_DAY + HB_DONE + HB_RATE + HB_STREAK + HB_TIME;
  return (
    <div>
      <div class="tk-wrap">
        <table class="tk-t fixed" style={{ minWidth: minW + "px" }}>
          <colgroup>
            <col />
            {d.days.map(function (x) { return <col key={x.name} style={{ width: HB_DAY + "px" }} />; })}
            <col style={{ width: HB_DONE + "px" }} />
            <col style={{ width: HB_RATE + "px" }} />
            <col style={{ width: HB_STREAK + "px" }} />
            <col style={{ width: HB_TIME + "px" }} />
          </colgroup>
          <thead>
            <tr>
              <th>Task</th>
              {d.days.map(function (x) { return <th key={x.name} class="day">{x.weekdayShort}</th>; })}
              <th style={{ textAlign: "right" }}>Done</th>
              <th>Rate</th>
              <th style={{ textAlign: "center" }}>Streak</th>
              <th style={{ textAlign: "right" }}>Time</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(function (hb) {
              return (
                <tr key={hb.key}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                      <span style={{
                        width: "9px", height: "9px", borderRadius: "var(--tk-cell-rad)",
                        background: hb.color, flex: "0 0 auto"
                      }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{hb.title}</div>
                        <div style={{ fontSize: "10.5px", color: "var(--tk-fnt)" }}>{hb.section}</div>
                      </div>
                    </div>
                  </td>
                  {hb.cells.map(function (c, i) {
                    const g = c.state === "done" ? "✓" : c.state === "missed" ? "" : c.state === "cancelled" ? "✕" : "·";
                    return (
                      <td key={i} class="day">
                        <span class={"tk-cell " + c.state}
                          style={c.state === "done" ? { background: hb.color, color: onColor(hb.color) } : null}
                          title={c.day.weekday + " — " + (c.state === "absent" ? "not listed" : c.state)}>{g}</span>
                      </td>
                    );
                  })}
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{hb.hit + "/" + hb.planned}</td>
                  <td>
                    <div class="tk-mini" title={Math.round(hb.rate * 100) + "%"}>
                      <i style={{ width: (hb.rate * 100) + "%", background: decoFill(hb.color, props.deco) }} />
                    </div>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <span class="tk-pill" title={"Best run " + hb.best + " · current " + hb.cur}>{hb.best}</span>
                  </td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--tk-mut)" }}>{hm(hb.minutes)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length > shown.length
        ? <div style={{ marginTop: "10px", textAlign: "center" }}>
          <button class="tk-btn" onClick={function () { setAll(true); }}>{"Show all " + rows.length}</button>
        </div>
        : null}
    </div>
  );
}

function Performance(props) {
  const cards = props.cards;
  return (
    <div class="tk-mc">
      {cards.map(function (m) {
        const mx = Math.max.apply(null, m.series.map(function (s) { return s.value; }).concat([1]));
        return (
          <div class="tk-card" key={m.key}>
            <h4>{m.label}</h4>
            <b style={{ color: m.color }}>{m.total}</b>
            <em>{m.sub}</em>
            <div class="tk-spark">
              {m.series.map(function (s, i) {
                return <i key={i} style={{
                  height: Math.max(2, (s.value / mx) * 30) + "px",
                  background: s.value ? m.color : "var(--tk-trk)"
                }} title={s.day.weekdayShort + ": " + s.text} />;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Heat(props) {
  const d = props.data;
  return (
    <div class="tk-wrap">
      <div class="tk-heat" style={{
        gridTemplateColumns: "minmax(92px,1.3fr) repeat(" + d.days.length + ", 1fr)",
        minWidth: (120 + d.days.length * 52) + "px"
      }}>
        <div />
        {d.days.map(function (x) { return <div class="hd" key={x.name}>{x.weekdayShort}</div>; })}
        {d.heat.map(function (r) {
          return [<div class="rl" key={r.name + "-l"} title={r.name}>{r.name}</div>]
            .concat(r.cells.map(function (c, i) {
              const a = c.minutes ? 0.22 + 0.78 * (c.minutes / d.heatMax) : 0;
              return (
                <div class="hc" key={r.name + i}
                  title={r.name + " · " + c.day.weekday + " — " + c.done + "/" + c.count + " tasks, " + hm(c.minutes)}>
                  {c.minutes
                    ? <span class="fill" style={{ background: r.color, opacity: a }} />
                    : null}
                  <span class="txt" style={{ color: a > 0.5 ? onColor(r.color) : "var(--tk-tx)" }}>
                    {c.count ? (c.done + "/" + c.count) : ""}
                  </span>
                </div>
              );
            }));
        })}
      </div>
    </div>
  );
}

function Ledger(props) {
  const d = props.data;
  const [q, setQ] = dc.useState("");
  const [mode, setMode] = dc.useState("section");
  const [filt, setFilt] = dc.useState("all");

  const needle = q.trim().toLowerCase();
  const match = function (t) {
    if (filt === "done" && !t.done) return false;
    if (filt === "open" && (t.done || t.cancelled)) return false;
    if (filt === "cancelled" && !t.cancelled) return false;
    if (!needle) return true;
    return (t.title + " " + t.section + " " + t.dayName).toLowerCase().indexOf(needle) >= 0;
  };

  const groups = [];
  if (mode === "section") {
    /* Sections keep the order they are written in the daily notes, not the
       "most minutes first" order the charts above use. */
    (d.sectionsInOrder || d.sections).forEach(function (s) {
      const rows = d.allTasks.filter(function (t) { return t.section === s.name && match(t); })
        .sort(function (a, b) { return (a.sortKey - b.sortKey) || (a.order - b.order); });
      if (rows.length) groups.push({
        key: s.name, title: s.name, color: s.color, rows: rows,
        meta: s.done + "/" + s.count + " done · " + hm(s.minutes)
      });
    });
  } else {
    d.days.forEach(function (x) {
      const rows = x.tasks.filter(match);
      const p = d.perDay.filter(function (z) { return z.day.name === x.name; })[0];
      if (rows.length) groups.push({
        key: x.name, title: x.weekday + " · " + x.label,
        color: "var(--tk-acc)", rows: rows,
        meta: (p ? p.done + "/" + p.total + " done · " + hm(p.minutes) : "") +
          (x.openedAt != null ? " · from " + clock(x.openedAt) : "")
      });
    });
  }

  return (
    <div>
      <div class="tk-ctrl">
        <input type="text" placeholder="Search tasks…" value={q} onInput={function (e) { setQ(e.target.value); }} />
        <button class={"tk-btn" + (mode === "section" ? " on" : "")} onClick={function () { setMode("section"); }}>By section</button>
        <button class={"tk-btn" + (mode === "day" ? " on" : "")} onClick={function () { setMode("day"); }}>By day</button>
        <span style={{ width: "6px" }} />
        {[["all", "All"], ["done", "Done"], ["open", "Open"], ["cancelled", "Cancelled"]].map(function (f) {
          return <button key={f[0]} class={"tk-btn" + (filt === f[0] ? " on" : "")}
            onClick={function () { setFilt(f[0]); }}>{f[1]}</button>;
        })}
      </div>
      {groups.map(function (g) {
        return (
          <details class="tk-sec" key={g.key} open>
            <summary>
              {props.mark
                ? <span class="swatch mark"
                    style={{ color: g.color, fontSize: props.ornate ? "16px" : "13px" }}>{props.mark}</span>
                : <span class="swatch" style={{ background: g.color }} />}
              <h4>{g.title}</h4>
              <span class="meta">{g.meta}</span>
            </summary>
            <div class="tk-rows">
              {g.rows.map(function (t, i) {
                const mark = t.done ? "✓" : t.cancelled ? "✕" : t.state === "doing" ? "◐" : t.state === "deferred" ? "›" : "○";
                const sub = t.indent > 0;
                return (
                  <div class={"tk-row" + (i % 2 ? " odd" : "") + (sub ? " sub" : "") +
                    (t.done ? " is-done" : "") + (t.cancelled ? " is-cancelled" : "")}
                    key={t.dayName + "-" + t.order + "-" + i}>
                    {/* day column stays blank for sub-tasks — they inherit the parent's day */}
                    <div class="d" title={t.dayName}>{(mode === "section" && !sub) ? t.weekdayShort : ""}</div>
                    <div class="t">{t.start != null ? (clock(t.start) + (t.end != null ? "–" + clock(t.end) : "")) : ""}</div>
                    <div class="u">{t.duration ? hm(t.duration) : ""}</div>
                    <div class="n">
                      <span class="tk-mark" style={{ color: t.done ? "var(--tk-ok)" : "var(--tk-fnt)" }}>{mark}</span>
                      {t.link
                        ? <a onClick={function (e) { openTarget(t, e); }} title={t.link.target}>{t.title}</a>
                        : <span>{t.title}</span>}
                      {t.priority ? <span title={t.priorityName} style={{ marginLeft: "6px" }}>{t.priority}</span> : null}
                      {t.pages != null ? <span class="tk-chip">{t.pages + " pages"}</span> : null}
                      {mode === "day" ? <span class="tk-chip">{t.section}</span> : null}
                    </div>
                    <div class="u r">{(mode === "section" && !sub) ? (t.date.getDate() + " " + MONTH_SHORT[t.date.getMonth()]) : ""}</div>
                  </div>
                );
              })}
            </div>
          </details>
        );
      })}
      {!groups.length ? <div class="tk-empty">No matches.</div> : null}
    </div>
  );
}

/* ==========================================================================
   DATA
   --------------------------------------------------------------------------
   One week, read either from the compact payload in this note or from the
   daily notes beside it.

   The cache is not a micro-optimisation, it is what keeps the scroll steady.
   Obsidian recycles reading-view sections while you scroll, which unmounts
   and remounts this component; a cold remount starts at loading -> the body
   renders empty for one paint -> the note collapses to the height of the
   hero -> the browser clamps scrollTop and you are back at the top.  Seeding
   the first paint from the last good read keeps the height identical across
   a recycle, so there is nothing to jump to.

   The signature guard is the other half: Datacore's index ticks for any file
   in the vault, and re-reading is cheap but re-rendering the whole dashboard
   is not.  Identical data means no setState at all.
   ========================================================================== */
const WEEK_CACHE = new Map();
const WEEK_CACHE_MAX = 8;

function cacheGet(key) { return key ? WEEK_CACHE.get(key) : null; }

function cachePut(key, value) {
  if (!key) return;
  WEEK_CACHE.delete(key);
  WEEK_CACHE.set(key, value);
  while (WEEK_CACHE.size > WEEK_CACHE_MAX) {
    WEEK_CACHE.delete(WEEK_CACHE.keys().next().value);
  }
}

function useWeekData(explicitFolder) {
  const path = dc.useCurrentPath();
  const rev = (typeof dc.useIndexUpdates === "function")
    ? dc.useIndexUpdates({ debounce: 1200 }) : 0;

  const folder = explicitFolder ||
    ((path && path.indexOf("/") >= 0) ? path.slice(0, path.lastIndexOf("/")) : "");
  const key = explicitFolder ? ("folder:" + folder) : ("note:" + path);

  const [st, setSt] = dc.useState(function () {
    const c = cacheGet(key);
    return c
      ? { loading: false, days: c.days, payload: c.payload, source: c.source, error: null }
      : { loading: true, days: [], payload: null, source: "", error: null };
  });
  const sig = dc.useRef((cacheGet(key) || {}).sig || "");

  dc.useEffect(function () {
    let dead = false;
    (async function () {
      try {
        let days = [], payload = null, source = "live";
        const self = app.vault.getAbstractFileByPath(path);
        if (self && !explicitFolder) {
          payload = core.extractPayload(await app.vault.cachedRead(self));
        }
        if (payload) { days = core.decodeWeek(payload); source = "compact"; }
        else { days = await core.loadWeekFolder(app, folder); source = "live"; }
        if (dead) return;

        const next = JSON.stringify(days);
        if (next === sig.current && WEEK_CACHE.has(key)) return;   // nothing moved
        sig.current = next;
        cachePut(key, { days: days, payload: payload, source: source, sig: next });
        setSt({ loading: false, days: days, payload: payload, source: source, error: null });
      } catch (e) {
        if (dead) return;
        sig.current = "";
        setSt({ loading: false, days: [], payload: null, source: "",
                error: String((e && e.message) || e) });
      }
    })();
    return function () { dead = true; };
  }, [path, folder, key, rev]);

  return { st: st, folder: folder, path: path };
}

/* ==========================================================================
   REPORT
   ========================================================================== */
let SCOPE_N = 0;

function WeeklyReport(props) {
  props = props || {};
  /* fullWidth is on unless it is explicitly switched off; `compact` is a
     shorthand for density="compact". */
  const wide = props.fullWidth !== false;
  const [skin, setSkin] = dc.useState(function () { return readSkin(props.theme); });
  const [density, setDensity] = dc.useState(function () {
    return readDensity(props.compact ? "compact" : props.density);
  });
  const [habitMin, setHabitMin] = dc.useState(2);
  const [wideRef, wideStyle] = useFullWidth(wide);
  useHideCode(wideRef, props.solo !== false);
  const ctx = useWeekData(props.folder);
  const st = ctx.st;

  const pal = themes.palette(skin);
  const f = themes.flags(skin);
  const scope = dc.useMemo(function () { return "tkid-" + (++SCOPE_N).toString(36); }, []);
  const css = dc.useMemo(function () {
    return themes.skinCss(skin, "." + scope, { density: density, fullWidth: wide });
  }, [skin, scope, density, wide]);
  const d = dc.useMemo(function () { return core.aggregate(st.days, pal); }, [st.days, skin]);

  const setTheme = function (v) { setSkin(v); writeSkin(v); };
  const setDense = function (v) { setDensity(v); writeDensity(v); };

  const T = f.med ? PANEL_TITLES.med : f.deco ? PANEL_TITLES.deco : PANEL_TITLES.plain;
  const mark = f.ornate ? "❦" : f.deco ? "◆" : f.ind ? "+" : f.riso ? "◆" : "§";

  const payload = st.payload || {};
  const title = payload.title ||
    (ctx.path ? ctx.path.split("/").pop().replace(/\.md$/, "") : "Weekly Report");
  const weekNo = payload.week;
  const weekMark = weekNo == null ? "" : (f.med ? ("Week " + roman(weekNo)) : ("W" + weekNo));

  const segs = d.sections.slice(0, 10).map(function (s) {
    return {
      name: s.name, value: s.minutes || s.count, color: s.color,
      label: hm(s.minutes) + " · " + s.done + "/" + s.count
    };
  });
  const cards = dc.useMemo(function () { return perfCards(d, pal); }, [d, skin]);

  const secMax = (d.sections[0] && d.sections[0].minutes) || 1;
  const goodHabits = d.habits.filter(function (x) { return x.rate >= 0.8; }).length;
  const tiles = [
    { label: "Completion", value: d.rate + "%", sub: d.doneTop + " of " + d.totalTop + " tasks", m: d.rate },
    { label: "Time completed", value: hm(d.doneMin), sub: "of " + hm(d.totalMin) + " scheduled", m: pct(d.doneMin, d.totalMin) },
    { label: "Recurring", value: String(d.habits.length), sub: goodHabits + " at ≥ 80%", m: pct(goodHabits, d.habits.length) },
    { label: "Left open", value: String(d.openTop), sub: d.cancelledTop ? (d.cancelledTop + " cancelled") : "none cancelled", m: pct(d.openTop, d.totalTop) },
    { label: "Note created", value: d.avgWake != null ? clock(d.avgWake) : "—", sub: "average of " + d.wake.length + " days", m: d.avgWake != null ? Math.round(d.avgWake / 1440 * 100) : 0 }
  ];

  const header = (
    <div class="tk-hero">
      <div class="tk-hero-fx" />
      <div class="tk-hero-in">
        {f.ind ? CORNERS.map(function (c, i) { return <Reg key={"hr" + i} v={c[0]} hz={c[1]} />; }) : null}
        <div class="tk-head-row">
          <div class="who">
            <div class="tk-kick">
              {f.med ? "Chronicle of the Week" : f.deco ? "Weekly Report" : "Weekly report"}
            </div>
            <div class="tk-titlerow">
              <div class="tk-title">{title}</div>
              {weekMark ? <div class="tk-wkmark">{weekMark}</div> : null}
            </div>
            <div class="tk-sub">
              {st.loading ? "Reading…"
                : st.error ? ("Error: " + st.error)
                  : d.days.length ? (d.range + " · " + d.days.length + " days · " + d.totalTop + " tasks logged")
                    : "No daily notes in this folder"}
            </div>
          </div>
          <div class="tk-hero-ctl">
            <SkinPicker value={skin} onChange={setTheme} />
            <div class="tk-seg">
              {[["comfortable", "Roomy"], ["compact", "Compact"]].map(function (x) {
                return <button key={x[0]} class={density === x[0] ? "on" : ""}
                  onClick={function () { setDense(x[0]); }}>{x[1]}</button>;
              })}
            </div>
          </div>
        </div>
        {d.days.length
          ? <div class="tk-tiles">
            {tiles.map(function (t, i) {
              return <Tile key={t.label} color={pal[i % pal.length]} label={t.label}
                value={t.value} sub={t.sub} meter={t.m} />;
            })}
          </div>
          : null}
      </div>
    </div>
  );

  const body = d.days.length ? (
    <div>
      <div class="tk-row3">
        <Panel mark={mark} title={T[0]}>
          <div class="tk-dw">
            <Donut segments={segs} center={d.rate + "%"} centerSub={hm(d.totalMin) + " total"} />
            <div class="tk-legend">
              {segs.map(function (s) {
                return (
                  <div class="tk-lg" key={s.name}>
                    <span class="sw" style={{ background: s.color }} />
                    <span class="nm" title={s.name}>{s.name}</span>
                    <span class="vl">{hm(s.value)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Panel>

        <Panel mark={mark} title={T[1]}>
          <DayColumns data={d} accent={pal[1]} deco={f.deco} />
        </Panel>

        <Panel mark={mark} title={T[2]}>
          <Performance cards={cards} />
        </Panel>
      </div>

      <div class="tk-row2">
        <Panel mark={mark} title={T[3]}>
          <div class="tk-bars">
            {d.sections.map(function (s) {
              return (
                <div class="tk-bar" key={s.name}>
                  <div class="lb" title={s.name}>{s.name}</div>
                  <div class="tk-track2">
                    <div class="fl" style={{ width: ((s.minutes / secMax) * 100) + "%", background: s.color }} />
                    <div class="fd" style={{ width: ((s.doneMinutes / secMax) * 100) + "%", background: decoFill(s.color, f.deco), color: s.color }} />
                  </div>
                  <div class="vl">{hm(s.minutes) + "  ·  " + s.done + "/" + s.count + "  ·  " + pct(s.done, s.count) + "%"}</div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel mark={mark} title={T[4]}>
          <Heat data={d} />
        </Panel>
      </div>

      <div class="tk-full">
        <Panel mark={mark} title={T[5]} note="dashed rule = note created · faded = not completed">
          <Timeline data={d} deco={f.deco} />
        </Panel>
      </div>

      <div class="tk-full">
        <Panel mark={mark} title={T[6]} tools={
          [2, 3, 4, 5].map(function (n) {
            return <button key={n} class={"tk-btn" + (habitMin === n ? " on" : "")}
              title={"Show tasks appearing on at least " + n + " days. Habit and Chore sections are always included."}
              onClick={function () { setHabitMin(n); }}>{n}</button>;
          }).concat([<span key="l" class="tk-lbl">occurrences</span>])
        }>
          <Habits data={d} min={habitMin} deco={f.deco} />
        </Panel>
      </div>

      <div class="tk-full">
        <Panel mark={mark} title={T[7]}>
          <Ledger data={d} mark={(f.ornate || f.deco) ? mark : null} ornate={f.ornate} />
        </Panel>
      </div>
    </div>
  ) : (!st.loading
    ? <div class="tk-panel"><div class="tk-empty">{"Nothing in " + ctx.folder}</div></div>
    : null);

  return (
    <div class={scope} ref={wideRef} style={wideStyle || undefined}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div class="tk">
        <div class="tk-page">
          <div class="tk-shell">
            <Ornaments flags={f} />
            <div class="tk-inner">
              {header}
              {f.ornate ? <div class="tk-rule"><span>{f.med ? "❦" : "◆"}</span></div> : null}
              {body}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

return {
  WeeklyReport: WeeklyReport,
  SkinPicker: SkinPicker, Panel: Panel, Tile: Tile, Donut: Donut,
  Timeline: Timeline, Habits: Habits, Performance: Performance, Heat: Heat, Ledger: Ledger,
  DayColumns: DayColumns, Corner: Corner, Reg: Reg, Ornaments: Ornaments,
  PERFORMANCE: PERFORMANCE, PANEL_TITLES: PANEL_TITLES, perfCards: perfCards,
  readSkin: readSkin, writeSkin: writeSkin,
  readDensity: readDensity, writeDensity: writeDensity,
  openTarget: openTarget,
  core: core, themes: themes
};
