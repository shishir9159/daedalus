// ════════════════════════════════════════════════════════════════════════════
//  core.jsx  —  shared engine for the paper views
//  Location: Meta/Obsidian/_datacore/paper/core.jsx
//
//  What book/core.jsx is to the shelf, this is to the drawers, the
//  constellation, the pinboard and the contact sheet: the paper model, the two
//  designs, and the one stylesheet all four views paint themselves with.
//
//  NOTE 1: Datacore evaluates a required file as a function body, not an ES
//  module. Exports are the object returned at the bottom — `export` / `import`
//  are a syntax error here.
//
//  NOTE 2: everything is read from `app.metadataCache`, not from Datacore's
//  page objects. Inside a required module `dc.useCurrentFile()` resolves to the
//  module rather than to the note, which is why the fields came back empty in
//  the book views; reading the cache also means an edit shows up immediately
//  instead of waiting for a reindex.
//
//  ── THE TWO DESIGNS ───────────────────────────────────────────────────────
//  `design` is the whole piece of furniture, and it is MANDATORY — every view
//  in this folder refuses to guess. Two are built:
//
//    "medieval"    the scriptorium. Gold on soaked brown, Cinzel over EB
//                  Garamond, and a paper leaf with a torn deckle edge.
//    "art deco"    the archive. Navy and brass, Limelight over Jost, and the
//                  stepped corners, bead rules and fan that come with it.
//
//  The deco ornaments are the design's own SVGs, inlined as CSS variables. The
//  scriptorium's torn edge is NOT: the study used a 100 KB photographic alpha
//  mask per sheet, which has no business living inside a note. The same edge is
//  generated here with one feTurbulence displacement, which costs about 400
//  bytes and rescales cleanly — see --pv-deckle.
//
//  ── WHERE THE DATA COMES FROM ─────────────────────────────────────────────
//  The same frontmatter the paper infobox reads, so a note written for one is
//  already written for the other:
//
//    author / authors · affiliation · venue · venue-kind · year · published
//    citations · claim (or blurb / abstract) · tier · status · pages ·
//    progress · coverage · highlights · paper (or pdf) · figure · arxiv · doi
//
//  Topics are the note's TAGS minus the ones that only say what kind of note it
//  is, exactly as in the infobox — there is no `topics:` key to keep in sync.
//
//  Relations are the LISTS the infobox already documents: builds-on, extends,
//  compare-with, refutes, superseded-by, prereq and the unqualified `related`.
//  They are what the constellation draws its edges from and what every reading
//  panel lists under RELATED. A relation left in the template but not filled in
//  arrives as [""], and is treated as absent.
//
//  NOTE: never declare a local named `h` in this file — it is the JSX pragma.
// ════════════════════════════════════════════════════════════════════════════

const pdf = await dc.require("Meta/Obsidian/_datacore/pdf/pdf.jsx");
// The layout hooks are the shelf's, not copies of them. useFitHeight in
// particular encodes a real Obsidian bug (section recycling resetting scroll)
// and having two versions of that answer drift apart is how it comes back.
const shared = await dc.require("Meta/Obsidian/_datacore/book/core.jsx");

const { resolvePdf, parseLink, usePageImage, useCitations, writeFields, openAt } = pdf;
const { clamp, hashOf, baseName, isIgnored, useFitHeight, useEdgeScroll } = shared;

// ════════════════════════════════════════════════════════════════════════════
//  Designs
// ════════════════════════════════════════════════════════════════════════════
const DESIGNS = ["medieval", "art deco"];

/**
 * Which design, as a class name. Mandatory on purpose: the two are different
 * enough that a default is a decision made on your behalf, and a typo that
 * silently lands on the medieval one is worse than a line of red text.
 */
function designClass(design, where = "this view") {
  const d = String(design ?? "").toLowerCase().trim();
  if (d === "art deco" || d === "deco" || d === "artdeco") return "deco";
  if (d === "medieval" || d === "scriptorium") return "medieval";
  throw new Error(
    `${where}: design is required — pass design="medieval" or design="art deco"`
  );
}

/** Rendered instead of the view when `design` is missing or misspelt. */
function DesignError({ error }) {
  return (
    <div class="pv-fault">
      <b>Paper view</b> — {String(error?.message ?? error)}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  The paper model
// ════════════════════════════════════════════════════════════════════════════
/** Tags that describe the note's type rather than its subject. */
const NON_TOPIC_TAGS = new Set([
  "paper", "papers", "book", "note", "notes", "literature", "reading",
]);

const TIER_RANK = {
  "S+++": 0, "S++": 1, "S+": 2, S: 3, "A+": 4, A: 5,
  "B+": 6, B: 7, C: 8, D: 9, F: 10,
};

const READING = ["reading", "skimming"];
const UPCOMING = ["planned", "to-read", "backlog", "next", "queued", "unread"];
const DONE = ["completed", "finished", "read", "done", "skimmed"];

/**
 * The filename is the title; anything after a colon is the subtitle.
 *
 * Obsidian will not put ":" in a filename on Windows, so a real vault writes
 * the break as " - " or an em dash instead — all three are accepted. This is
 * the infobox's rule, repeated so a paper's heading is the same word in every
 * view rather than the filename in one and `title:` in another.
 */
function splitTitle(name) {
  const m = String(name ?? "").match(/^(.*?)\s*(?::|\s[—–-]\s)\s*(.+)$/);
  return m ? { title: m[1].trim(), sub: m[2].trim() } : { title: String(name ?? ""), sub: null };
}

const num = (v) =>
  typeof v === "number" ? v
    : v == null ? null
      : Number(String(v).replace(/[^0-9.]/g, "")) || null;

/** 188791 → "188.8k". Counts on a card are a sense of scale, not a figure. */
const compact = (n) =>
  n == null ? null
    : n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M"
      : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, "") + "k"
        : String(n);

/** Frontmatter value, with Datacore's wrapper unwrapped and blanks nulled. */
const fmGet = (fm, k) => {
  const v = fm?.[k];
  if (v == null || v === "") return null;
  return v?.value !== undefined ? v.value : v;
};

/** A frontmatter list, flattened to display strings, blanks dropped. */
const listOf = (v) =>
  [].concat(v ?? [])
    .map((x) => String(x?.display ?? x ?? "").replace(/\[\[|\]\]/g, "").trim())
    .map((s) => (s.includes("|") ? s.split("|").pop().trim() : s))
    .filter(Boolean);

/** "R. Aiyer, M. Solberg, T. Okonkwo" — capped, with a tail count. */
function authorLine(authors, cap = 3) {
  if (!authors.length) return "";
  if (authors.length <= cap) return authors.join(", ");
  return authors.slice(0, cap).join(", ") + " +" + (authors.length - cap);
}

/** "Vaswani et al." — the short form a node label or a pin can carry. */
function firstAuthor(authors) {
  if (!authors.length) return "";
  const last = authors[0].trim().split(/\s+/).pop();
  return last + (authors.length > 1 ? " et al." : "");
}

const RELATIONS = [
  ["builds on", "builds-on", "cites"],
  ["extends", "extends", "cites"],
  ["compare", "compare-with", "peer"],
  ["refutes", "refutes", "cites"],
  ["superseded by", "superseded-by", "cited-by"],
  ["prereq", "prereq", "cites"],
  ["related", "related", "peer"],
];

/**
 * One paper, read straight out of the metadata cache.
 *
 * `rev` is Datacore's index counter: it is in the dependency list so a paper
 * whose frontmatter you just edited re-reads itself, and nothing else does.
 */
function readPaper(path, rev, collectedBy = null) {
  const cache = app.metadataCache.getCache(path) ?? {};
  const fm = cache.frontmatter ?? {};
  const get = (k) => fmGet(fm, k);

  const name = baseName(path);
  const heading = splitTitle(name);

  const authors = listOf(get("author") ?? get("authors"));
  const affiliation = listOf(get("affiliation"));

  const pages = num(get("pages")) ?? 0;
  const progress = num(get("progress")) ?? 0;
  const status = String(get("status") ?? "").toLowerCase().trim();
  const done =
    get("completed") === true ? true
      : get("completed") === false ? false
        : DONE.includes(status) || (pages > 0 && progress >= pages);

  const published = get("published");
  const year = num(get("year")) ??
    (published ? new Date(String(published)).getFullYear() : null);

  const tags = Array.from(new Set(
    [
      ...(cache.tags ?? []).map((t) => t?.tag),
      ...[].concat(fm.tags ?? fm.tag ?? []),
    ]
      .map((t) => String(t ?? "").replace(/^#/, "").trim())
      .filter(Boolean)
  ));
  /**
   * A topic is a tag that says something about the paper.
   *
   * Two kinds do not. The first says what kind of note this is (#paper and
   * friends). The second is whatever you collected on: point a view at
   * tag={["transformer"]} and every paper in it carries #transformer, so
   * grouping by it yields exactly one drawer holding everything. The tag you
   * searched for is the one tag guaranteed to carry no information.
   */
  const topics = tags.filter((t) => {
    const k = t.toLowerCase();
    return !NON_TOPIC_TAGS.has(k) && !collectedBy?.has(k);
  });

  // Every relation, resolved to a note path where the target exists. Kept as
  // paths rather than labels so the constellation can join them up and a
  // RELATED row can open the right file.
  // pdf.jsx's parseLink hands back a link TARGET as a plain string — "[[A|B]]"
  // becomes "A" — not a {path,display} object. A bare string that is not a
  // wikilink comes back as itself, so `related: Layer Normalization` resolves
  // as well as `related: "[[Layer Normalization]]"` does.
  const relations = [];
  for (const [label, key, kind] of RELATIONS) {
    for (const raw of [].concat(get(key) ?? [])) {
      const target = parseLink(raw);
      if (!target) continue;
      const dest = app.metadataCache.getFirstLinkpathDest(target, path);
      relations.push({
        label, key, kind,
        path: dest?.path ?? null,
        name: baseName(dest?.path ?? target),
      });
    }
  }

  return {
    id: path,
    path,
    name,
    title: heading.title,
    sub: get("subtitle") ?? heading.sub,
    authors,
    authorLine: authorLine(authors),
    authorsFull: authors.join(", "),
    first: firstAuthor(authors),
    affiliation,
    affiliationLine: affiliation.join(" · "),
    venue: String(get("venue") ?? get("conference") ?? get("journal") ?? "") || null,
    venueKind: get("venue-kind"),
    year,
    published,
    cites: num(get("citations")),
    abstract: String(get("claim") ?? get("blurb") ?? get("abstract") ?? "") || null,
    tier: get("tier"),
    tierRank: TIER_RANK[get("tier")] ?? 99,
    status,
    done,
    pages,
    progress,
    pct: pages > 0 ? clamp(0, progress / pages, 1) : (done ? 1 : 0),
    coverage: num(get("coverage")),
    highlights: num(get("highlights")),
    tags,
    topics,
    topic: topics[0] ?? "untagged",
    figure: num(get("figure")) ?? 1,
    arxiv: String(get("arxiv") ?? "").replace(/^arxiv:\s*/i, "") || null,
    doi: get("doi"),
    code: get("code"),
    blog: get("blog"),
    site: get("site"),
    course: get("course"),
    relations,
    // resolved lazily by the panel that actually rasterises a page
    pdfLink: get("paper") ?? get("pdf") ?? get("title"),
    mtime: app.vault.getAbstractFileByPath(path)?.stat?.mtime ?? null,
    _rev: rev,
  };
}

/**
 * Every paper in the vault that carries `tag`, as models.
 *
 * `tag` takes one tag or several, exactly as <Shelves> does:
 *
 *     <Drawers design="medieval" tag={["paper"]} />
 *     <ContactSheet design="art deco" tag={["paper", "preprint"]} />
 *     <Pinboard design="medieval" tag="transformer" folder="Papers/NLP" />
 *
 * Several tags are OR'd, a leading # is optional, and `folder` narrows the
 * result to one subtree. Whatever you collected on is then dropped from every
 * paper's topics — see readPaper — because a tag they all share cannot tell
 * them apart.
 *
 * Notes under Meta/Obsidian/Templates/ are never collected (IGNORE_PATHS).
 */
function usePapers({ tag = "paper", folder = null } = {}) {
  const tags = [].concat(tag).map((t) => String(t).trim().replace(/^#/, "")).filter(Boolean);
  const query = tags.length
    ? `@page and (${tags.map((t) => `#${t}`).join(" or ")})`
    : "@page and #paper";
  const all = dc.useQuery(query);
  const rev = dc.useIndexUpdates();

  // A fresh array every render would re-read every paper every render, so the
  // dependency is the joined string and the Set is rebuilt only when it moves.
  const tagKey = tags.join(" ").toLowerCase();

  return dc.useMemo(() => {
    const collectedBy = new Set(tagKey ? tagKey.split(" ") : []);
    const inFolder = (p) =>
      !folder || p === folder || p.startsWith(String(folder).replace(/\/?$/, "/"));
    return (all ?? [])
      .map((p) => p.$path)
      .filter((p) => p && !isIgnored(p) && inFolder(p))
      .map((p) => readPaper(p, rev, collectedBy));
  }, [all, rev, folder, tagKey]);
}

/** id → paper, for the many places that hold an id and want the record. */
const indexBy = (papers) => {
  const by = {};
  for (const p of papers) by[p.id] = p;
  return by;
};

// ── grouping ────────────────────────────────────────────────────────────────
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

const GROUPERS = {
  topic: (p) => p.topic,
  venue: (p) => p.venue ?? "unpublished",
  year: (p) => (p.year == null ? "undated" : String(p.year)),
  status: (p) => p.status || "unfiled",
  tier: (p) => p.tier ?? "unrated",
};

/**
 * Papers, in drawers.
 *
 * A drawer is a topic by default, because a topic is the one grouping that is
 * already written down — the tags are on the notes. `order` is how the drawers
 * themselves are stacked: "count" puts the fat ones at the top, "name" is
 * alphabetical, "recent" floats whatever you have touched most recently.
 */
function useDrawers(papers, { groupBy = "topic", order = "count", sort = "year" } = {}) {
  return dc.useMemo(() => {
    const key = GROUPERS[groupBy] ?? GROUPERS.topic;
    const bins = new Map();
    for (const p of papers) {
      const k = key(p) || "unfiled";
      if (!bins.has(k)) bins.set(k, []);
      bins.get(k).push(p);
    }

    const inside =
      sort === "cited" ? (a, b) => (b.cites ?? 0) - (a.cites ?? 0) || a.title.localeCompare(b.title)
        : sort === "tier" ? (a, b) => a.tierRank - b.tierRank || a.title.localeCompare(b.title)
          : sort === "title" ? (a, b) => a.title.localeCompare(b.title)
            : (a, b) => (b.year ?? 0) - (a.year ?? 0) || a.title.localeCompare(b.title);

    let out = Array.from(bins, ([label, list]) => ({
      id: "drawer:" + label,
      label,
      tag: "#" + String(label).replace(/\s+/g, "-").toLowerCase(),
      papers: list.slice().sort(inside),
      newest: Math.max(0, ...list.map((p) => p.mtime ?? 0)),
    }));

    out.sort(
      order === "name" ? (a, b) => a.label.localeCompare(b.label)
        : order === "recent" ? (a, b) => b.newest - a.newest
          : (a, b) => b.papers.length - a.papers.length || a.label.localeCompare(b.label)
    );

    return out.map((d, i) => ({
      ...d,
      numeral: ROMAN[i] ?? String(i + 1),
      idx: String(i + 1).padStart(2, "0"),
      total: d.papers.length,
    }));
  }, [papers, groupBy, order, sort]);
}

/**
 * What is waiting to be read, newest first.
 *
 * The queue in the drawers view starts here rather than empty: an unread paper
 * is one you have not marked done and have not started, which is the same
 * question the shelf's "Someday" shelf asks.
 */
const unreadOf = (papers, cap = 8) =>
  papers
    .filter((p) => !p.done && (!p.status || UPCOMING.includes(p.status)) && p.progress === 0)
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || a.title.localeCompare(b.title))
    .slice(0, cap)
    .map((p) => p.id);

/**
 * The papers to show beside this one.
 *
 * Declared relations first — you wrote those down, so they outrank anything
 * inferred — then papers sharing a topic, then the rest of the same drawer.
 */
function relatedTo(paper, papers, byId, cap = 3) {
  if (!paper) return [];
  const out = [], seen = new Set([paper.id]);
  const push = (p, why) => {
    if (!p || seen.has(p.id) || out.length >= cap) return;
    seen.add(p.id);
    out.push({ paper: p, why });
  };
  for (const r of paper.relations) push(r.path ? byId[r.path] : null, r.label);
  for (const p of papers) {
    if (out.length >= cap) break;
    if (p.topics.some((t) => paper.topics.includes(t))) push(p, "same topic");
  }
  for (const p of papers) {
    if (out.length >= cap) break;
    if (p.topic === paper.topic) push(p, "same drawer");
  }
  return out;
}

/**
 * Citation edges for the constellation.
 *
 * `mode` "links" draws only what you declared. "all" adds, inside each topic,
 * an edge from every paper to the next-older one in the same topic — a
 * reading-order thread rather than a citation, which is why it is drawn
 * thinner and lighter. A vault with no relations filled in is still a picture
 * under "all", and an honest blank under "links".
 */
function edgesOf(papers, byId, mode = "all") {
  const out = [], seen = new Set();
  const add = (from, to, kind) => {
    if (!from || !to || from === to) return;
    const key = from < to ? `${from}|${to}|${kind}` : `${to}|${from}|${kind}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ from, to, kind });
  };

  for (const p of papers) {
    for (const r of p.relations) {
      if (!r.path || !byId[r.path]) continue;
      add(p.id, r.path, r.kind === "peer" ? "peer" : "cite");
    }
  }

  if (mode === "all") {
    const bins = new Map();
    for (const p of papers) {
      if (!bins.has(p.topic)) bins.set(p.topic, []);
      bins.get(p.topic).push(p);
    }
    for (const list of bins.values()) {
      const byYear = list.slice().sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
      for (let i = 1; i < byYear.length; i++) add(byYear[i].id, byYear[i - 1].id, "thread");
    }
  }
  return out;
}

// ════════════════════════════════════════════════════════════════════════════
//  Pieces every view shares
// ════════════════════════════════════════════════════════════════════════════
/**
 * How far through a paper you are, as a ring.
 *
 * A paper is read out of order, so this is deliberately coarse: the arc is
 * `progress / pages`, and a paper with no page count reads as empty rather
 * than as full.
 */
function Pip({ paper, size = 12 }) {
  const pct = Math.round((paper?.pct ?? 0) * 100);
  return (
    <span
      class="pv-pip"
      style={{ "--pip": `${size}px`, "--pct": `${pct}%` }}
      title={paper?.pages ? `page ${paper.progress} of ${paper.pages}` : "not started"}
    />
  );
}

/**
 * The first page of the PDF, rasterised.
 *
 * This is the panel the study drew as "first page — drop image": there is
 * nothing to drop, because the paper is already in the vault. `figure:` says
 * which page is worth showing — most papers want 1, some want the page with
 * the architecture diagram on it.
 *
 * pdf.js is a bonus, never a gate. Obsidian only publishes it once its own PDF
 * view has been built, so a fresh session may have no picture at first; the
 * panel opens the PDF either way and the image appears by itself the moment
 * any PDF is opened anywhere.
 */
function PageSheet({ paper, width = 420, page = null, className = "" }) {
  const file = dc.useMemo(
    () => resolvePdf(paper?.pdfLink, paper?.path),
    [paper?.path, paper?.pdfLink]
  );
  const at = page ?? paper?.figure ?? 1;
  const img = usePageImage(file, at, Math.round(width * 1.6));

  return (
    <div
      class={"pv-sheet " + className + (file ? " is-openable" : "")}
      role={file ? "button" : undefined}
      tabIndex={file ? 0 : undefined}
      title={file ? `${file.name} — page ${at}` : "no `paper:` link"}
      onClick={file ? (e) => { e.stopPropagation(); openAt(file, at, paper.path, e); } : undefined}
      onKeyDown={file
        ? (e) => (e.key === "Enter" || e.key === " ") && openAt(file, at, paper.path, e)
        : undefined}
    >
      {img.url
        ? <img src={img.url} alt="" draggable={false} decoding="async" />
        : <span class="pv-sheet-wait">{!file ? "no PDF" : img.ready ? "rendering…" : "waiting for pdf.js"}</span>}
    </div>
  );
}

/**
 * Open the note itself. Ctrl/Cmd puts it in a new tab, as everywhere else.
 *
 * Nothing in these views calls this any more: a click on a paper goes to the
 * PDF, and only to the PDF. Kept because it is the obvious thing a view built
 * on top of this module will want, and it is four lines.
 */
const openNote = (paper, evt) => {
  if (!paper?.path) return;
  evt?.preventDefault?.();
  evt?.stopPropagation?.();
  app.workspace.openLinkText(paper.path, paper.path, !!(evt && (evt.ctrlKey || evt.metaKey)));
};

/**
 * The rows in a reading panel's margin.
 *
 * There is no CITATION row. "M. Thorne et al., arXiv 2025" is the heading of
 * the panel restated in smaller type — everything in it is already on screen
 * an inch above. What is worth a row is the count, because that is the one
 * number about a paper you cannot get by looking at it.
 */
function fieldsOf(paper) {
  if (!paper) return [];
  const rows = [
    ["AUTHORS", paper.authorsFull || null],
    ["AFFILIATION", paper.affiliationLine || null],
    ["VENUE", paper.venue ? paper.venue + (paper.year ? ` ${paper.year}` : "") : null],
    ["CITED BY", paper.cites == null ? null : `${compact(paper.cites)} citations`],
    ["TIER", paper.tier ?? null],
    ["STATUS", paper.status || null],
  ];
  return rows.filter((r) => r[1]).map(([label, value]) => ({ label, value }));
}

/** "NEURIPS · 2023 · 412" — the one line a card has room for. */
const footOf = (paper) =>
  [
    paper.venue ? paper.venue.toUpperCase() : null,
    paper.year ?? null,
    paper.cites == null ? null : compact(paper.cites),
  ].filter((x) => x != null).join(" · ");

// ════════════════════════════════════════════════════════════════════════════
//  <Styles /> — injected once into <head>, replaced in place when edited.
//  Every selector is namespaced under .pv-, so nothing here can reach a plain
//  <img> or any other element in your notes.
// ════════════════════════════════════════════════════════════════════════════
const STYLE_ID = "paper-view-datacore-styles";

/**
 * The design's typefaces, from Google Fonts.
 *
 * Optional and off a separate <link>, so a vault that runs offline — or one
 * that would rather not talk to fonts.googleapis.com — passes webfonts={false}
 * and falls back through the stacks in --pv-display / --pv-body / --pv-mono.
 * Every one of those ends in a face that ships with the OS.
 */
const FONTS_ID = "paper-view-datacore-fonts";
const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600" +
  "&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400" +
  "&family=IBM+Plex+Mono:wght@400;500&family=Jost:wght@300;400;500" +
  "&family=Limelight&family=Federo&display=swap";

const CSS = `
/* ── the case ─────────────────────────────────────────────────────────── */
.pv {
  position: relative; display: flex; flex-direction: column;
  border-radius: 3px; overflow: hidden;
  box-shadow: 0 3px 18px rgba(0,0,0,.34);
  color: var(--pv-cream);
  font-family: var(--pv-body);
  --pv-scale: 1;
  /* A torn deckle edge, generated. One fractal-noise displacement over a
     plain rectangle: the mask is ~400 bytes, rescales with the leaf, and can
     be re-seeded per sheet by swapping the seed in the filter. */
  --pv-deckle: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='250' viewBox='0 0 200 250'%3E%3Cfilter id='d' x='-10%25' y='-10%25' width='120%25' height='120%25'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.024' numOctaves='4' seed='7' result='n'/%3E%3CfeDisplacementMap in='SourceGraphic' in2='n' scale='13' xChannelSelector='R' yChannelSelector='G'/%3E%3C/filter%3E%3Crect x='8' y='8' width='184' height='234' fill='%23fff' filter='url(%23d)'/%3E%3C/svg%3E");
  --pv-deckle-roll: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='250' viewBox='0 0 200 250'%3E%3Cfilter id='d' x='-10%25' y='-10%25' width='120%25' height='120%25'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.028' numOctaves='4' seed='19' result='n'/%3E%3CfeDisplacementMap in='SourceGraphic' in2='n' scale='9' xChannelSelector='R' yChannelSelector='G'/%3E%3C/filter%3E%3Cg filter='url(%23d)'%3E%3Crect x='6' y='26' width='188' height='216' fill='%23fff'/%3E%3C/g%3E%3Crect x='4' y='14' width='192' height='22' rx='11' fill='%23fff'/%3E%3C/svg%3E");
}
/* full-bleed: the note gives up the readable-line-width and its other blocks
   step aside, exactly as .hcs.is-full does for the shelf. Without these the
   view is a small box in the middle of a column with its own little scrollbar,
   which is not what "takes over the window" means.
   --pv-vh is measured off the real pane by useFitHeight; the vh is a fallback
   for the frame before that lands. */
.markdown-preview-sizer:has(.pv.is-full),
.cm-sizer:has(.pv.is-full) {
  max-width: none !important; width: 100% !important;
  padding-left: 20px !important; padding-right: 20px !important;
}
.markdown-preview-sizer:has(.pv.is-full) > *:not(:has(.pv.is-full)):not(.markdown-preview-pusher),
.cm-sizer:has(.pv.is-full) > *:not(:has(.pv.is-full)) { display: none !important; }

.pv.is-full { height: var(--pv-vh, 82vh); }
.pv:not(.is-full) { height: var(--pv-h, 760px); }

.pv.medieval {
  --pv-display: Cinzel, Georgia, 'Times New Roman', serif;
  --pv-body: 'EB Garamond', Georgia, 'Times New Roman', serif;
  --pv-mono: 'IBM Plex Mono', 'SF Mono', Consolas, monospace;
  --pv-gold: #d9b96e;
  --pv-gold-dim: rgba(217,185,110,.55);
  --pv-line: rgba(198,158,86,.28);
  --pv-line-soft: rgba(198,158,86,.16);
  --pv-cream: #f0e0c4;
  --pv-cream-dim: rgba(240,224,196,.62);
  --pv-accent: #8d2f26;
  --pv-ink: #2a1d10;
  --pv-paper: linear-gradient(178deg,#f6ecd3,#e9dcbd);
  --pv-paper-flat: #f3e6c8;
  --pv-case: radial-gradient(120% 80% at 50% -10%,#2e2119 0%,#160f0b 100%);
  --pv-head: linear-gradient(180deg,#2b1f16,#211710);
  --pv-well: linear-gradient(180deg,#0d0906 0%,#1a120c 10%,#241a12 100%);
  --pv-front: linear-gradient(178deg,#3c2717,#2a1a0d);
  --pv-track: rgba(42,29,16,.2);
  --pv-veil: rgba(16,10,6,.62);
  --pv-tab: .1em;
}
.pv.deco {
  --pv-display: Limelight, 'Park Lane NF', Georgia, serif;
  --pv-body: Jost, Semplicita, Optima, 'Gill Sans', 'Segoe UI', sans-serif;
  --pv-mono: Federo, 'Gill Sans', 'Segoe UI', sans-serif;
  --pv-gold: #e3c24a;
  --pv-gold-dim: rgba(227,194,74,.55);
  --pv-line: rgba(227,194,74,.42);
  --pv-line-soft: rgba(227,194,74,.18);
  --pv-cream: #f0e9d8;
  --pv-cream-dim: rgba(240,233,216,.62);
  --pv-accent: #e3c24a;
  --pv-ink: #16154a;
  --pv-paper: linear-gradient(178deg,#f4eedd,#e7dfc4);
  --pv-paper-flat: #f4eedd;
  --pv-case: radial-gradient(120% 90% at 50% -20%,#1b1a3f 0%,#0b0a1a 100%);
  --pv-head: none;
  --pv-well: #0a0918;
  --pv-front: linear-gradient(178deg,#1a1940,#141330);
  --pv-track: rgba(227,194,74,.18);
  --pv-veil: rgba(10,9,24,.7);
  --pv-tab: .2em;
  --ad-tl:url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' version='1.1' xml:space='preserve' xmlns='http://www.w3.org/2000/svg' xmlns:svg='http://www.w3.org/2000/svg'%3E%3Cg transform='translate(-40.612917,-83.589496)'%3E%3Cg transform='matrix(-0.30334715,0,0,0.30338915,92.930632,58.413673)' style='fill:none;stroke:%23000000;stroke-width:1.7443;'%3E%3Cpath d='M 171.59602,116.47005 A 32.748245,32.748245 0 0 1 138.84811,83.879621' /%3E%3Cpath d='M 171.61279,121.24895 A 37.527149,37.527149 0 0 1 134.06919,83.8863' /%3E%3Cpath d='m 40.612917,89.673823 125.163343,-10e-7 V 214.83716' /%3E%3Cpath d='M 154.16388,83.854096 V 101.28619 H 128.32241' /%3E%3Cpath d='m 84.85534,89.673823 v 4.818481 h 50.79229' /%3E%3Cpath d='M 171.59598,149.44348 V 83.854099 l -65.58938,-1e-6' /%3E%3Cpath d='m 171.59598,101.2862 h -17.43209 v 25.84147' /%3E%3Cpath d='m 165.77626,170.59474 h -4.81848 v -50.79229' /%3E%3C/g%3E%3C/g%3E%3C/svg%3E%0A");
  --ad-tr:url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' version='1.1' xml:space='preserve' xmlns='http://www.w3.org/2000/svg' xmlns:svg='http://www.w3.org/2000/svg'%3E%3Cg transform='translate(-40.612917,-83.589496)'%3E%3Cg transform='matrix(0.30334715,0,0,0.30338915,28.293104,58.413673)' style='fill:none;stroke:%23000000;stroke-width:1.7443;'%3E%3Cpath d='M 171.59602,116.47005 A 32.748245,32.748245 0 0 1 138.84811,83.879621' /%3E%3Cpath d='M 171.61279,121.24895 A 37.527149,37.527149 0 0 1 134.06919,83.8863' /%3E%3Cpath d='m 40.612917,89.673823 125.163343,-10e-7 V 214.83716' /%3E%3Cpath d='M 154.16388,83.854096 V 101.28619 H 128.32241' /%3E%3Cpath d='m 84.85534,89.673823 v 4.818481 h 50.79229' /%3E%3Cpath d='M 171.59598,149.44348 V 83.854099 l -65.58938,-1e-6' /%3E%3Cpath d='m 171.59598,101.2862 h -17.43209 v 25.84147' /%3E%3Cpath d='m 165.77626,170.59474 h -4.81848 v -50.79229' /%3E%3C/g%3E%3C/g%3E%3C/svg%3E%0A");
  --ad-bl:url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' version='1.1' xml:space='preserve' xmlns='http://www.w3.org/2000/svg' xmlns:svg='http://www.w3.org/2000/svg'%3E%3Cg transform='translate(-40.612917,-83.589496)'%3E%3Cg transform='matrix(-0.30334715,0,0,-0.30338915,92.930632,148.76876)' style='fill:none;stroke:%23000000;stroke-width:1.7443;'%3E%3Cpath d='M 171.59602,116.47005 A 32.748245,32.748245 0 0 1 138.84811,83.879621' /%3E%3Cpath d='M 171.61279,121.24895 A 37.527149,37.527149 0 0 1 134.06919,83.8863' /%3E%3Cpath d='m 40.612917,89.673823 125.163343,-10e-7 V 214.83716' /%3E%3Cpath d='M 154.16388,83.854096 V 101.28619 H 128.32241' /%3E%3Cpath d='m 84.85534,89.673823 v 4.818481 h 50.79229' /%3E%3Cpath d='M 171.59598,149.44348 V 83.854099 l -65.58938,-1e-6' /%3E%3Cpath d='m 171.59598,101.2862 h -17.43209 v 25.84147' /%3E%3Cpath d='m 165.77626,170.59474 h -4.81848 v -50.79229' /%3E%3C/g%3E%3C/g%3E%3C/svg%3E%0A");
  --ad-br:url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' version='1.1' xml:space='preserve' xmlns='http://www.w3.org/2000/svg' xmlns:svg='http://www.w3.org/2000/svg'%3E%3Cg transform='translate(-40.612917,-83.589496)'%3E%3Cg transform='matrix(0.30334715,0,0,-0.30338915,28.293104,148.76876)' style='fill:none;stroke:%23000000;stroke-width:1.7443;'%3E%3Cpath d='M 171.59602,116.47005 A 32.748245,32.748245 0 0 1 138.84811,83.879621' /%3E%3Cpath d='M 171.61279,121.24895 A 37.527149,37.527149 0 0 1 134.06919,83.8863' /%3E%3Cpath d='m 40.612917,89.673823 125.163343,-10e-7 V 214.83716' /%3E%3Cpath d='M 154.16388,83.854096 V 101.28619 H 128.32241' /%3E%3Cpath d='m 84.85534,89.673823 v 4.818481 h 50.79229' /%3E%3Cpath d='M 171.59598,149.44348 V 83.854099 l -65.58938,-1e-6' /%3E%3Cpath d='m 171.59598,101.2862 h -17.43209 v 25.84147' /%3E%3Cpath d='m 165.77626,170.59474 h -4.81848 v -50.79229' /%3E%3C/g%3E%3C/g%3E%3C/svg%3E%0A");
  --ad-hrl:url("data:image/svg+xml,%0A%3Csvg width='9.624218mm' height='2.7450519mm' viewBox='0 0 9.624218 2.7450517' version='1.1' xml:space='preserve' xmlns='http://www.w3.org/2000/svg' xmlns:svg='http://www.w3.org/2000/svg'%3E%3Cg transform='translate(-39.117826,-11.26231)' style='fill:%23000000'%3E%3Ccircle cx='47.369518' cy='12.634836' r='1.3725259' /%3E%3Ccircle cx='44.282711' cy='12.634836' r='1.0417968' /%3E%3Ccircle cx='41.758148' cy='12.634836' r='0.8102864' /%3E%3Ccircle cx='39.696602' cy='12.634836' r='0.578776' /%3E%3C/g%3E%3C/svg%3E%0A");
  --ad-hrr:url("data:image/svg+xml,%0A%3Csvg width='9.624218mm' height='2.7450519mm' viewBox='0 0 9.624218 2.7450517' version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:svg='http://www.w3.org/2000/svg'%3E%3Cg transform='translate(-39.117826,-11.26231)' style='fill:%23000000'%3E%3Cg transform='scale(-1,1)'%3E%3Ccircle cx='-40.490353' cy='12.634836' r='1.3725259' /%3E%3Ccircle cx='-43.57716' cy='12.634836' r='1.0417968' /%3E%3Ccircle cx='-46.101723' cy='12.634836' r='0.8102864'/%3E%3Ccircle cx='-48.163269' cy='12.634836' r='0.578776' /%3E%3C/g%3E%3C/g%3E%3C/svg%3E%0A");
  --ad-fan:url("data:image/svg+xml,%0A%3Csvg width='13.533353mm' height='13.665177mm' viewBox='0 0 13.533353 13.665177' version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:svg='http://www.w3.org/2000/svg'%3E%3Cg transform='translate(-86.292633,-113.41824)'%3E%3Cg style='fill:none;stroke:%23000000;stroke-width:0.264999;'%3E%3Cpath d='m 93.059653,127.08343 a 6.766336,6.766336 0 0 1 6.766336,-6.76634' /%3E%3Cpath d='m 86.293106,120.31709 a 6.766336,6.766336 0 0 1 6.766336,6.76634' /%3E%3Cpath d='m 86.29772,120.31709 a 6.766336,6.766336 0 0 1 6.766336,-6.76633 6.766336,6.766336 0 0 1 6.766336,6.76633' /%3E%3Cpath d='m 93.059874,127.1504 c -0.01,-1.5182 0.319616,-3.03719 0.987396,-4.44032 1.087733,-2.28553 2.979917,-4.06856 5.289083,-5.02655' /%3E%3Cpath d='m 93.059133,127.15011 c -0.01822,-4.33881 1.731996,-8.53918 4.893523,-11.58816' /%3E%3Cpath d='m 93.059678,127.12677 c -0.0045,-4.49797 0.69305,-8.97012 2.068264,-13.25456' /%3E%3Cpath d='m 93.05944,127.14092 c 0.01,-1.5182 -0.319616,-3.03719 -0.987396,-4.44032 -1.087733,-2.28553 -2.979917,-4.06856 -5.289083,-5.02655' /%3E%3Cpath d='m 93.060181,127.14063 c 0.01822,-4.33881 -1.731996,-8.53918 -4.893523,-11.58816' /%3E%3Cpath d='m 93.059636,127.11729 c 0.0045,-4.49797 -0.69305,-8.97012 -2.068264,-13.25456' /%3E%3Cpath d='M 93.059651,127.08342 V 113.55076' /%3E%3C/g%3E%3C/g%3E%3C/svg%3E%0A");
  --ad-flag:url("data:image/svg+xml,%3Csvg width='34.440971mm' height='48.040325mm' viewBox='0 0 34.440971 48.040324' version='1.1' xml:space='preserve' xmlns='http://www.w3.org/2000/svg' xmlns:svg='http://www.w3.org/2000/svg'%3E%3Cg transform='translate(-52.501418,-100.37747)' style='fill:none;stroke:%23000000;stroke-width:0.705556;'%3E%3Cpath d='m 52.854196,100.37747 v 40.1793 h 16.86771 16.867706 v -40.1793' /%3E%3Cpath d='m 62.113134,140.55677 -9.258938,-9.13941' /%3E%3Cpath d='m 77.330681,140.55677 9.258931,-9.13941' /%3E%3Cpath d='m 66.328675,144.71787 h 6.786469' /%3E%3Cpath d='m 52.854196,140.55677 4.629465,-4.56971' /%3E%3Cpath d='m 86.589612,140.55677 -4.629466,-4.56971' /%3E%3Cpath d='m 75.234872,138.48801 11.35474,-11.20819' /%3E%3Cpath d='m 52.854196,127.27982 11.354752,11.20819' /%3E%3C/g%3E%3C/svg%3E%0A");
}
.pv.deco { background: #0e0d20; }
.pv.medieval { background: #1c1410; }
.pv-case { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column;
  background-image: var(--pv-case); }

/* the stepped deco frame — one element, four corners and two rules */
.pv-frame {
  position: absolute; inset: 8px; z-index: 6; pointer-events: none; display: none;
  background: var(--pv-line);
  -webkit-mask-image: linear-gradient(90deg,#000 1px,transparent 0),linear-gradient(#000 1px,transparent 0),
    var(--ad-tl),var(--ad-tr),var(--ad-bl),var(--ad-br);
  -webkit-mask-size: calc(100% - 7px) calc(100% - 84px),calc(100% - 84px) calc(100% - 7px),
    42px 42px,42px 42px,42px 42px,42px 42px;
  -webkit-mask-position: 3px 50%,50% 3px,left top,right top,left bottom,right bottom;
  -webkit-mask-repeat: repeat-x,repeat-y,no-repeat,no-repeat,no-repeat,no-repeat;
}
.pv.deco .pv-frame { display: block; }

/* ── head ─────────────────────────────────────────────────────────────── */
.pv-head {
  position: relative; flex: none; height: 58px; display: flex; align-items: center;
  gap: 15px; padding: 0 26px; overflow: hidden;
  background-image: var(--pv-head); border-bottom: 1px solid var(--pv-line);
}
.pv.deco .pv-head { padding: 0 34px; height: 62px; }
.pv-name {
  flex: none; font-family: var(--pv-display); font-weight: 500; font-size: 15px;
  line-height: 1; letter-spacing: .22em; color: var(--pv-gold);
}
.pv.deco .pv-name { font-weight: 400; font-size: 17px; letter-spacing: .26em; }
.pv-sep { flex: none; width: 1px; height: 18px; background: var(--pv-line); }
.pv-crumb { flex: 1; min-width: 0; font-size: 12.5px; color: var(--pv-cream-dim);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pv.medieval .pv-crumb { font-style: italic; }
.pv-tally { flex: none; font-family: var(--pv-mono); font-size: 9.5px;
  letter-spacing: .14em; color: var(--pv-gold-dim); }
/* the deco fan, top right */
.pv-fan { position: absolute; right: 26px; top: -16px; width: 96px; height: 96px;
  background: var(--pv-gold); opacity: .14; pointer-events: none; display: none;
  -webkit-mask-image: var(--ad-fan); -webkit-mask-size: contain; -webkit-mask-repeat: no-repeat; }
.pv.deco .pv-fan { display: block; }

/* a rule: a hairline in the scriptorium, a bead rule in the archive */
.pv-rule { flex: 1; height: 1px; min-width: 12px; background: var(--pv-line-soft); }
.pv.deco .pv-rule {
  height: 12px; background: var(--pv-line);
  -webkit-mask-image: linear-gradient(to right,transparent 26px,#000 26px,#000 calc(100% - 26px),transparent calc(100% - 26px)),
    var(--ad-hrl),var(--ad-hrr);
  -webkit-mask-size: 100% 1px,26px 12px,26px 12px;
  -webkit-mask-position: center,left center,right center;
  -webkit-mask-repeat: no-repeat;
}
.pv-lozenge { flex: none; width: 12px; height: 12px; background: var(--pv-gold);
  clip-path: polygon(50% 0,100% 50%,50% 100%,0 50%); display: none; }
.pv.deco .pv-lozenge { display: block; }

/* ── progress pip ─────────────────────────────────────────────────────── */
.pv-pip {
  flex: none; display: block; width: var(--pip); height: var(--pip); border-radius: 50%;
  background: conic-gradient(var(--pv-gold) 0 var(--pct), var(--pv-track) var(--pct) 100%);
  box-shadow: inset 0 0 0 1px var(--pv-line);
}
.pv.deco .pv-pip { border-radius: 1px; transform: rotate(45deg); }

/* ── first page ───────────────────────────────────────────────────────── */
.pv-sheet {
  position: relative; display: grid; place-items: center; aspect-ratio: 17/22;
  background: #fffdf4; border: 1px solid var(--pv-line); overflow: hidden;
  transition: border-color .16s ease-out, box-shadow .16s ease-out;
}
.pv-sheet img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top center; }
.pv-sheet.is-openable { cursor: pointer; }
.pv-sheet.is-openable:hover { border-color: var(--pv-gold); box-shadow: 0 6px 20px rgba(0,0,0,.4); }
.pv-sheet.is-openable:focus-visible { outline: 2px solid var(--pv-gold); outline-offset: 3px; }
.pv-sheet-wait {
  font-family: var(--pv-mono); font-size: 9.5px; letter-spacing: .13em;
  color: rgba(42,29,16,.45); background: #fffdf4; padding: 8px 12px; text-align: center;
}

/* ── the reading panel, shared by every view ──────────────────────────── */
.pv-veil {
  position: absolute; inset: 0; z-index: 80; display: flex; align-items: center;
  justify-content: center; padding: 30px; background: var(--pv-veil);
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  animation: pvFade .2s ease both;
}
.pv-read {
  display: flex; max-height: 100%; max-width: 100%; overflow: hidden;
  border: 1px solid var(--pv-line); box-shadow: 0 34px 70px rgba(0,0,0,.62);
}
/* LEFT — the paper itself. The abstract does NOT live here: it used to sit
   under the page image, where a long one pushed the picture off the top of a
   scrolling column and you read the paper's own summary before you had seen
   the paper. It is in the margin now, beside the metadata it belongs with. */
/* Both columns shrink rather than being clipped: a sidebar leaf is nowhere
   near 856px wide, and a rigid flex: none there meant the margin disappeared
   behind the overflow rather than getting narrower. */
.pv-read-face {
  flex: 0 1 470px; min-width: 300px; overflow-y: auto; padding: 32px 36px 36px;
  display: flex; flex-direction: column; gap: 16px;
}
.pv.medieval .pv-read-face { background: var(--pv-paper-flat); color: var(--pv-ink); }
.pv.deco .pv-read-face { background: #14132e; }
.pv-read-face .pv-sheet { border-color: rgba(42,29,16,.2); box-shadow: 0 4px 16px rgba(42,29,16,.22); }

.pv-read-margin {
  position: relative; flex: 0 1 386px; min-width: 260px;
  overflow-y: auto; overflow-x: hidden; padding: 32px 28px 34px;
  display: flex; flex-direction: column; gap: 18px; border-left: 1px solid var(--pv-line);
}
/* A coffee ring in the margin, for a case that has been read in. Two rings and
   a splash, multiplied into the paper — off by default, because it is a joke
   that stops being funny on the twentieth paper. */
.pv-stain, .pv-stain::after {
  position: absolute; pointer-events: none; mix-blend-mode: multiply;
  background:
    radial-gradient(closest-side circle at 50% 50%,rgba(126,78,34,0) 62%,rgba(126,78,34,.16) 68%,
      rgba(101,58,22,.42) 76%,rgba(126,78,34,.3) 84%,rgba(126,78,34,.07) 92%,rgba(126,78,34,0) 96%),
    radial-gradient(closest-side circle at 50% 50%,rgba(134,88,42,.13) 0 60%,rgba(134,88,42,0) 62%);
}
.pv-stain { right: -34px; top: 150px; width: 172px; height: 168px; transform: rotate(-7deg); opacity: .72; }
.pv-stain::after { content: ""; right: -14px; top: 46px; width: 74px; height: 70px;
  transform: rotate(12deg); opacity: .6; }
.pv.deco .pv-stain { mix-blend-mode: screen; filter: hue-rotate(20deg) saturate(.5); opacity: .3; }
.pv.medieval .pv-read-margin { background: linear-gradient(178deg,#e7d5af,#dbc79c); color: var(--pv-ink); }
.pv.deco .pv-read-margin { background: linear-gradient(178deg,#1a1940,#121128); }

.pv-eyebrow {
  display: flex; align-items: center; gap: 11px;
  font-family: var(--pv-mono); font-size: 10px; letter-spacing: .17em;
}
.pv.medieval .pv-eyebrow { color: var(--pv-accent); }
.pv.deco .pv-eyebrow { color: var(--pv-gold); }
.pv-read-face .pv-rule, .pv-read-margin .pv-rule { flex: 1; }
.pv.medieval .pv-read-face .pv-rule { background: rgba(42,29,16,.2); }
.pv.medieval .pv-read-margin .pv-rule { background: rgba(42,29,16,.2); }

.pv-read-title { margin: 0; font-size: 28px; line-height: 1.24; font-weight: 400; text-wrap: pretty; }
.pv.medieval .pv-read-title { color: #22170d; }
.pv.deco .pv-read-title { color: #f4eedd; }
.pv-read-authors { font-size: 14px; line-height: 1.55; }
.pv.medieval .pv-read-authors { font-style: italic; color: rgba(42,29,16,.68); }
.pv.deco .pv-read-authors { color: rgba(240,233,216,.66); }
/* Affiliation follows the names, quieter and on its own line — it answers
   "whose lab" once you have already read "whose paper". */
.pv-read-affil { font-size: 12px; line-height: 1.5; letter-spacing: .02em; }
.pv.medieval .pv-read-affil { color: rgba(42,29,16,.5); }
.pv.deco .pv-read-affil { color: rgba(240,233,216,.44); }

.pv-caps {
  font-family: var(--pv-mono); font-size: 9px; letter-spacing: .15em;
  text-transform: uppercase;
}
.pv.medieval .pv-caps { color: rgba(42,29,16,.5); }
.pv.deco .pv-caps { color: rgba(227,194,74,.65); }
.pv.medieval .pv-read-margin .pv-caps { color: rgba(42,29,16,.5); }

.pv-abstract { display: flex; flex-direction: column; gap: 9px; }
.pv-abstract p { margin: 0; font-size: 15px; line-height: 1.72; text-wrap: pretty; }
.pv.medieval .pv-abstract p { color: #2c2016; }
.pv.deco .pv-abstract p { color: rgba(240,233,216,.86); font-size: 14.5px; }

.pv-field { display: flex; flex-direction: column; gap: 5px; padding-bottom: 14px;
  border-bottom: 1px solid var(--pv-line-soft); }
.pv.medieval .pv-field { border-bottom-color: rgba(42,29,16,.14); }
.pv-field-v { font-size: 13.5px; line-height: 1.55; }
.pv.medieval .pv-field-v { color: #22170d; }
.pv.deco .pv-field-v { color: #f0e9d8; }

.pv-cards { display: flex; flex-direction: column; gap: 7px; }
.pv-mini {
  cursor: pointer; padding: 10px 11px; display: flex; flex-direction: column; gap: 4px;
  border: 1px solid var(--pv-line-soft); transition: border-color .15s, background .15s;
}
.pv.medieval .pv-mini { background: rgba(255,253,244,.55); border-color: rgba(42,29,16,.16); }
.pv.medieval .pv-mini:hover { background: #fffdf4; border-color: rgba(141,47,38,.5); }
.pv.deco .pv-mini { background: #0e0d20; }
.pv.deco .pv-mini:hover { border-color: rgba(227,194,74,.6); }
.pv-mini-t { font-size: 12.5px; line-height: 1.42; }
.pv.medieval .pv-mini-t { color: #22170d; }
.pv.deco .pv-mini-t { color: #f0e9d8; }
.pv-mini-f { font-family: var(--pv-mono); font-size: 8.5px; letter-spacing: .1em; }
.pv.medieval .pv-mini-f { color: rgba(42,29,16,.5); }
.pv.deco .pv-mini-f { color: rgba(240,233,216,.45); }

.pv-open {
  margin-top: 2px; display: flex; align-items: center; justify-content: center; gap: 9px;
  text-decoration: none; border: 1px solid var(--pv-line); color: var(--pv-gold);
  font-family: var(--pv-mono); font-size: 9.5px; letter-spacing: .18em; padding: 11px 0;
  cursor: pointer; background: transparent; transition: background .15s;
}
.pv.medieval .pv-read-face .pv-open { color: var(--pv-accent); border-color: rgba(141,47,38,.45); }
.pv-open:hover { background: rgba(227,194,74,.12); }
.pv.medieval .pv-read-face .pv-open:hover { background: rgba(141,47,38,.1); }

/* ── misc ─────────────────────────────────────────────────────────────── */
.pv-fault {
  padding: 14px 16px; border-radius: 6px; line-height: 1.5;
  border: 1px solid var(--background-modifier-border);
  background: var(--background-primary-alt); color: var(--text-error);
  font-family: var(--font-interface); font-size: .9em;
}
.pv-empty {
  margin: auto; padding: 40px; text-align: center; line-height: 1.7;
  font-family: var(--pv-mono); font-size: 11px; letter-spacing: .12em;
  color: var(--pv-gold-dim);
}
.pv ::-webkit-scrollbar { width: 9px; height: 9px; }
.pv ::-webkit-scrollbar-thumb { background: var(--pv-line); border-radius: 5px; }
.pv ::-webkit-scrollbar-track { background: transparent; }

@keyframes pvFade { from { opacity: 0 } to { opacity: 1 } }
@keyframes pvRowRise { from { opacity: 0; transform: translateY(26px) } to { opacity: 1; transform: none } }
@keyframes pvLeafRise { from { opacity: 0; transform: translateY(44px) } to { opacity: 1; transform: none } }
@keyframes pvFlyQueue { to { opacity: 0; transform: translate(-300px,340px) scale(.36) rotate(-10deg) } }
@keyframes pvFlyPile { to { opacity: 0; transform: translate(-460px,330px) scale(.32) rotate(-18deg) } }
@keyframes pvFlyLeft { to { opacity: 0; transform: translateX(-470px) rotate(-19deg) } }
`;

function Styles({ webfonts = true }) {
  dc.useEffect(() => {
    let el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement("style");
      el.id = STYLE_ID;
      document.head.appendChild(el);
    }
    if (el.textContent !== CSS) el.textContent = CSS;
  }, []);

  dc.useEffect(() => {
    if (!webfonts) return;
    if (document.getElementById(FONTS_ID)) return;
    const link = document.createElement("link");
    link.id = FONTS_ID;
    link.rel = "stylesheet";
    link.href = FONTS_HREF;
    document.head.appendChild(link);
  }, [webfonts]);

  return null;
}

// ════════════════════════════════════════════════════════════════════════════
//  The reading panel
//
//  One component, four views. Whichever way you arrived at a paper — a leaf in
//  a drawer, a card off the queue, a node in the constellation, a frame on the
//  contact sheet — this is what opens, so a paper looks like itself everywhere.
//
//  Left: the paper. Right: the abstract, then the margin notes. The abstract
//  moved out of the left column deliberately; see .pv-read-face above.
// ════════════════════════════════════════════════════════════════════════════
function ReadingPanel({ paper, related = [], onClose, onPick, stain = false, sheetWidth = 400, children }) {
  if (!paper) return null;
  const fields = fieldsOf(paper);

  return (
    <div class="pv-veil" onClick={onClose}>
      <div class="pv-read" onClick={(e) => e.stopPropagation()}>
        <div class="pv-read-face">
          <div class="pv-eyebrow">
            <span class="pv-lozenge" />
            <span>{[paper.venue, paper.year].filter(Boolean).join(" · ") || "unpublished"}</span>
            <i class="pv-rule" />
            <span>{paper.tier ?? ""}</span>
          </div>
          <h2 class="pv-read-title">{paper.title}</h2>
          {paper.sub && <div class="pv-read-affil">{paper.sub}</div>}
          {paper.authorsFull && <div class="pv-read-authors">{paper.authorsFull}</div>}
          {paper.affiliationLine && <div class="pv-read-affil">{paper.affiliationLine}</div>}
          {/* The page IS the link, and the only one. There was a second row
              under it carrying the note's filename, which opened the note —
              two targets for one card, one of them a duplicate of the title
              already at the top of this column. */}
          <PageSheet paper={paper} width={sheetWidth} />
        </div>

        <div class="pv-read-margin">
          {stain && <span class="pv-stain" aria-hidden="true" />}
          {paper.abstract && (
            <div class="pv-abstract">
              <span class="pv-caps">Abstract</span>
              <p>{paper.abstract}</p>
            </div>
          )}
          {fields.map((f) => (
            <div class="pv-field" key={f.label}>
              <span class="pv-caps">{f.label}</span>
              <span class="pv-field-v">{f.value}</span>
            </div>
          ))}
          {related.length > 0 && (
            <div class="pv-abstract">
              <span class="pv-caps">Related</span>
              <div class="pv-cards">
                {related.map((r) => (
                  <div class="pv-mini" key={r.paper.id} onClick={() => onPick?.(r.paper.id)}>
                    <span class="pv-mini-t">{r.paper.title}</span>
                    <span class="pv-mini-f">{footOf(r.paper) || r.why}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

/** Escape closes whatever is on top. Every view wants it; none should re-write it. */
function useEscape(handler) {
  const ref = dc.useRef(handler);
  ref.current = handler;
  dc.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") ref.current?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

// ════════════════════════════════════════════════════════════════════════════
//  exports
// ════════════════════════════════════════════════════════════════════════════
return {
  // designs
  DESIGNS, designClass, DesignError,
  // model
  usePapers, readPaper, indexBy, useDrawers, unreadOf, relatedTo, edgesOf,
  splitTitle, authorLine, firstAuthor, compact, num, listOf, fieldsOf, footOf,
  TIER_RANK, READING, UPCOMING, DONE, RELATIONS, NON_TOPIC_TAGS, ROMAN,
  // components
  Pip, PageSheet, ReadingPanel, Styles, openNote,
  // layout
  useFitHeight, useEdgeScroll, useEscape,
  // re-exported so a view needs one require
  clamp, hashOf, baseName, resolvePdf, openAt, writeFields, useCitations,
};
