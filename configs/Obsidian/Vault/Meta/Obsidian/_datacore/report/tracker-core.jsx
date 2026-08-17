/* ==========================================================================
   TRACKER CORE  ·  Meta/Obsidian/_datacore/report/tracker-core.jsx
   --------------------------------------------------------------------------
   Pure logic, no UI. Parses daily notes, aggregates a week, and encodes /
   decodes the compact week payload that the report + monthly rollups read.

   Load with:  const core = await dc.require("Meta/Obsidian/_datacore/report/tracker-core.jsx");
   ========================================================================== */

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_LONG = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

/* Sections whose bullets are numeric tallies rather than tasks. */
const METRIC_SECTIONS = ["reading metrics", "reading metric", "stats", "statistic", "statistics",
  "metrics", "metric", "tally", "tallies", "tracker", "trackers"];
/* Sections that are habitual by nature — always shown in the streak grid. */
const HABIT_SECTIONS = ["habit", "habits", "chore", "chores", "routine", "routines", "ritual", "rituals"];

const PRIORITIES = {
  "\u{1F53A}": { name: "Highest", rank: 5 },
  "\u{23EB}": { name: "High", rank: 4 },
  "\u{1F53C}": { name: "Medium", rank: 3 },
  "\u{1F53D}": { name: "Low", rank: 2 },
  "\u{23EC}": { name: "Lowest", rank: 1 }
};
const PRIORITY_RE = /[\u{1F53A}\u{23EB}\u{1F53C}\u{1F53D}\u{23EC}]/gu;
const UNIT_WORDS = /\b(pages?|times?|minutes?|mins?|seconds?|secs?|hours?|hrs?|in|of|total|the|a|an|x)\b/gi;

/* ----------------------------------------------------------------- helpers */

function normKey(s) {
  return String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
function isMetricSection(n) { return METRIC_SECTIONS.indexOf(normKey(n)) >= 0; }
function isHabitSection(n) { return HABIT_SECTIONS.indexOf(normKey(n)) >= 0; }

function stripInlineMarkup(s) {
  return String(s || "")
    .replace(/!\[\[([^\]]+)\]\]/g, "$1")
    .replace(/!\[([^\]]*)\]\(([^)]*)\)/g, "$1")
    .replace(/\[([^\]]*)\]\(([^)]*)\)/g, "$1")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/(?<![\p{L}\p{N}])[*_](?=\S)(.*?)(?<=\S)[*_](?![\p{L}\p{N}])/gu, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLink(text) {
  let m = String(text).match(/\[([^\]]*)\]\(([^)]+)\)/);
  if (m) {
    const target = m[2].trim();
    return { label: (m[1] || target).trim(), target: target, external: /^[a-z][a-z0-9+.-]*:\/\//i.test(target) };
  }
  m = String(text).match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
  if (m) return { label: (m[2] || m[1]).trim(), target: m[1].trim(), external: false };
  return null;
}

/* Checkbox character -> state.  [-] and ~~struck~~ both mean cancelled. */
function statusOf(ch) {
  if (ch == null) return "none";
  const c = String(ch);
  if ("xX\u2713\u2714".indexOf(c) >= 0) return "done";
  if (c === "-" || c === "~") return "cancelled";
  if (c === "/") return "doing";
  if (c === ">" || c === "<") return "deferred";
  if (c === "!") return "urgent";
  if (c === "?") return "question";
  if (c.trim() === "") return "todo";
  return "other";
}

/* -------------------------------------------------------------- formatting */

function hm(min) {
  min = Math.round(min || 0);
  const h = Math.floor(min / 60), m = min % 60;
  if (h && m) return h + "h " + m + "m";
  if (h) return h + "h";
  return m + "m";
}
function clock(min) {
  if (min == null) return "";
  const h = Math.floor(min / 60) % 24, m = Math.round(min % 60);
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}
function fmtMetric(kind, v) {
  v = v || 0;
  if (kind === "duration") {
    const h = Math.floor(v / 3600), m = Math.floor((v % 3600) / 60), s = Math.round(v % 60);
    if (h) return h + "h " + m + "m";
    if (m) return m + "m " + s + "s";
    return s + "s";
  }
  return String(Math.round(v * 100) / 100);
}
function pct(a, b) { return b ? Math.round((a / b) * 100) : 0; }
function iso(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function shortDate(d) { return d.getDate() + " " + MONTH_SHORT[d.getMonth()]; }
function ordinal(n) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
/* ISO-8601 week number, matching folder names like "33rd". */
function isoWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const n = 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return { year: d.getFullYear(), week: n };
}
/* Monday of a given ISO week. */
function isoWeekStart(year, week) {
  const simple = new Date(year, 0, 4);
  const dow = (simple.getDay() + 6) % 7;
  const monday = new Date(simple);
  monday.setDate(simple.getDate() - dow + (week - 1) * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/* ------------------------------------------------------------ date parsing */

function resolveDate(basename, file) {
  const wdm = String(basename).match(/\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/i);
  const want = wdm ? ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].indexOf(wdm[1].toLowerCase()) : -1;
  let d = null, m;

  m = String(basename).match(/(\d{4})[-._/](\d{1,2})[-._/](\d{1,2})/);
  if (m) d = new Date(+m[1], +m[2] - 1, +m[3]);

  if (!d) {
    m = String(basename).match(/(\d{1,2})[-._/](\d{1,2})[-._/](\d{4})/);
    if (m) {
      const a = +m[1], b = +m[2], y = +m[3];
      const d1 = new Date(y, b - 1, a);   // dd-MM-yyyy
      const d2 = new Date(y, a - 1, b);   // MM-dd-yyyy
      const v1 = d1.getMonth() === b - 1 && d1.getDate() === a;
      const v2 = d2.getMonth() === a - 1 && d2.getDate() === b;
      if (want >= 0) {
        if (v1 && d1.getDay() === want) d = d1;
        else if (v2 && d2.getDay() === want) d = d2;
      }
      if (!d) d = v1 ? d1 : (v2 ? d2 : null);
    }
  }
  if (!d || isNaN(d.getTime())) d = new Date(file && file.stat ? file.stat.ctime : Date.now());
  d.setHours(0, 0, 0, 0);
  return d;
}

/* ------------------------------------------------------------- task parsing */

function parseTask(body, ctx) {
  let text = String(body).trim();
  if (!text) return null;

  /* leading time range: "04:00 - 06:00" or a single "04:00" */
  let start = null, end = null;
  let m = text.match(/^(\d{1,2}):(\d{2})\s*(?:[-\u2013\u2014]|to)\s*(\d{1,2}):(\d{2})/);
  if (m) {
    start = (+m[1]) * 60 + (+m[2]);
    end = (+m[3]) * 60 + (+m[4]);
    text = text.slice(m[0].length);
  } else {
    m = text.match(/^(\d{1,2}):(\d{2})(?![\d:])/);
    if (m) { start = (+m[1]) * 60 + (+m[2]); text = text.slice(m[0].length); }
  }
  let duration = 0;
  if (start != null && end != null) {
    duration = end - start;
    if (duration < 0) duration += 1440;
    if (duration > 1440) duration = 1440;
  }

  let priority = null;
  text = text.replace(PRIORITY_RE, function (ch) { if (!priority) priority = ch; return " "; });

  let recurring = false;
  if (text.indexOf("\u{1F501}") >= 0) { recurring = true; text = text.replace(/\u{1F501}/gu, " "); }

  let doneDate = null;
  text = text.replace(/([\u{1F4C5}\u{23F3}\u{1F6EB}\u{2705}\u{2795}\u{274C}])\s*(\d{4}-\d{2}-\d{2})/gu,
    function (all, e, dt) { if (e === "\u2705") doneDate = dt; return " "; });

  /* trailing page tally.  ": 230 - 234 Pages" -> 4 pages read.
     ": 12 Pages" -> 12 pages read.  Only the COUNT is kept. */
  let pages = null;
  let pg = text.match(/[:\uFF1A]\s*(\d+)\s*[-\u2013\u2014]\s*(\d+)\s*(?:pages?|pp?)\s*$/i);
  if (pg) { pages = Math.max(0, (+pg[2]) - (+pg[1])); text = text.slice(0, pg.index); }
  else {
    pg = text.match(/[:\uFF1A]\s*(\d+)\s*(?:pages?|pp?)\s*$/i);
    if (pg) { pages = +pg[1]; text = text.slice(0, pg.index); }
  }

  /* whole-line strikethrough is a second way of saying "cancelled" */
  const struck = /^\s*~~[\s\S]+~~\s*$/.test(text);

  const link = extractLink(text);
  let title = stripInlineMarkup(text)
    .replace(/^[\s:\uFF1A\-\u2013\u2014]+/, "").replace(/[\s:\uFF1A\-\u2013\u2014]+$/, "").trim();
  if (!title && link) title = link.label;
  if (!title) return null;

  let state = statusOf(ctx.box);
  if (struck && state !== "done") state = "cancelled";

  return {
    title: title, key: normKey(title),
    section: ctx.section, habitSection: isHabitSection(ctx.section),
    indent: ctx.indent, order: ctx.order,
    isTask: ctx.box != null, box: ctx.box, state: state,
    done: state === "done", cancelled: state === "cancelled",
    start: start, end: end, duration: duration,
    priority: priority,
    priorityName: priority ? PRIORITIES[priority].name : null,
    priorityRank: priority ? PRIORITIES[priority].rank : 0,
    recurring: recurring, doneDate: doneDate, pages: pages, link: link,
    dayName: ctx.day.name, dayPath: ctx.day.path,
    date: ctx.day.date, weekdayShort: ctx.day.weekdayShort, sortKey: ctx.day.sortKey
  };
}

/* Rebuild a markdown line from a parsed task (used by the archive export). */
function taskRaw(t) {
  const pad = t.indent > 0 ? "    " : "";
  const box = t.box == null ? "" : "[" + t.box + "] ";
  const time = t.start != null ? (clock(t.start) + (t.end != null ? " - " + clock(t.end) : "") + " ") : "";
  const pri = t.priority ? t.priority + " " : "";
  const rec = t.recurring ? "\u{1F501} " : "";
  const name = t.link ? ("[" + t.title + "](" + t.link.target + ")") : t.title;
  const pgs = t.pages != null ? (" : " + t.pages + " Pages") : "";
  return pad + "- " + box + time + pri + rec + name + pgs;
}

/* ----------------------------------------------------------- metric parsing */

function parseMetric(body, section, day) {
  let t = String(body);
  t = t.replace(/^\[.\]\s*/, "");
  t = t.replace(/:[A-Za-z0-9_+\-]+:/g, " ");           // :LiTarget: icon shortcodes
  t = t.replace(/\p{Extended_Pictographic}/gu, " ");   // emoji
  t = t.replace(/[\uFE0F\u200D\u20E3]/g, " ");
  t = stripInlineMarkup(t);
  if (!t) return null;

  const nums = Array.from(t.matchAll(/\d+(?:\.\d+)?/g));
  const lower = t.toLowerCase();

  let kind = "count", value = 0;
  if (/\b(minutes?|mins?|seconds?|secs?|hours?|hrs?)\b/.test(lower)) {
    kind = "duration";
    const hh = lower.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/);
    const mn = lower.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?)\b/);
    const sc = lower.match(/(\d+(?:\.\d+)?)\s*(?:seconds?|secs?)\b/);
    value = (hh ? parseFloat(hh[1]) * 3600 : 0) + (mn ? parseFloat(mn[1]) * 60 : 0) + (sc ? parseFloat(sc[1]) : 0);
  } else if (/\bpages?\b/.test(lower)) { kind = "pages"; value = nums.length ? parseFloat(nums[0][0]) : 0; }
  else if (/\btimes?\b/.test(lower)) { kind = "times"; value = nums.length ? parseFloat(nums[0][0]) : 0; }
  else { value = nums.length ? parseFloat(nums[0][0]) : 0; }

  let label;
  if (nums.length && nums[0].index > 0) {
    const head = t.slice(0, nums[0].index).replace(/[:\uFF1A\-\u2013\u2014]\s*$/, "").trim();
    const lastN = nums[nums.length - 1];
    let tail = t.slice(lastN.index + lastN[0].length)
      .replace(UNIT_WORDS, " ").replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim();
    label = tail ? (head + " " + tail).trim() : head;
  } else {
    label = t.replace(/\d+(?:\.\d+)?/g, " ").replace(UNIT_WORDS, " ")
      .replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim();
  }
  if (!label) label = t.trim();

  return {
    label: label, key: normKey(label), kind: kind, value: value,
    section: section, day: day.name, sortKey: day.sortKey, weekdayShort: day.weekdayShort
  };
}

/* -------------------------------------------------------------- note parser */

function parseDaily(file, content) {
  const lines = String(content).split(/\r?\n/);
  const date = resolveDate(file.basename, file);
  const day = {
    path: file.path, name: file.basename, date: date, sortKey: date.getTime(),
    weekday: WEEKDAY[date.getDay()], weekdayShort: WEEKDAY_SHORT[date.getDay()],
    label: shortDate(date), tasks: [], metrics: [], sectionOrder: [], openedAt: null
  };

  let inFence = false, fenceCh = null, inFm = false;
  let section = "General", order = 0;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i], t = raw.trim();

    if (i === 0 && t === "---") { inFm = true; continue; }
    if (inFm) { if (t === "---" || t === "...") inFm = false; continue; }

    const f = t.match(/^(`{3,}|~{3,})/);
    if (f) {
      if (!inFence) { inFence = true; fenceCh = f[1][0]; }
      else if (t[0] === fenceCh) { inFence = false; fenceCh = null; }
      continue;
    }
    if (inFence || !t) continue;
    if (t.startsWith("%%") || t.startsWith("<!--") || t === "-->") continue;
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) continue;

    if (/^\u{1F6EB}/u.test(t)) {                       // 🛫 first entry of the day
      const mm = t.match(/(\d{1,2}):(\d{2})/);
      if (mm) day.openedAt = (+mm[1]) * 60 + (+mm[2]);
      continue;
    }
    if (/^(#[^\s#]+\s*)+$/.test(t)) continue;          // tag-only line: #task #daily

    const li = raw.match(/^(\s*)(?:[-*+]|\d+[.)])\s+(.*)$/);
    if (!li) {                                          // plain line = section heading
      let s = t.replace(/^#{1,6}\s+/, "");
      s = stripInlineMarkup(s).replace(/[:\uFF1A]\s*$/, "").trim();
      if (s) { section = s; if (day.sectionOrder.indexOf(s) < 0) day.sectionOrder.push(s); }
      continue;
    }

    const indent = li[1].replace(/\t/g, "    ").length;
    let bodyTxt = li[2];
    let box = null;
    const cb = bodyTxt.match(/^\[(.)\]\s*(.*)$/);
    if (cb) { box = cb[1]; bodyTxt = cb[2]; }

    if (isMetricSection(section)) {
      const mm = parseMetric(bodyTxt, section, day);
      if (mm) day.metrics.push(mm);
      continue;
    }
    const task = parseTask(bodyTxt, { day: day, section: section, indent: indent, box: box, order: order++ });
    if (task) day.tasks.push(task);
  }
  return day;
}

/* ------------------------------------------------------------------ compact */

const T_COLS = ["day", "sec", "title", "box", "start", "end", "prio", "rec", "indent", "link", "ext", "pages"];
const D_COLS = ["date", "name", "open"];
const M_COLS = ["label", "kind", "values"];

function encodeWeek(days, meta) {
  const sections = [];
  const sIdx = function (n) {
    let i = sections.indexOf(n);
    if (i < 0) { sections.push(n); i = sections.length - 1; }
    return i;
  };
  const dayRows = days.map(function (d) { return [iso(d.date), d.name, d.openedAt]; });
  const taskRows = [];
  days.forEach(function (d, di) {
    d.tasks.forEach(function (t) {
      taskRows.push([di, sIdx(t.section), t.title, t.box, t.start, t.end,
        t.priority || null, t.recurring ? 1 : 0, t.indent,
        t.link ? t.link.target : null, (t.link && t.link.external) ? 1 : 0,
        t.pages]);
    });
  });
  const mMap = new Map();
  days.forEach(function (d, di) {
    d.metrics.forEach(function (m) {
      if (!mMap.has(m.key)) mMap.set(m.key, { label: m.label, kind: m.kind, values: days.map(function () { return 0; }) });
      mMap.get(m.key).values[di] += m.value;
    });
  });
  const metricRows = Array.from(mMap.values()).map(function (g) { return [g.label, g.kind, g.values]; });

  return Object.assign({}, meta || {}, {
    dcols: D_COLS, days: dayRows,
    sections: sections,
    tcols: T_COLS, tasks: taskRows,
    mcols: M_COLS, metrics: metricRows
  });
}

function decodeWeek(p) {
  const dayObjs = (p.days || []).map(function (row) {
    const parts = String(row[0]).split("-");
    const dt = new Date(+parts[0], (+parts[1]) - 1, +parts[2]);
    dt.setHours(0, 0, 0, 0);
    return {
      path: (p.path ? p.path + "/" : "") + row[1] + ".md",
      name: row[1], date: dt, sortKey: dt.getTime(),
      weekday: WEEKDAY[dt.getDay()], weekdayShort: WEEKDAY_SHORT[dt.getDay()],
      label: shortDate(dt), tasks: [], metrics: [], sectionOrder: [], openedAt: row[2]
    };
  });

  const counters = dayObjs.map(function () { return 0; });
  (p.tasks || []).forEach(function (r) {
    const d = dayObjs[r[0]];
    if (!d) return;
    const section = (p.sections || [])[r[1]] || "General";
    const state0 = statusOf(r[3]);
    const t = {
      title: r[2], key: normKey(r[2]), section: section, habitSection: isHabitSection(section),
      indent: r[8] || 0, order: counters[r[0]]++,
      isTask: r[3] != null, box: r[3], state: state0,
      done: state0 === "done", cancelled: state0 === "cancelled",
      start: r[4], end: r[5],
      duration: (r[4] != null && r[5] != null) ? ((r[5] - r[4] + 1440) % 1440) : 0,
      priority: r[6] || null,
      priorityName: r[6] ? PRIORITIES[r[6]].name : null,
      priorityRank: r[6] ? PRIORITIES[r[6]].rank : 0,
      recurring: !!r[7], doneDate: null, pages: r[11] == null ? null : r[11],
      link: r[9] ? { label: r[2], target: r[9], external: !!r[10] } : null,
      dayName: d.name, dayPath: d.path, date: d.date, weekdayShort: d.weekdayShort, sortKey: d.sortKey
    };
    if (d.sectionOrder.indexOf(section) < 0) d.sectionOrder.push(section);
    d.tasks.push(t);
  });

  (p.metrics || []).forEach(function (r) {
    (r[2] || []).forEach(function (v, di) {
      const d = dayObjs[di];
      if (!d) return;
      d.metrics.push({
        label: r[0], key: normKey(r[0]), kind: r[1], value: v,
        section: "Metrics", day: d.name, sortKey: d.sortKey, weekdayShort: d.weekdayShort
      });
    });
  });

  return dayObjs;
}

/* ---------------------------------------------------------------- aggregate */

function aggregate(days, palette, opts) {
  opts = opts || {};
  const minDays = opts.minRecurringDays || 2;
  const PAL = palette && palette.length ? palette : ["#6366f1"];

  const all = days.reduce(function (a, d) { return a.concat(d.tasks); }, []);
  const top = all.filter(function (t) { return t.indent === 0; });
  const subs = all.filter(function (t) { return t.indent > 0; });
  const doneTasks = top.filter(function (t) { return t.done; });
  const totalMin = top.reduce(function (s, t) { return s + t.duration; }, 0);
  const doneMin = doneTasks.reduce(function (s, t) { return s + t.duration; }, 0);

  const secMap = new Map();
  top.forEach(function (t) {
    if (!secMap.has(t.section))
      secMap.set(t.section, { name: t.section, count: 0, done: 0, cancelled: 0, minutes: 0, doneMinutes: 0, pages: 0, days: new Set() });
    const s = secMap.get(t.section);
    s.count++; s.minutes += t.duration; s.days.add(t.dayName);
    if (t.pages) s.pages += t.pages;
    if (t.done) { s.done++; s.doneMinutes += t.duration; }
    if (t.cancelled) s.cancelled++;
  });
  const sections = Array.from(secMap.values()).sort(function (a, b) {
    return (b.minutes - a.minutes) || (b.count - a.count) || a.name.localeCompare(b.name);
  });
  sections.forEach(function (s, i) { s.color = PAL[i % PAL.length]; s.dayCount = s.days.size; });
  const sectionColor = new Map(sections.map(function (s) { return [s.name, s.color]; }));

  /* Sections in the order they are written in the daily notes (first appearance
     wins), so the ledger can present them the way the notes read rather than
     by time spent.  Sections that never carried a top-level task are dropped. */
  const seen = [];
  days.forEach(function (d) {
    (d.sectionOrder || []).forEach(function (n) {
      if (secMap.has(n) && seen.indexOf(n) < 0) seen.push(n);
    });
  });
  top.forEach(function (t) { if (seen.indexOf(t.section) < 0) seen.push(t.section); });
  const sectionsInOrder = seen.map(function (n) { return secMap.get(n); });

  const perDay = days.map(function (d) {
    const t = d.tasks.filter(function (x) { return x.indent === 0; });
    const dn = t.filter(function (x) { return x.done; });
    return {
      day: d, total: t.length, done: dn.length,
      minutes: t.reduce(function (s, x) { return s + x.duration; }, 0),
      doneMinutes: dn.reduce(function (s, x) { return s + x.duration; }, 0),
      pages: t.reduce(function (s, x) { return s + (x.pages || 0); }, 0),
      blocks: t.filter(function (x) { return x.start != null && x.duration > 0; })
        .map(function (x) { return Object.assign({}, x, { color: sectionColor.get(x.section) }); })
    };
  });

  const byKey = new Map();
  top.forEach(function (t) {
    if (!t.key) return;
    if (!byKey.has(t.key))
      byKey.set(t.key, { key: t.key, title: t.title, section: t.section, items: [], marked: false, habitSection: false });
    const g = byKey.get(t.key);
    g.items.push(t);
    if (t.recurring) g.marked = true;
    if (t.habitSection) g.habitSection = true;
    if (t.title.length > g.title.length) g.title = t.title;
  });

  const habits = Array.from(byKey.values()).filter(function (g) {
    const dset = new Set(g.items.map(function (i) { return i.dayName; }));
    g.dayCount = dset.size;
    return g.marked || g.habitSection || dset.size >= minDays;
  }).map(function (g) {
    const cells = days.map(function (d) {
      const it = g.items.filter(function (i) { return i.dayName === d.name; });
      if (!it.length) return { state: "absent", day: d };
      if (it.some(function (i) { return i.done; })) return { state: "done", day: d, task: it[0] };
      if (it.some(function (i) { return i.cancelled; })) return { state: "cancelled", day: d, task: it[0] };
      return { state: "missed", day: d, task: it[0] };
    });
    const planned = cells.filter(function (c) { return c.state !== "absent"; }).length;
    const hit = cells.filter(function (c) { return c.state === "done"; }).length;
    let best = 0, run = 0, cur = 0;
    cells.forEach(function (c) {
      if (c.state === "done") { run++; if (run > best) best = run; }
      else if (c.state !== "absent") run = 0;
    });
    for (let i = cells.length - 1; i >= 0; i--) {
      if (cells[i].state === "done") cur++;
      else if (cells[i].state !== "absent") break;
    }
    return Object.assign({}, g, {
      cells: cells, planned: planned, hit: hit, rate: planned ? hit / planned : 0,
      best: best, cur: cur,
      minutes: g.items.reduce(function (s, i) { return s + i.duration; }, 0),
      color: sectionColor.get(g.section)
    });
  }).sort(function (a, b) {
    return (b.rate - a.rate) || (b.hit - a.hit) || (b.planned - a.planned) || a.title.localeCompare(b.title);
  });

  const mMap = new Map();
  days.forEach(function (d) {
    d.metrics.forEach(function (m) {
      if (!mMap.has(m.key))
        mMap.set(m.key, { key: m.key, label: m.label, kind: m.kind, total: 0, perDay: new Map(), best: 0 });
      const g = mMap.get(m.key);
      g.total += m.value;
      const v = (g.perDay.get(d.name) || 0) + m.value;
      g.perDay.set(d.name, v);
      if (v > g.best) g.best = v;
    });
  });
  const metrics = Array.from(mMap.values()).map(function (g, i) {
    return Object.assign({}, g, {
      color: PAL[i % PAL.length],
      active: days.filter(function (d) { return (g.perDay.get(d.name) || 0) > 0; }).length,
      avg: days.length ? g.total / days.length : 0,
      series: days.map(function (d) { return { day: d, value: g.perDay.get(d.name) || 0 }; })
    });
  });

  const priorities = Object.keys(PRIORITIES).map(function (k) {
    const items = top.filter(function (t) { return t.priority === k; });
    return {
      emoji: k, name: PRIORITIES[k].name, rank: PRIORITIES[k].rank, count: items.length,
      done: items.filter(function (t) { return t.done; }).length,
      minutes: items.reduce(function (s, t) { return s + t.duration; }, 0)
    };
  }).filter(function (p) { return p.count > 0; }).sort(function (a, b) { return b.rank - a.rank; });

  const heat = sections.map(function (s) {
    return {
      name: s.name, color: s.color,
      cells: days.map(function (d) {
        const t = d.tasks.filter(function (x) { return x.indent === 0 && x.section === s.name; });
        return {
          day: d, count: t.length,
          done: t.filter(function (x) { return x.done; }).length,
          minutes: t.reduce(function (a, x) { return a + x.duration; }, 0)
        };
      })
    };
  });
  let heatMax = 1;
  heat.forEach(function (r) { r.cells.forEach(function (c) { if (c.minutes > heatMax) heatMax = c.minutes; }); });

  const wake = days.filter(function (d) { return d.openedAt != null; })
    .map(function (d) { return { day: d, at: d.openedAt }; });

  const first = days.length ? days[0].date : null;
  const last = days.length ? days[days.length - 1].date : null;

  return {
    days: days, allTasks: all, top: top, subs: subs,
    totalTop: top.length, doneTop: doneTasks.length,
    cancelledTop: top.filter(function (t) { return t.cancelled; }).length,
    openTop: top.filter(function (t) { return !t.done && !t.cancelled; }).length,
    rate: pct(doneTasks.length, top.length),
    totalMin: totalMin, doneMin: doneMin,
    totalPages: top.reduce(function (s, t) { return s + (t.pages || 0); }, 0),
    sections: sections, sectionsInOrder: sectionsInOrder,
    sectionColor: sectionColor, perDay: perDay,
    habits: habits, metrics: metrics, priorities: priorities,
    heat: heat, heatMax: heatMax, wake: wake,
    avgWake: wake.length ? Math.round(wake.reduce(function (s, w) { return s + w.at; }, 0) / wake.length) : null,
    first: first, last: last,
    range: (first && last) ? (shortDate(first) + " \u2013 " + shortDate(last) + " " + last.getFullYear()) : ""
  };
}

/* ------------------------------------------------------------- vault access */

function folderAt(app, path) {
  const f = app.vault.getAbstractFileByPath(path);
  return (f && f.children) ? f : null;
}
function childFolders(folder) {
  if (!folder) return [];
  return folder.children.filter(function (c) { return !!c.children && c.name.charAt(0) !== "_"; })
    .sort(function (a, b) { return a.name.localeCompare(b.name, undefined, { numeric: true }); });
}
function childNotes(folder) {
  if (!folder) return [];
  return folder.children.filter(function (c) { return !c.children && /\.md$/i.test(c.name); })
    .sort(function (a, b) { return a.name.localeCompare(b.name); });
}

/* Read + parse every daily note in a week folder (skipping the report file). */
async function loadWeekFolder(app, folderPath) {
  const folder = folderAt(app, folderPath);
  const notes = childNotes(folder).filter(function (f) { return !/report|archive|snapshot/i.test(f.basename); });
  const days = [];
  for (let i = 0; i < notes.length; i++) {
    days.push(parseDaily(notes[i], await app.vault.cachedRead(notes[i])));
  }
  days.sort(function (a, b) { return (a.sortKey - b.sortKey) || a.name.localeCompare(b.name); });
  return days;
}

/* Pull the compact JSON payload out of a report note's text. */
function extractPayload(content) {
  const m = String(content).match(/```json\s*\n([\s\S]*?)\n```/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch (e) { return null; }
}

/* --------------------------------------------------------- report note text */

/* opts:  { theme, density, fullWidth }.  A bare string is still accepted as the
   theme, so older callers keep working. */
function buildReportNote(payload, data, libPath, opts) {
  if (typeof opts === "string") opts = { theme: opts };
  opts = opts || {};
  const L = [];
  L.push("---");
  L.push("type: weekly-report");
  L.push("week: " + payload.week);
  L.push("year: " + payload.year);
  L.push("month: " + payload.month);
  L.push("from: " + payload.from);
  L.push("to: " + payload.to);
  L.push("days_logged: " + data.days.length);
  L.push("tasks_total: " + data.totalTop);
  L.push("tasks_done: " + data.doneTop);
  L.push("tasks_open: " + data.openTop);
  L.push("completion: " + data.rate);
  L.push("minutes_scheduled: " + data.totalMin);
  L.push("minutes_completed: " + data.doneMin);
  L.push("pages_read: " + data.totalPages);
  L.push("sections: " + data.sections.length);
  L.push("recurring: " + data.habits.length);
  L.push("crunched: " + new Date().toISOString());
  L.push("---");
  L.push("");

  const args = [];
  if (opts.theme) args.push('theme="' + opts.theme + '"');
  if (opts.density) args.push('density="' + opts.density + '"');
  if (opts.fullWidth === false) args.push("fullWidth={false}");
  L.push("```datacorejsx");
  L.push('const { WeeklyReport } = await dc.require("' + libPath + '/tracker-report.jsx");');
  L.push("return function View() { return <WeeklyReport" +
    (args.length ? " " + args.join(" ") : "") + " />; };");
  L.push("```");
  L.push("");

  /* The payload rides inside an HTML comment: CommonMark treats everything up
     to the closing --> as a raw HTML block, so reading mode shows the report
     and nothing else, while extractPayload still finds the fence in the raw
     text.  JSON can never contain "-->", so the comment cannot close early. */
  L.push("<!--");
  L.push("```json");
  L.push(JSON.stringify(payload));
  L.push("```");
  L.push("-->");
  return L.join("\n");
}

/* Human-readable full archive, for anyone reading the file without Datacore. */
function buildMarkdownArchive(data, title) {
  const L = [];
  L.push("# " + title, "");
  L.push("> " + data.range + " · " + data.days.length + " days · " + data.doneTop + "/" + data.totalTop +
    " tasks (" + data.rate + "%) · " + hm(data.totalMin) + " scheduled, " + hm(data.doneMin) + " completed", "");
  L.push("## Sections", "");
  L.push("| Section | Tasks | Done | Rate | Scheduled | Completed |");
  L.push("|---|---:|---:|---:|---:|---:|");
  data.sections.forEach(function (s) {
    L.push("| " + s.name + " | " + s.count + " | " + s.done + " | " + pct(s.done, s.count) + "% | " +
      hm(s.minutes) + " | " + hm(s.doneMinutes) + " |");
  });
  L.push("");
  if (data.habits.length) {
    L.push("## Recurring", "");
    L.push("| Task | " + data.days.map(function (d) { return d.weekdayShort; }).join(" | ") + " | Done | Rate | Best |");
    L.push("|---|" + data.days.map(function () { return ":-:"; }).join("|") + "|---:|---:|---:|");
    data.habits.forEach(function (x) {
      L.push("| " + x.title + " | " + x.cells.map(function (c) {
        return c.state === "done" ? "x" : c.state === "missed" ? "o" : c.state === "cancelled" ? "-" : "·";
      }).join(" | ") + " | " + x.hit + "/" + x.planned + " | " + Math.round(x.rate * 100) + "% | " + x.best + " |");
    });
    L.push("");
  }
  if (data.metrics.length) {
    L.push("## Metrics", "");
    L.push("| Metric | Total | " + data.days.map(function (d) { return d.weekdayShort; }).join(" | ") + " |");
    L.push("|---|---:|" + data.days.map(function () { return "---:"; }).join("|") + "|");
    data.metrics.forEach(function (m) {
      L.push("| " + m.label + " | " + fmtMetric(m.kind, m.total) + " | " +
        m.series.map(function (s) { return fmtMetric(m.kind, s.value); }).join(" | ") + " |");
    });
    L.push("");
  }
  L.push("## Archive", "");
  data.days.forEach(function (d) {
    L.push("### " + d.weekday + " — " + d.name, "");
    if (d.openedAt != null) L.push("\u{1F6EB} " + clock(d.openedAt), "");
    let cur = null;
    d.tasks.forEach(function (t) {
      if (t.section !== cur) { cur = t.section; L.push("", "**" + cur + "**", ""); }
      L.push(taskRaw(t));
    });
    L.push("");
  });
  return L.join("\n");
}

return {
  WEEKDAY: WEEKDAY, WEEKDAY_SHORT: WEEKDAY_SHORT, MONTH_SHORT: MONTH_SHORT, MONTH_LONG: MONTH_LONG,
  PRIORITIES: PRIORITIES,
  normKey: normKey, stripInlineMarkup: stripInlineMarkup, statusOf: statusOf,
  isMetricSection: isMetricSection, isHabitSection: isHabitSection,
  hm: hm, clock: clock, fmtMetric: fmtMetric, pct: pct, iso: iso, shortDate: shortDate,
  ordinal: ordinal, isoWeek: isoWeek, isoWeekStart: isoWeekStart, resolveDate: resolveDate,
  parseDaily: parseDaily, taskRaw: taskRaw, aggregate: aggregate,
  encodeWeek: encodeWeek, decodeWeek: decodeWeek,
  folderAt: folderAt, childFolders: childFolders, childNotes: childNotes,
  loadWeekFolder: loadWeekFolder, extractPayload: extractPayload,
  buildReportNote: buildReportNote, buildMarkdownArchive: buildMarkdownArchive
};
