/* ==========================================================================
   TRACKER HUB  ·  Meta/Obsidian/_datacore/report/tracker-hub.jsx
   --------------------------------------------------------------------------
   Calendar of every week under the tracker root, with a Crunch button that
   compiles a week's daily notes into one compact report and trashes them.

   Usage inside your central note:
     ```datacorejsx
     const { Hub } = await dc.require("Meta/Obsidian/_datacore/report/tracker-hub.jsx");
     return function View() { return <Hub root="Meta/Tracker" />; };
     ```
   ========================================================================== */

const LIB = "Meta/Obsidian/_datacore/report";
const core = await dc.require(LIB + "/tracker-core.jsx");
const themes = await dc.require(LIB + "/tracker-themes.jsx");
const report = await dc.require(LIB + "/tracker-report.jsx");

const hm = core.hm, clock = core.clock, pct = core.pct;
const MONTH_LONG = core.MONTH_LONG, WEEKDAY_SHORT = core.WEEKDAY_SHORT;

const HUB_CSS = `
.tk-top{ display:flex; align-items:center; justify-content:flex-end; gap:8px; margin-bottom:14px; }
.tk-years{ display:flex; gap:5px; margin-right:auto; }
.tk-month{ margin-bottom:16px; }
.tk-month > h4{ margin:0 0 8px; font-family:var(--tk-fonth); font-size:11px; letter-spacing:.14em;
  text-transform:uppercase; color:var(--tk-mut); font-weight:700; display:flex; align-items:baseline; gap:10px; }
.tk-month > h4 em{ font-style:normal; font-size:11px; letter-spacing:.08em; color:var(--tk-mut);
  font-weight:600; opacity:.9; }
.tk-month > h4:after{ content:''; flex:1; height:1px; background:var(--tk-bd2); align-self:center; }
.tk-weeks{ display:grid; grid-template-columns:repeat(auto-fill,minmax(78px,1fr)); gap:7px; }
.tk-wk{ position:relative; overflow:hidden; cursor:pointer; padding:9px 10px 8px 12px;
  border-radius:var(--tk-rad2); background:var(--tk-card); border:1px solid var(--tk-bd2);
  box-shadow:var(--tk-tile-sh,none); color:var(--tk-tx); font-family:inherit; text-align:left; }
.tk-wk .bar{ position:absolute; left:0; top:0; bottom:0; width:3px;
  border-radius:var(--tk-rad2) 0 0 var(--tk-rad2); }
.tk-wk .no{ display:block; font-family:var(--tk-fonth); font-size:19px; font-weight:var(--tk-num-w,750);
  line-height:1.15; color:var(--tk-tx-strong,var(--tk-tx)); white-space:nowrap;
  letter-spacing:0; font-variant-numeric:tabular-nums; overflow:visible; }
.tk-wk .no sup{ font-size:.56em; font-weight:600; margin-left:1px; letter-spacing:.02em;
  vertical-align:baseline; position:relative; top:-.42em; line-height:1; opacity:.85; }
.tk-wk.empty{ opacity:.4; }
.tk-wk.now{ box-shadow:0 0 0 2px var(--tk-acc); }
.tk-wk.sel{ border-color:var(--tk-acc); background:var(--tk-hover); }
.tk-wk:hover{ border-color:var(--tk-acc); }
.tk-dots{ display:flex; gap:2px; margin-top:7px; }
.tk-dots i{ flex:1; height:4px; border-radius:99px; background:var(--tk-trk); }
.tk-dayrow{ display:grid; grid-template-columns:38px minmax(90px,1fr) 58px 70px 52px; gap:9px;
  align-items:center; padding:5px 0; border-top:1px solid var(--tk-bd2); font-size:12.5px; }
.tk-dayrow .nm{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.tk-dayrow .nm a{ color:var(--tk-link); text-decoration:none; cursor:pointer; }
.tk-dayrow .nm a:hover{ text-decoration:underline; }
.tk-crunch{ display:flex; flex-wrap:wrap; gap:9px; align-items:center; margin-top:13px;
  padding-top:12px; border-top:1px solid var(--tk-bd2); }
@media (max-width:520px){ .tk-dayrow{ grid-template-columns:34px 1fr 52px; }
  .tk-dayrow .tk-mini,.tk-dayrow .hrs{ display:none; } }
`;

/* ------------------------------------------------------------------ scanning */

function weekNumberOf(name) {
  const m = String(name).match(/(\d{1,2})/);
  return m ? +m[1] : null;
}
function isReportFile(f) { return /report/i.test(f.basename); }

function scanTree(root) {
  const out = [];
  const rootFolder = core.folderAt(app, root);
  if (!rootFolder) return out;

  const walk = function (folder, trail) {
    const subs = core.childFolders(folder);
    const notes = core.childNotes(folder);
    if (!subs.length) {                       /* leaf folder = a week (even if empty) */
      const dailies = notes.filter(function (f) { return !isReportFile(f); });
      const rep = notes.filter(isReportFile)[0] || null;
      const year = parseInt(trail[0], 10);
      const monthIdx = MONTH_LONG.map(function (m) { return m.toLowerCase(); })
        .indexOf(String(trail[1] || "").toLowerCase().slice(0, 20));
      out.push({
        path: folder.path, name: folder.name, trail: trail.slice(),
        year: isNaN(year) ? null : year,
        monthName: trail[1] || "", monthIdx: monthIdx,
        weekNum: weekNumberOf(folder.name),
        dailies: dailies, report: rep
      });
      return;
    }
    subs.forEach(function (s) { walk(s, trail.concat([s.name])); });
  };
  core.childFolders(rootFolder).forEach(function (y) { walk(y, [y.name]); });
  return out;
}

function weekRange(w) {
  const dates = w.dailies.map(function (f) { return core.resolveDate(f.basename, f); })
    .sort(function (a, b) { return a - b; });
  if (dates.length) return { from: dates[0], to: dates[dates.length - 1], exact: true };
  if (w.year && w.weekNum) {
    const s = core.isoWeekStart(w.year, w.weekNum);
    const e = new Date(s); e.setDate(s.getDate() + 6);
    return { from: s, to: e, exact: false };
  }
  return null;
}

/* --------------------------------------------------------------------- crunch */

async function crunchWeek(w) {
  const days = await core.loadWeekFolder(app, w.path);
  if (!days.length) throw new Error("No daily notes found in " + w.path);

  const data = core.aggregate(days, themes.palette("aware"));
  const rg = weekRange(w);
  const payload = core.encodeWeek(days, {
    title: w.name + " Week",
    week: w.weekNum, year: w.year,
    month: w.monthIdx >= 0 ? w.monthIdx + 1 : null, monthName: w.monthName,
    path: w.path,
    from: rg ? core.iso(rg.from) : null,
    to: rg ? core.iso(rg.to) : null,
    generated: new Date().toISOString()
  });

  const text = core.buildReportNote(payload, data, LIB, report.readSkin("aware"));
  const target = w.path + "/" + w.name + " Week Report.md";
  const existing = app.vault.getAbstractFileByPath(target);
  if (existing) await app.vault.modify(existing, text);
  else await app.vault.create(target, text);

  /* verify the written file round-trips before touching the dailies */
  const written = app.vault.getAbstractFileByPath(target);
  if (!written) throw new Error("Report file was not created");
  const back = core.extractPayload(await app.vault.read(written));
  if (!back || !back.tasks || back.tasks.length !== payload.tasks.length)
    throw new Error("Report failed verification — daily notes left untouched");

  let trashed = 0;
  for (let i = 0; i < w.dailies.length; i++) {
    const f = w.dailies[i];
    try {
      if (app.fileManager && app.fileManager.trashFile) await app.fileManager.trashFile(f);
      else await app.vault.trash(f, true);
      trashed++;
    } catch (e) { /* keep going */ }
  }
  return { target: target, tasks: payload.tasks.length, days: days.length, trashed: trashed, data: data };
}

/* ------------------------------------------------------------------ the view */

function WeekCard(props) {
  const w = props.week, rg = props.range;
  const have = {};
  w.dailies.forEach(function (f) { have[core.resolveDate(f.basename, f).getDay()] = true; });
  const dots = [1, 2, 3, 4, 5, 6, 0].map(function (dow) { return !!have[dow]; });

  const state = w.report ? "done" : (w.dailies.length ? "live" : "empty");
  const barColor = state === "done" ? "var(--tk-ok)" : state === "live" ? "var(--tk-acc)" : "transparent";
  const dotColor = state === "done" ? "var(--tk-ok)" : "var(--tk-acc)";

  const om = /^(\d+)(\D*)$/.exec(w.name.trim());
  const numPart = om ? om[1] : w.name;
  const suffix = om ? om[2] : "";

  const tip = w.name + (rg ? "  ·  " + core.shortDate(rg.from) + " – " + core.shortDate(rg.to) + " " + rg.to.getFullYear() : "") +
    "\n" + (w.report ? "Crunched" : w.dailies.length ? (w.dailies.length + " days logged") : "No notes") +
    (props.now ? "\nCurrent week" : "");

  return (
    <button class={"tk-wk " + state + (props.selected ? " sel" : "") + (props.now ? " now" : "")}
      title={tip} onClick={props.onClick}>
      <span class="bar" style={{ background: barColor }} />
      <span class="no">{numPart}{suffix ? <sup>{suffix}</sup> : null}</span>
      <span class="tk-dots">
        {dots.map(function (on, i) {
          return <i key={i} style={on ? { background: dotColor } : null} />;
        })}
      </span>
    </button>
  );
}

function WeekDetail(props) {
  const w = props.week;
  const [state, setState] = dc.useState({ loading: true, days: [], data: null });
  const [busy, setBusy] = dc.useState(false);
  const [msg, setMsg] = dc.useState(null);
  const [err, setErr] = dc.useState(null);

  dc.useEffect(function () {
    let dead = false;
    setMsg(null); setErr(null);
    (async function () {
      try {
        let days = [];
        if (w.report) {
          const p = core.extractPayload(await app.vault.cachedRead(w.report));
          days = p ? core.decodeWeek(p) : [];
        }
        if (!days.length) days = await core.loadWeekFolder(app, w.path);
        const data = core.aggregate(days, props.palette);
        if (!dead) setState({ loading: false, days: days, data: data });
      } catch (e) {
        if (!dead) { setState({ loading: false, days: [], data: null }); setErr(String((e && e.message) || e)); }
      }
    })();
    return function () { dead = true; };
  }, [w.path, w.report ? w.report.path : "", props.rev]);

  const d = state.data;

  const doCrunch = async function () {
    setBusy(true); setErr(null); setMsg(null);
    try {
      const r = await crunchWeek(w);
      setMsg("Crunched " + r.days + " daily notes into " + r.tasks + " task rows. " +
        r.trashed + " note" + (r.trashed === 1 ? "" : "s") + " moved to trash.");
      props.onDone();
    } catch (e) { setErr(String((e && e.message) || e)); }
    setBusy(false);
  };

  const openNote = function (p, e) {
    e.preventDefault();
    try { app.workspace.openLinkText(p, "", false); } catch (x) { }
  };

  return (
    <div class="tk-detail">
      {state.loading ? <div class="tk-empty">Reading…</div> : null}

      {d && d.days.length ? <div class="tk-tiles" style={{ marginTop: 0, marginBottom: "12px" }}>
        <Tile2 color={props.palette[0]} value={d.days.length} label="Days" />
        <Tile2 color={props.palette[1]} value={d.doneTop + "/" + d.totalTop} label="Done" sub={d.rate + "%"} />
        <Tile2 color={props.palette[2]} value={hm(d.totalMin)} label="Scheduled" sub={hm(d.doneMin) + " done"} />
        <Tile2 color={props.palette[3]} value={d.habits.length} label="Recurring" />
        <Tile2 color={props.palette[4]} value={d.totalPages} label="Pages" />
      </div> : null}

      {d && d.days.length ? <div>
        {d.perDay.map(function (p) {
          return (
            <div class="tk-dayrow" key={p.day.name}>
              <div class="tk-dl">{p.day.weekdayShort}</div>
              <div class="nm">
                {w.report
                  ? <span>{p.day.name}</span>
                  : <a onClick={function (e) { openNote(p.day.path, e); }}>{p.day.name}</a>}
              </div>
              <div class="tk-dv">{p.done + "/" + p.total}</div>
              <div class="tk-mini" title={pct(p.done, p.total) + "%"}>
                <i style={{ width: pct(p.done, p.total) + "%", background: props.palette[0] }} />
              </div>
              <div class="tk-dv hrs" style={{ textAlign: "right" }}>{hm(p.minutes)}</div>
            </div>
          );
        })}
      </div> : null}

      {!state.loading && !(d && d.days.length)
        ? <div class="tk-empty">Empty week.</div>
        : null}

      <div class="tk-crunch">
        {w.report
          ? [
            <button key="b" class="tk-btn big" title={w.report.path}
              onClick={function (e) { openNote(w.report.path, e); }}>Open report</button>,
            w.dailies.length
              ? <button key="c" class="tk-btn big danger" disabled={busy} onClick={doCrunch}>
                {busy ? "Working…" : "Re-crunch"}
              </button>
              : null
          ]
          : <button class="tk-btn big danger" disabled={busy || !w.dailies.length} onClick={doCrunch}>
            {busy ? "Working…" : "Crunch"}
          </button>}
        {msg ? <span class="tk-msg">{msg}</span> : null}
        {err ? <span class="tk-err">{err}</span> : null}
      </div>
    </div>
  );
}

function Tile2(props) {
  return (
    <div class="tk-tile">
      <div class="cap" style={{ background: props.color }} />
      <b>{props.value}</b><i>{props.label}</i>
      {props.sub ? <em>{props.sub}</em> : null}
    </div>
  );
}

function Hub(props) {
  props = props || {};
  const root = props.root || "Meta/Tracker";
  const [skin, setSkin] = dc.useState(function () { return report.readSkin(props.theme || "aware"); });
  const [rev, setRev] = dc.useState(0);
  const [sel, setSel] = dc.useState(null);
  const idx = (typeof dc.useIndexUpdates === "function") ? dc.useIndexUpdates() : 0;

  const pal = themes.palette(skin);
  const medieval = themes.isFancy(skin);
  const scope = dc.useMemo(function () { return "tkid-" + Math.random().toString(36).slice(2, 8); }, []);
  const css = dc.useMemo(function () {
    return themes.skinCss(skin, "." + scope) + themes.scopeCss(HUB_CSS, "." + scope);
  }, [skin, scope]);

  const weeks = dc.useMemo(function () { return scanTree(root); }, [root, rev, idx]);

  const years = dc.useMemo(function () {
    const s = [];
    weeks.forEach(function (w) { const y = w.trail[0]; if (s.indexOf(y) < 0) s.push(y); });
    return s.sort().reverse();
  }, [weeks]);

  const nowIso = core.isoWeek(new Date());
  const [year, setYear] = dc.useState(null);
  const activeYear = year || (years.indexOf(String(nowIso.year)) >= 0 ? String(nowIso.year) : years[0]);

  const months = dc.useMemo(function () {
    const list = weeks.filter(function (w) { return w.trail[0] === activeYear; });
    const map = new Map();
    list.forEach(function (w) {
      const k = w.trail[1] || "—";
      if (!map.has(k)) map.set(k, { name: k, idx: w.monthIdx, weeks: [] });
      map.get(k).weeks.push(w);
    });
    const arr = Array.from(map.values());
    arr.forEach(function (m) {
      m.weeks.sort(function (a, b) { return (a.weekNum || 0) - (b.weekNum || 0); });
    });
    arr.sort(function (a, b) { return (a.idx < 0 ? 99 : a.idx) - (b.idx < 0 ? 99 : b.idx); });
    return arr;
  }, [weeks, activeYear]);

  const selected = weeks.filter(function (w) { return sel && w.path === sel; })[0] || null;

  const setTheme = function (v) { setSkin(v); report.writeSkin(v); };

  return (
    <div class={scope}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div class="tk">
        <div class="tk-shell">
          {medieval ? <div class="tk-frame" /> : null}
          {medieval ? <report.Corner v="top" hz="left" /> : null}
          {medieval ? <report.Corner v="top" hz="right" /> : null}
          {medieval ? <report.Corner v="bottom" hz="left" /> : null}
          {medieval ? <report.Corner v="bottom" hz="right" /> : null}
          <div class="tk-inner">

            <div class="tk-top">
              {years.length > 1
                ? <div class="tk-years">
                  {years.map(function (y) {
                    return <button key={y} class={"tk-btn" + (y === activeYear ? " on" : "")}
                      onClick={function () { setYear(y); setSel(null); }}>{y}</button>;
                  })}
                </div>
                : null}
              <report.SkinPicker value={skin} onChange={setTheme} />
            </div>

            {months.map(function (m) {
              return (
                <div class="tk-month" key={m.name}>
                  <h4>{m.name}<em>{activeYear}</em></h4>
                  <div class="tk-weeks">
                    {m.weeks.map(function (w) {
                      const rg = weekRange(w);
                      const isNow = w.year === nowIso.year && w.weekNum === nowIso.week;
                      return <WeekCard key={w.path} week={w} range={rg} now={isNow}
                        selected={sel === w.path}
                        onClick={function () { setSel(sel === w.path ? null : w.path); }} />;
                    })}
                  </div>
                </div>
              );
            })}

            {!months.length
              ? <div class="tk-empty">{"No week folders under " + root}</div>
              : null}

            {selected
              ? <Panel2 color={pal[1]}
                title={selected.name + (function () {
                  const rg = weekRange(selected);
                  return rg ? ("  ·  " + core.shortDate(rg.from) + " – " + core.shortDate(rg.to) + " " + rg.to.getFullYear()) : "";
                })()}>
                <WeekDetail week={selected} palette={pal} rev={rev}
                  onDone={function () { setRev(function (r) { return r + 1; }); }} />
              </Panel2>
              : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function Panel2(props) {
  return (
    <div class="tk-panel s12">
      <h3><span class="dot" style={{ background: props.color }} />{props.title}</h3>
      {props.note ? <p class="n">{props.note}</p> : null}
      {props.children}
    </div>
  );
}

return {
  Hub: Hub, scanTree: scanTree, crunchWeek: crunchWeek, weekRange: weekRange,
  core: core, themes: themes
};
