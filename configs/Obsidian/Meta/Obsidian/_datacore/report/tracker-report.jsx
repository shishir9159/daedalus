/* ==========================================================================
   TRACKER REPORT  ·  Meta/Obsidian/_datacore/report/tracker-report.jsx
   --------------------------------------------------------------------------
   <WeeklyReport /> renders a week dashboard from either
     · the compact JSON payload embedded in the note it lives in  (after Crunch)
     · or the daily notes sitting next to it                       (before Crunch)

   Usage inside a note:
     ```datacorejsx
     const { WeeklyReport } = await dc.require("Meta/Obsidian/_datacore/report/tracker-report.jsx");
     return function View() { return <WeeklyReport theme="glass-dark" />; };
     ```
   ========================================================================== */

const LIB = "Meta/Obsidian/_datacore/report";
const core = await dc.require(LIB + "/tracker-core.jsx");
const themes = await dc.require(LIB + "/tracker-themes.jsx");

const hm = core.hm, clock = core.clock, fmtMetric = core.fmtMetric, pct = core.pct;
const MONTH_SHORT = core.MONTH_SHORT;
const SKIN_KEY = "tracker-skin";

/* ------------------------------------------------------------------- utils */

function readSkin(fallback) {
  try { return window.localStorage.getItem(SKIN_KEY) || fallback; } catch (e) { return fallback; }
}
function writeSkin(v) { try { window.localStorage.setItem(SKIN_KEY, v); } catch (e) { } }

function openTarget(t, e) {
  e.preventDefault(); e.stopPropagation();
  try {
    if (t.link && t.link.external) { window.open(t.link.target, "_blank"); return; }
    const tgt = t.link ? t.link.target : t.dayName;
    app.workspace.openLinkText(tgt, t.dayPath || "", e.ctrlKey || e.metaKey);
  } catch (err) { /* ignore */ }
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
  const st = { top: "auto", bottom: "auto", left: "auto", right: "auto" };
  st[props.v] = "6px"; st[props.hz] = "6px";
  const flip = (props.hz === "right" ? -1 : 1) + "," + (props.v === "bottom" ? -1 : 1);
  return (
    <svg class="tk-corner" style={st} viewBox="0 0 40 40" fill="none">
      <g transform={"translate(20,20) scale(" + flip + ") translate(-20,-20)"}>
        <path d="M4 4 L4 16 M4 4 L16 4" stroke="currentColor" stroke-width="1.2" />
        <path d="M8 8 C8 14, 14 8, 20 8" stroke="currentColor" stroke-width="1" opacity=".8" />
        <path d="M8 8 C14 8, 8 14, 8 20" stroke="currentColor" stroke-width="1" opacity=".8" />
        <circle cx="8" cy="8" r="1.6" fill="currentColor" />
      </g>
    </svg>
  );
}

function Panel(props) {
  return (
    <div class={"tk-panel " + (props.span || "s12")}>
      {props.title ? <h3><span class="dot" style={{ background: props.color }} />{props.title}</h3> : null}
      {props.note ? <p class="n">{props.note}</p> : null}
      {props.children}
    </div>
  );
}

function Tile(props) {
  return (
    <div class="tk-tile">
      <div class="cap" style={{ background: props.color }} />
      <b>{props.value}</b><i>{props.label}</i>
      {props.sub ? <em>{props.sub}</em> : null}
    </div>
  );
}

function Donut(props) {
  const size = props.size || 166, stroke = props.stroke || 21;
  const r = (size - stroke) / 2 - 4, c = 2 * Math.PI * r;
  let acc = 0;
  const total = props.segments.reduce(function (s, x) { return s + x.value; }, 0) || 1;
  return (
    <div class="tk-donut" style={{ width: size + "px", height: size + "px" }}>
      <svg width={size} height={size} viewBox={"0 0 " + size + " " + size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--tk-trk)" stroke-width={stroke} />
        {props.segments.map(function (s, i) {
          const len = (s.value / total) * c;
          const el = (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} stroke-width={stroke}
              stroke-dasharray={Math.max(0, len - 1.5) + " " + (c - Math.max(0, len - 1.5))}
              stroke-dashoffset={-acc} transform={"rotate(-90 " + (size / 2) + " " + (size / 2) + ")"}>
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
  const max = Math.max.apply(null, props.data.perDay.map(function (p) { return p.minutes; }).concat([1]));
  return (
    <div class="tk-days">
      {props.data.perDay.map(function (p) {
        const bh = Math.max(4, Math.round((p.minutes / max) * 120));
        const dh = p.minutes ? Math.round((p.doneMinutes / p.minutes) * 100) : 0;
        return (
          <div class="tk-day" key={p.day.name}
            title={p.day.weekday + " · " + p.done + "/" + p.total + " tasks · " + hm(p.doneMinutes) + " of " + hm(p.minutes)}>
            <div class="tk-dv">{p.done + "/" + p.total}</div>
            <div class="tk-col">
              <div class="tk-stack" style={{ height: bh + "px" }}>
                <i style={{ height: dh + "%", background: props.accent }} />
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

function Timeline(props) {
  const d = props.data;
  return (
    <div>
      <div class="tk-ax">
        {[0, 3, 6, 9, 12, 15, 18, 21, 24].map(function (hr) {
          return <span key={hr} style={{ left: (hr / 24 * 100) + "%" }}>{String(hr).padStart(2, "0")}</span>;
        })}
      </div>
      {d.perDay.map(function (p) {
        return (
          <div class="tk-tr" key={p.day.name}>
            <div class="tk-tday">{p.day.weekdayShort}</div>
            <div class="tk-track">
              {[3, 6, 9, 12, 15, 18, 21].map(function (hr) {
                return <div key={hr} class={"tk-tick" + (hr % 6 === 0 ? " maj" : "")}
                  style={{ left: (hr / 24 * 100) + "%" }} />;
              })}
              {p.blocks.map(function (b, i) {
                return <div key={i} class={"tk-blk" + (b.done ? "" : " undone")}
                  style={{
                    left: (b.start / 1440 * 100) + "%",
                    width: (Math.max(b.duration, 6) / 1440 * 100) + "%",
                    background: b.color, color: b.color
                  }}
                  title={clock(b.start) + "–" + clock(b.start + b.duration) + "  " + b.title + "  ·  " + b.section + (b.done ? "  ✓" : "")} />;
              })}
              {p.day.openedAt != null
                ? <div class="tk-open" style={{ left: (p.day.openedAt / 1440 * 100) + "%" }}
                  title={"🛫 Note created " + clock(p.day.openedAt)} />
                : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Habits(props) {
  const d = props.data;
  const [min, setMin] = dc.useState(2);
  const [all, setAll] = dc.useState(false);

  const rows = d.habits.filter(function (x) { return x.marked || x.habitSection || x.dayCount >= min; });
  const shown = all ? rows : rows.slice(0, 20);

  return (
    <div>
      <div class="tk-ctrl">
        {[2, 3, 4, 5].map(function (n) {
          return <button key={n} class={"tk-btn" + (min === n ? " on" : "")}
            title={"Show tasks appearing on at least " + n + " days. Habit and Chore sections are always included."}
            onClick={function () { setMin(n); }}>{n}</button>;
        })}
        <span class="tk-lbl">occurrences</span>
        <span style={{ flex: 1 }} />
        <span class="tk-lbl">{rows.length}</span>
      </div>
      <div class="tk-wrap">
        <table class="tk-t">
          <thead>
            <tr>
              <th style={{ minWidth: "180px" }}>Task</th>
              {d.days.map(function (x) { return <th key={x.name} style={{ textAlign: "center" }}>{x.weekdayShort}</th>; })}
              <th style={{ textAlign: "right" }}>Done</th>
              <th style={{ minWidth: "76px" }}>Rate</th>
              <th style={{ textAlign: "center" }}>Streak</th>
              <th style={{ textAlign: "right" }}>Time</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(function (hb) {
              return (
                <tr key={hb.key}>
                  <td>
                    <span style={{
                      display: "inline-block", width: "8px", height: "8px", borderRadius: "3px",
                      background: hb.color, marginRight: "8px", verticalAlign: "middle"
                    }} />
                    {hb.title}
                    <div style={{ fontSize: "11px", color: "var(--tk-fnt)" }}>{hb.section}</div>
                  </td>
                  {hb.cells.map(function (c, i) {
                    const g = c.state === "done" ? "✓" : c.state === "missed" ? "" : c.state === "cancelled" ? "✕" : "·";
                    return (
                      <td key={i} style={{ textAlign: "center" }}>
                        <span class={"tk-cell " + c.state}
                          style={c.state === "done" ? { background: hb.color, color: "var(--tk-onacc)" } : null}
                          title={c.day.weekday + " — " + (c.state === "absent" ? "not listed" : c.state)}>{g}</span>
                      </td>
                    );
                  })}
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{hb.hit + "/" + hb.planned}</td>
                  <td>
                    <div class="tk-mini" title={Math.round(hb.rate * 100) + "%"}>
                      <i style={{ width: (hb.rate * 100) + "%", background: hb.color }} />
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

function Metrics(props) {
  const d = props.data;
  if (!d.metrics.length) return <div class="tk-empty">No metrics.</div>;
  return (
    <div class="tk-mc">
      {d.metrics.map(function (m) {
        const mx = Math.max.apply(null, m.series.map(function (s) { return s.value; }).concat([1]));
        return (
          <div class="tk-card" key={m.key}>
            <h4>{m.label}</h4>
            <b style={{ color: m.color }}>{fmtMetric(m.kind, m.total)}</b>
            <em>{fmtMetric(m.kind, m.avg) + " / day · " + m.active + "/" + d.days.length + " days"}</em>
            <div class="tk-spark">
              {m.series.map(function (s, i) {
                return <i key={i} style={{
                  height: Math.max(2, (s.value / mx) * 30) + "px",
                  background: s.value ? m.color : "var(--tk-trk)"
                }}
                  title={s.day.weekdayShort + ": " + fmtMetric(m.kind, s.value)} />;
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
  const cols = "minmax(84px,1.3fr) repeat(" + d.days.length + ", 1fr)";
  return (
    <div class="tk-wrap">
      <div class="tk-heat" style={{ gridTemplateColumns: cols, minWidth: (110 + d.days.length * 50) + "px" }}>
        <div />
        {d.days.map(function (x) { return <div class="hd" key={x.name}>{x.weekdayShort}</div>; })}
        {d.heat.map(function (r) {
          return [<div class="rl" key={r.name + "-l"} title={r.name}>{r.name}</div>]
            .concat(r.cells.map(function (c, i) {
              const a = c.minutes ? 0.2 + 0.8 * (c.minutes / d.heatMax) : 0;
              return (
                <div class="hc" key={r.name + i}
                  style={{
                    background: c.minutes ? r.color : "var(--tk-trk)", opacity: c.minutes ? a : 1,
                    color: a > 0.55 ? "var(--tk-onacc)" : "var(--tk-mut)"
                  }}
                  title={r.name + " · " + c.day.weekday + " — " + c.done + "/" + c.count + " tasks, " + hm(c.minutes)}>
                  {c.count ? (c.done + "/" + c.count) : ""}
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
    d.sections.forEach(function (s) {
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
              <span class="swatch" style={{ background: g.color }}>
                {props.medieval ? g.title.charAt(0).toUpperCase() : ""}
              </span>
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
                    <div class="u">{(mode === "section" && !sub) ? (t.date.getDate() + " " + MONTH_SHORT[t.date.getMonth()]) : ""}</div>
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

/* ------------------------------------------------------------------- shell */

function useWeekData(explicitFolder) {
  const path = dc.useCurrentPath();
  const rev = (typeof dc.useIndexUpdates === "function") ? dc.useIndexUpdates() : 0;
  const [st, setSt] = dc.useState({ loading: true, days: [], payload: null, source: "", error: null });

  const folder = explicitFolder ||
    ((path && path.indexOf("/") >= 0) ? path.slice(0, path.lastIndexOf("/")) : "");

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
        if (!dead) setSt({ loading: false, days: days, payload: payload, source: source, error: null });
      } catch (e) {
        if (!dead) setSt({ loading: false, days: [], payload: null, source: "", error: String((e && e.message) || e) });
      }
    })();
    return function () { dead = true; };
  }, [path, folder, rev]);

  return { st: st, folder: folder, path: path };
}

function WeeklyReport(props) {
  props = props || {};
  const [skin, setSkin] = dc.useState(function () { return readSkin(props.theme || "aware"); });
  const ctx = useWeekData(props.folder);
  const st = ctx.st;

  const pal = themes.palette(skin);
  const medieval = themes.isFancy(skin);
  const scope = dc.useMemo(function () { return "tkid-" + Math.random().toString(36).slice(2, 8); }, []);
  const css = dc.useMemo(function () { return themes.skinCss(skin, "." + scope); }, [skin, scope]);
  const d = dc.useMemo(function () { return core.aggregate(st.days, pal); }, [st.days, skin]);

  const setTheme = function (v) { setSkin(v); writeSkin(v); };

  const title = (st.payload && st.payload.title) ||
    (ctx.path ? ctx.path.split("/").pop().replace(/\.md$/, "") : "Weekly Report");

  const segs = d.sections.slice(0, 10).map(function (s) {
    return {
      name: s.name, value: s.minutes || s.count, color: s.color,
      label: hm(s.minutes) + " · " + s.done + "/" + s.count
    };
  });

  const header = (
    <div class="tk-hero">
      <div class="tk-hero-fx" />
      <div class="tk-hero-in">
        <div class="tk-head-row">
          <div>
            <div class="tk-kick">{medieval ? "Chronicle of the Week" : "Weekly report"}</div>
            <div class="tk-title">{title}</div>
            <div class="tk-sub">
              {st.loading ? "Reading…"
                : st.error ? ("Error: " + st.error)
                  : d.days.length ? (d.range + " · " + d.days.length + " days")
                    : "No daily notes in this folder"}
            </div>
          </div>
          <SkinPicker value={skin} onChange={setTheme} />
        </div>
        {d.days.length ? <div class="tk-tiles">
          <Tile color={pal[0]} value={d.rate + "%"} label="Completion" sub={d.doneTop + " of " + d.totalTop + " tasks"} />
          <Tile color={pal[1]} value={hm(d.doneMin)} label="Time completed" sub={"of " + hm(d.totalMin) + " scheduled"} />
          <Tile color={pal[2]} value={d.habits.length} label="Recurring"
            sub={d.habits.filter(function (x) { return x.rate >= 0.8; }).length + " at ≥ 80%"} />
          <Tile color={pal[3]} value={d.openTop} label="Left open"
            sub={d.cancelledTop ? (d.cancelledTop + " cancelled") : "none cancelled"} />
          <Tile color={pal[4]} value={d.totalPages} label="Pages read" sub={d.subs.length + " sub-tasks"} />
          <Tile color={pal[5]} value={d.avgWake != null ? clock(d.avgWake) : "—"} label="Note created"
            sub={"average of " + d.wake.length + " days"} />
        </div> : null}
      </div>
    </div>
  );

  const body = d.days.length ? (
    <div class="tk-grid">
      <Panel title={medieval ? "The Measure of the Week" : "Time allocation"} span="s5" color={pal[0]}
      >
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

      <Panel title={medieval ? "The Days" : "Daily load"} span="s7" color={pal[1]}
      >
        <DayColumns data={d} accent={pal[1]} />
      </Panel>

      <Panel title={medieval ? "Where the Hours Went" : "Sections"} span="s12" color={pal[2]}
      >
        <div class="tk-bars">
          {d.sections.map(function (s) {
            const mx = d.sections[0].minutes || 1;
            return (
              <div class="tk-bar" key={s.name}>
                <div class="lb" title={s.name}>{s.name}</div>
                <div class="tk-track2">
                  <div class="fl" style={{ width: ((s.minutes / mx) * 100) + "%", background: s.color }} />
                  <div class="fd" style={{ width: ((s.doneMinutes / mx) * 100) + "%", background: s.color, color: s.color }} />
                </div>
                <div class="vl">{hm(s.minutes) + "  ·  " + s.done + "/" + s.count + "  ·  " + pct(s.done, s.count) + "%"}</div>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title={medieval ? "The Book of Hours" : "Day rhythm"} span="s12" color={pal[3]}
      >
        <Timeline data={d} />
      </Panel>

      <Panel title={medieval ? "The Roll of Deeds" : "Recurring tasks & streaks"} span="s12" color={pal[4]}
      >
        <Habits data={d} />
      </Panel>

      <Panel title={medieval ? "Tallies & Measures" : "Reading & stats"} span="s7" color={pal[5]}
      >
        <Metrics data={d} />
      </Panel>

      <Panel title={medieval ? "The Tapestry" : "Section × day"} span="s5" color={pal[6]}
      >
        <Heat data={d} />
      </Panel>

      <Panel title={medieval ? "The Full Ledger" : ""} span="s12" color={pal[7]}
      >
        <Ledger data={d} medieval={medieval} />
      </Panel>
    </div>
  ) : (!st.loading
    ? <div class="tk-panel"><div class="tk-empty">{"Nothing in " + ctx.folder}</div></div>
    : null);

  return (
    <div class={scope}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div class="tk">
        <div class="tk-shell">
          {medieval ? <div class="tk-frame" /> : null}
          {medieval ? <Corner v="top" hz="left" /> : null}
          {medieval ? <Corner v="top" hz="right" /> : null}
          {medieval ? <Corner v="bottom" hz="left" /> : null}
          {medieval ? <Corner v="bottom" hz="right" /> : null}
          <div class="tk-inner">
            {header}
            {medieval ? <div class="tk-rule"><span>❦</span></div> : null}
            {body}
          </div>
        </div>
      </div>
    </div>
  );
}

return {
  WeeklyReport: WeeklyReport,
  SkinPicker: SkinPicker, Panel: Panel, Tile: Tile, Donut: Donut,
  Timeline: Timeline, Habits: Habits, Metrics: Metrics, Heat: Heat, Ledger: Ledger,
  DayColumns: DayColumns, Corner: Corner,
  readSkin: readSkin, writeSkin: writeSkin, openTarget: openTarget,
  core: core, themes: themes
};
