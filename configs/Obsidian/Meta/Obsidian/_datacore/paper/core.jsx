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
//  Every ornament here is the design's own: the deco corners and bead rules as
//  SVG, and the scriptorium's two leaf faces as the WebP sheets it was drawn
//  with (--pv-leaf-scroll, --pv-leaf-sheet). Those two are 52 KB together, and
//  they were briefly a generated feTurbulence edge instead — 400 bytes, and it
//  looked like 400 bytes. Photographed paper is the whole point of the design;
//  approximating it in CSS is not a saving, it is a different design.
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
//  The ABSTRACT is not read from frontmatter at all if there is a PDF: it is
//  taken off page one of the paper itself and cached against the file's mtime.
//  `claim:` / `blurb:` / `abstract:` are the fallback. See useAbstract.
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

const {
  resolvePdf, parseLink, usePageImage, useCitations, writeFields, openAt,
  getDoc, usePdfjsReady,
} = pdf;
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

  // The PDF is resolved here rather than at render time, because two questions
  // that used to be guesses are answered by it: whether there is a paper behind
  // this note at all, and whether it has been marked up.
  const pdfLink = get("paper") ?? get("pdf") ?? get("title");
  const pdfFile = resolvePdf(pdfLink, path);
  const highlights = num(get("highlights"));

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
    highlights,
    /**
     * Is this paper being read RIGHT NOW?
     *
     * A coffee ring is not decoration and it is not a property of the note —
     * it is what a paper looks like after it has been sat with. So it is
     * derived, not passed in: there has to be a PDF (a paper you cannot open
     * has not been read out of), and it has to carry marks. `highlights` is
     * written back by the infobox after every read, so this moves on its own.
     * A `status:` of reading or skimming says the same thing in words and
     * counts too, for the paper you have started but not yet marked.
     */
    active: !!pdfFile && !done &&
      ((highlights ?? 0) > 0 || READING.includes(status) || progress > 0),
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
    pdfLink,
    pdfPath: pdfFile?.path ?? null,
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
  const tagKey = tags.join(" ").toLowerCase();

  return dc.useMemo(() => {
    const collectedBy = new Set(tagKey ? tagKey.split(" ") : []);
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

/**
 * A blank `venue:` means the field is blank. It does NOT mean the paper was
 * never published — that is a claim about the world inferred from an empty
 * box, and it was wrong for every preprint and every note filled in halfway.
 * Nothing in these views infers it any more, and the word is not in this file.
 */
const GROUPERS = {
  topic: (p) => p.topic,
  venue: (p) => p.venue ?? "no venue",
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
 * Do these two papers carry exactly the same topics — no more, no less?
 *
 * Not "overlaps". Every paper in a drawer overlaps; that is what the drawer
 * is. Two papers filed under precisely the same set of tags are a different
 * animal: you have already decided they belong in the same place for the same
 * reasons, and listing those reasons back at you says nothing. So the tag row
 * is replaced by the fact itself.
 *
 * An untagged pair is not a pair. Sharing nothing is not sharing everything.
 */
function mirrorTwins(a, b) {
  if (!a || !b) return false;
  const A = new Set(a.topics.map((t) => t.toLowerCase()));
  const B = new Set(b.topics.map((t) => t.toLowerCase()));
  if (!A.size || A.size !== B.size) return false;
  for (const t of A) if (!B.has(t)) return false;
  return true;
}

/**
 * The papers you SAID belong beside this one. Nothing else.
 *
 * This used to top the list up from the shelf: declared relations first, then
 * anything sharing a topic, then the rest of the drawer. That was wrong twice
 * over. It filled RELATED with papers you never connected — every card in the
 * drawer is "same topic", so the section was a slice of the drawer you were
 * already looking at — and it labelled them "same topic" while claiming to be
 * a list of relations, which is how a paper ends up captioned "same topic"
 * next to one it shares nothing exact with.
 *
 * builds-on · extends · compare-with · refutes · superseded-by · prereq ·
 * related. If none of those are filled in, the section is empty, and an empty
 * RELATED is the true answer.
 */
function relatedTo(paper, papers, byId, cap = 12) {
  if (!paper) return [];
  const out = [], seen = new Set([paper.id]);
  for (const r of paper.relations) {
    if (out.length >= cap) break;
    const p = r.path ? byId[r.path] : null;
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push({ paper: p, why: r.label, mirror: mirrorTwins(paper, p) });
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
//  The abstract, taken off the paper
//
//  Frontmatter is where you write what YOU think a paper says — `claim:` is one
//  sentence in your own words, and it is the more useful of the two. The
//  abstract is what the AUTHORS say it says, it is already sitting on page one
//  of the PDF, and copying it into a note by hand is a chore nobody does. So it
//  is read off the paper, cached against the file's mtime, and `claim:` /
//  `blurb:` / `abstract:` are the fallback when there is no PDF or no heading
//  to find in it.
// ════════════════════════════════════════════════════════════════════════════
const ABSTRACTS = new Map();
const ABSTRACT_CAP = 40;

/** Where the abstract stops. The first of these wins. */
const ABS_END = [
  /\n\s*(?:[IVX0-9]+\s*[.)]?\s*)?introduction\b/i,
  /\n\s*(?:index terms|keywords?|key words|ccs concepts|general terms|acm reference)\b/i,
  /\n\s*(?:[IVX0-9]+\s*[.)]?\s*)?(?:background|motivation|related work)\b/i,
];

/**
 * Page text, as close to reading order as pdf.js will give without laying the
 * glyphs out again. `hasEOL` is the flag the text layer sets on the last item
 * of a visual line, which is what makes the headings above findable at all —
 * without the newlines "Abstract" and "1 Introduction" are just words in a
 * soup and every regex here matches the wrong one.
 */
async function pageText(doc, n) {
  const page = await doc.getPage(n);
  const tc = await page.getTextContent();
  let out = "";
  for (const it of tc.items) {
    if (typeof it.str !== "string") continue;
    out += it.str;
    if (it.hasEOL) out += "\n";
    else if (it.str && !/\s$/.test(it.str)) out += " ";
  }
  return out;
}

async function readAbstract(file) {
  const key = `${file.path}:${file.stat.mtime}`;
  if (ABSTRACTS.has(key)) return ABSTRACTS.get(key);

  const doc = await getDoc(file);
  // Two pages, because a two-column paper often carries the tail of the
  // abstract onto the second — and never more, because by page three you are
  // scanning the whole document to find something that is always on page one.
  let text = "";
  for (let n = 1; n <= Math.min(2, doc.numPages); n++) text += await pageText(doc, n);

  const found = findAbstract(text);
  ABSTRACTS.set(key, found);
  while (ABSTRACTS.size > ABSTRACT_CAP) ABSTRACTS.delete(ABSTRACTS.keys().next().value);
  return found;
}

/** The parsing half, kept separate so it can be reasoned about on its own. */
function findAbstract(raw) {
  const text = String(raw ?? "")
    .replace(/\r/g, "")
    // a word broken across a line break is one word
    .replace(/([a-z])-\n\s*/gi, "$1")
    .replace(/[ \t ]+/g, " ");

  // The heading, however it was set: "Abstract", "ABSTRACT", "A B S T R A C T".
  const head = text.match(/(?:^|\n)\s*a\s?b\s?s\s?t\s?r\s?a\s?c\s?t(?![a-z])\s*[:.\-—]?\s*/i);
  if (!head) return null;

  let body = text.slice(head.index + head[0].length);
  let cut = -1;
  for (const re of ABS_END) {
    const m = body.match(re);
    if (m && (cut < 0 || m.index < cut)) cut = m.index;
  }

  if (cut >= 0) {
    body = body.slice(0, cut);
  } else if (body.length > 2400) {
    // Nothing said where to stop, so this is running on into the paper. Break
    // at the last full stop inside a sensible length rather than mid-sentence.
    const stop = body.lastIndexOf(". ", 2400);
    body = body.slice(0, stop > 400 ? stop + 1 : 2400);
  }

  const out = body.replace(/\s*\n\s*/g, " ").replace(/\s{2,}/g, " ").trim();
  // Anything this short is a mis-hit — a running header, a figure caption, the
  // word "abstract" in a title. Better nothing than a fragment.
  return out.length >= 120 ? out : null;
}

/**
 * The abstract for one paper: the PDF's, or the note's, in that order.
 *
 * Returns `{ text, from }` so a view can say where it came from — the panel
 * does not, but "why is this different from what I typed" is a question worth
 * being able to answer.
 */
function useAbstract(paper) {
  const file = dc.useMemo(
    () => resolvePdf(paper?.pdfLink, paper?.path),
    [paper?.path, paper?.pdfLink]
  );
  const ready = usePdfjsReady();
  const [scraped, setScraped] = dc.useState(null);
  const sig = file ? `${file.path}:${file.stat.mtime}` : "";

  dc.useEffect(() => {
    setScraped(null);
    if (!file || !ready) return;
    let alive = true;
    readAbstract(file)
      .then((t) => alive && setScraped(t))
      .catch(() => alive && setScraped(null));
    return () => { alive = false; };
  }, [sig, ready]);

  if (scraped) return { text: scraped, from: "paper" };
  if (paper?.abstract) return { text: paper.abstract, from: "note" };
  return { text: null, from: null };
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
function PageSheet({ paper, width = 420, page = null, className = "", fit = false }) {
  const file = dc.useMemo(
    () => resolvePdf(paper?.pdfLink, paper?.path),
    [paper?.path, paper?.pdfLink]
  );
  const at = page ?? paper?.figure ?? 1;
  const img = usePageImage(file, at, Math.round(width * 1.6));

  return (
    <div
      class={"pv-sheet " + className + (fit ? " is-fit" : "") + (file ? " is-openable" : "")}
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
  /* The two leaf faces, lifted from the study byte for byte.
     These are photographed paper: the same image is both the texture and the
     alpha mask, which is why the torn edge lines up with the fibres in it.
     They were a generated feTurbulence displacement here for a while — 400
     bytes against 52 KB — and it looked like what it was, a rectangle with
     noise on the edge, with a CSS cylinder drawn across the top for the roll.
     The study does not draw a cylinder; the roll is in the image. */
  --pv-leaf-sheet: url("data:image/webp;base64,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");
  --pv-leaf-scroll: url("data:image/webp;base64,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");
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
/* fit mode: the page is as tall as the room it is given and takes whatever
   width that implies. aspect-ratio with a fixed height IS the width, so the
   column beside it sizes itself off the paper rather than off a guess; contain
   keeps a landscape or A4 page whole, and the ground behind it is page-white
   so the letterbox does not read as a border. */
.pv-sheet.is-fit { height: 100%; width: auto; max-width: 100%; }
.pv-sheet.is-fit img { width: 100%; height: 100%; object-fit: contain; object-position: center; }
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
  justify-content: center; background: var(--pv-veil);
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  animation: pvFade .2s ease both;
}
/* 90% of the pane, both ways. Not a box in the middle of the window: opening a
   paper is the thing you came here to do, so it gets the room. The two slabs
   are separate, with cork showing between them, rather than one panel split by
   a rule — the picture is the paper and the column beside it is your notes on
   it, and they are not the same object. */
/* justify-content: center is load-bearing. Without it the row packs to the
   left, and since the page is only as wide as its own aspect ratio and the
   margin caps at 620px, whatever is left over piled up on the right — the pair
   sat against the left edge with a hole beside it. That is why medieval looked
   different from deco: the same rule, a different amount of slack. */
.pv-read {
  display: flex; align-items: stretch; justify-content: center; gap: 34px;
  width: 90%; height: 90%; background: none; border: none;
}
/* LEFT — the page, full height, nothing else in the column. The heading and
   the byline moved to the margin: they were stacked on top of the picture,
   which made the one thing worth seeing at full size the one thing being
   squeezed into what was left. */
/* 0 1 auto, not 0 0 auto: the page is as wide as its own height implies, and
   in a narrow pane that plus a 300px margin is wider than the row. Allowed to
   shrink, the page letterboxes by a few pixels; forbidden to, it hung over
   both edges of the panel it is supposed to be inside. */
.pv-read-face {
  flex: 0 1 auto; min-width: 0; max-width: 62%; height: 100%;
  display: flex; align-items: stretch; justify-content: flex-end;
}
.pv-read-face .pv-sheet {
  border-color: var(--pv-line); box-shadow: 0 24px 54px rgba(0,0,0,.6);
}

.pv-read-margin {
  position: relative; flex: 1 1 380px; min-width: 300px; max-width: 620px; height: 100%;
  box-sizing: border-box;
  overflow-y: auto; overflow-x: hidden; padding: 30px 28px 34px;
  display: flex; flex-direction: column; gap: 16px;
  border: 1px solid var(--pv-line); box-shadow: 0 24px 54px rgba(0,0,0,.6);
}
/* A coffee ring in the margin. Two rings and a splash, multiplied into the
   paper. It is not decoration and it is not on every paper: it appears when
   this one is being read — there is a PDF and the PDF has marks in it — which
   is the only thing a ring on a page has ever meant. See the active flag in
   readPaper, and the stain prop on the panel for the manual override. */
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
.pv-read-margin .pv-rule { flex: 1; }
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
/* the relation on the left, the one button on the right */
.pv-mini-head { display: flex; align-items: center; gap: 8px; min-height: 20px; }
.pv-mini-why {
  flex: 1; min-width: 0; font-family: var(--pv-mono); font-size: 8.5px;
  letter-spacing: .16em; text-transform: uppercase;
}
.pv.medieval .pv-mini-why { color: var(--pv-accent); }
.pv.deco .pv-mini-why { color: var(--pv-gold); }
.pv-mini-add {
  flex: none; width: 20px; height: 20px; padding: 0; cursor: pointer; line-height: 1;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--pv-mono); font-size: 12px;
  background: transparent; border: 1px solid var(--pv-line); color: var(--pv-gold);
  transition: background .14s ease-out, color .14s ease-out, border-color .14s ease-out;
}
.pv-mini-add:hover { background: var(--pv-gold); color: var(--pv-ink); border-color: var(--pv-gold); }
.pv.medieval .pv-mini-add { border-color: rgba(141,47,38,.4); color: var(--pv-accent); }
.pv.medieval .pv-mini-add:hover { background: var(--pv-accent); color: #f6ecd3; }

/* what the related paper is filed under */
.pv-mini-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 1px; }
.pv-tag {
  font-family: var(--pv-mono); font-style: normal; font-size: 8px; letter-spacing: .08em;
  padding: 2px 5px; border: 1px solid var(--pv-line-soft);
}
.pv-tag::before { content: "#"; opacity: .45; }
.pv.medieval .pv-tag { color: rgba(42,29,16,.55); border-color: rgba(42,29,16,.16); }
.pv.deco .pv-tag { color: rgba(240,233,216,.5); }
/* filed under exactly the same tags — no more, no less */
.pv-twin {
  align-self: flex-start; margin-top: 1px; padding: 2px 7px;
  font-family: var(--pv-mono); font-size: 8px; letter-spacing: .16em; text-transform: uppercase;
  color: var(--pv-accent); border: 1px double var(--pv-accent); opacity: .82;
}
.pv.deco .pv-twin { color: var(--pv-gold); border: 1px solid var(--pv-gold); }

.pv-open {
  margin-top: 2px; display: flex; align-items: center; justify-content: center; gap: 9px;
  text-decoration: none; border: 1px solid var(--pv-line); color: var(--pv-gold);
  font-family: var(--pv-mono); font-size: 9.5px; letter-spacing: .18em; padding: 11px 0;
  cursor: pointer; background: transparent; transition: background .15s;
}
.pv-open:hover { background: rgba(227,194,74,.12); }

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
//  It takes 90% of the pane, and it is two slabs with a gap between them:
//
//    LEFT   the page named by `figure:`, fitted to the full height. Nothing
//           else — no heading, no byline, nothing that makes the picture
//           smaller. It is the paper; you should be able to read it.
//    RIGHT  everything you would otherwise have to open the note for: the
//           heading, the abstract off the PDF, the fields, and what to read
//           next.
//
//  It used to be a box a third that size with the title and byline stacked
//  above a thumbnail, which meant the one thing worth showing full size was
//  the one thing being squeezed.
// ════════════════════════════════════════════════════════════════════════════
/* Guard and body are two components on purpose: the body calls hooks, and a
   component that returns early on some renders and calls useAbstract on others
   is a "rendered fewer hooks than expected" crash the first time a caller lets
   `paper` go null while the panel is still mounted. */
function ReadingPanel(props) {
  if (!props.paper) return null;
  return <ReadingPanelBody {...props} />;
}

function ReadingPanelBody({
  paper, related = [], onClose, onPick, onQueue, queued = [],
  stain = "auto", sheetWidth = 620, children,
}) {
  const fields = fieldsOf(paper);
  const abstract = useAbstract(paper);
  // "auto" is the answer: a ring means this paper is being read, and whether it
  // is being read is something the vault already knows. true/false still force
  // it, for a view that wants the joke on or off regardless.
  const ringed = stain === true || (stain !== false && paper.active);

  return (
    <div class="pv-veil" onClick={onClose}>
      <div class="pv-read" onClick={(e) => e.stopPropagation()}>
        {/* LEFT — the page named by `figure:`, and only the page. */}
        <div class="pv-read-face">
          <PageSheet paper={paper} width={sheetWidth} fit />
        </div>

        <div class="pv-read-margin">
          {ringed && <span class="pv-stain" aria-hidden="true" />}
          <div class="pv-eyebrow">
            <span class="pv-lozenge" />
            <span>{[paper.venue, paper.year].filter(Boolean).join(" · ")}</span>
            <i class="pv-rule" />
            <span>{paper.tier ?? ""}</span>
          </div>
          <h2 class="pv-read-title">{paper.title}</h2>
          {paper.sub && <div class="pv-read-affil">{paper.sub}</div>}
          {paper.authorsFull && <div class="pv-read-authors">{paper.authorsFull}</div>}
          {paper.affiliationLine && <div class="pv-read-affil">{paper.affiliationLine}</div>}

          {abstract.text && (
            <div class="pv-abstract">
              <span class="pv-caps">
                Abstract{abstract.from === "note" ? " · from the note" : ""}
              </span>
              <p>{abstract.text}</p>
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
                    <span class="pv-mini-head">
                      <span class="pv-mini-why">{r.why}</span>
                      {/* Queues it and does nothing else — you are still
                          reading this paper, you have just decided that one is
                          next. Without stopPropagation the click would open it
                          instead, which is the opposite of what the + means.
                          Once it is in the queue the button is GONE, not
                          greyed: there is nothing left to press. */}
                      {onQueue && !queued.includes(r.paper.id) && (
                        <button
                          class="pv-mini-add"
                          title="add to the queue"
                          onClick={(e) => { e.stopPropagation(); onQueue(r.paper.id); }}
                        >+</button>
                      )}
                    </span>
                    <span class="pv-mini-t">{r.paper.title}</span>
                    <span class="pv-mini-f">{footOf(r.paper)}</span>
                    {/* What this paper is filed under — or, when that is the
                        same set of tags as the one you are reading, the fact
                        that it is, which is the more useful sentence. */}
                    {r.mirror ? (
                      <span class="pv-twin">mirror twins</span>
                    ) : r.paper.topics.length > 0 ? (
                      <span class="pv-mini-tags">
                        {r.paper.topics.slice(0, 5).map((t) => (
                          <i class="pv-tag" key={t}>{t}</i>
                        ))}
                      </span>
                    ) : null}
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
  mirrorTwins, TIER_RANK, READING, UPCOMING, DONE, RELATIONS, NON_TOPIC_TAGS, ROMAN,
  // the abstract, off the paper
  useAbstract, readAbstract, findAbstract,
  // components
  Pip, PageSheet, ReadingPanel, Styles, openNote,
  // layout
  useFitHeight, useEdgeScroll, useEscape,
  // re-exported so a view needs one require
  clamp, hashOf, baseName, resolvePdf, openAt, writeFields, useCitations,
};
