// ════════════════════════════════════════════════════════════════════════════
//  populate.jsx  —  a new book note, filled in from its ASIN
//  Location: Meta/Obsidian/_datacore/book/populate.jsx
//
//  The STEM Book template carries this block and every property, empty:
//
//    ```datacorejsx
//    const { BookPopulate } = await dc.require("Meta/Obsidian/_datacore/book/populate.jsx");
//    return function View() { return <BookPopulate path={dc.useCurrentPath()} />; };
//    ```
//
//  The box takes an ASIN — Amazon's image endpoint keys on it, and it has the
//  best covers there are — or an ISBN-10 / -13, or an Amazon product link.
//  For a print book the ASIN is the ISBN-10, so either gives the other.
//  Press Populate:
//
//    1. Google Books and Open Library are asked for the metadata. A Kindle
//       ASIN (B0…) carries no ISBN, so the Amazon page is read for one first
//    2. the title loses its edition and any "(… series)", and its subtitle —
//       the source's own field, or what follows the first ": " — goes to
//       `subtitle`; a note still called "Untitled" is renamed after the title
//    3. the book's PDF, if you keep one — "<title>.pdf" anywhere, or the only
//       PDF in the note's own folder — is renamed after the note and `title`
//       links to it
//    4. the largest cover on offer is downloaded (book/covers.jsx) beside the
//       note, or beside the book's PDF if there is one
//    5. every empty property that can be known is filled; nothing already
//       typed is overwritten
//    6. this block swaps itself for the book infobox
//
//  If no cover could be had, the block stays and says why; pressing Populate
//  again retries.
//
//  Tuning: Meta/Obsidian/_datacore/populate/config.jsx.
//
//  NOTE: never declare a local named `h` in this file — it is the JSX pragma.
// ════════════════════════════════════════════════════════════════════════════

const core = await dc.require("Meta/Obsidian/_datacore/populate/core.jsx");
const covers = await dc.require("Meta/Obsidian/_datacore/book/covers.jsx");
const { PopulateForm } = await dc.require("Meta/Obsidian/_datacore/populate/panel.jsx");
const { Styles, BlankCover } = await dc.require("Meta/Obsidian/_datacore/book/core.jsx");

const { CONFIG } = core;
const MARKER = "book/populate.jsx";

// ── input ───────────────────────────────────────────────────────────────────
/** An ASIN, an ISBN-10 / -13 (hyphens fine) or an Amazon link → { asin } | { isbn }. */
function readInput(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const url = s.match(/\/(?:dp|gp\/product|gp\/aw\/d|ASIN|exec\/obidos\/ASIN)\/([A-Z0-9]{10})(?=[/?#]|$)/i);
  if (url) return { asin: url[1].toUpperCase() };
  const bare = s.toUpperCase().replace(/[\s-]/g, "").replace(/^(?:ISBN|ASIN)(?:1[03])?:?/, "");
  if (/^97[89]\d{10}$/.test(bare)) return { isbn: bare };
  if (/^[A-Z0-9]{10}$/.test(bare)) return { asin: bare };
  return null;
}

/** Every identifier the input (and anything already in the note) gives up. */
function identifiers({ isbn, asin }) {
  const rawAsin = asin ? String(asin).trim().toUpperCase() : null;
  let { isbn10, isbn13 } = core.normalizeIsbn(isbn ? core.recoverIsbn(isbn) : null);

  // For a print book the ASIN is the ISBN-10, so one that checksums as an
  // ISBN-10 gives the whole set.
  if (!isbn10 && !isbn13 && rawAsin && core.isbnCheckOk(rawAsin)) {
    ({ isbn10, isbn13 } = core.normalizeIsbn(rawAsin));
  }
  // 979- books have no ISBN-10, hence no ASIN of that kind
  return { isbn10, isbn13, asin: rawAsin ?? isbn10 ?? null };
}

// ── Amazon ──────────────────────────────────────────────────────────────────
/**
 * A Kindle ASIN names the ebook, which has no ISBN of its own, but its page
 * usually lists the print edition's ("Page numbers source ISBN"). Best effort:
 * Amazon answers some requests with a captcha, and then this returns null.
 */
async function fetchAmazon(asin) {
  if (!CONFIG.book.readAmazonPage || !asin || !core.netCanCrossOrigin()) return null;
  const res = await core.netGet(`https://www.amazon.com/dp/${asin}`, {
    crossOrigin: true,
    timeout: CONFIG.net.timeoutMs,
    headers: { "Accept-Language": "en-US,en;q=0.9", Accept: "text/html,application/xhtml+xml" },
  });
  const html = res?.status < 400 ? res.text : null;
  if (!html || !/productTitle/.test(html)) return null;

  const isbnAfter = (label) => {
    const m = html.match(new RegExp(`${label}[\\s\\S]{0,160}?\\b(97[89][\\d-]{10,14}|\\d{9}[\\dX])\\b`, "i"));
    return m ? m[1].replace(/-/g, "") : null;
  };
  const title = core.stripHtml(html.match(/id="productTitle"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "");
  return {
    title: title || null,
    isbn: [isbnAfter("ISBN-13"), isbnAfter("ISBN-10"), isbnAfter("source ISBN")].find((i) => core.isbnCheckOk(i)) ?? null,
  };
}

/** "Deep Learning (Adaptive Computation…) Kindle Edition" → "Deep Learning". */
const searchableTitle = (s) =>
  core.squish(String(s ?? "")
    .replace(/\b(kindle|hardcover|paperback)\s+edition\b/gi, "")
    .replace(/\([^)]*\)|\[[^\]]*\]/g, "")
    .split(":")[0]) || null;

// ── Google Books ────────────────────────────────────────────────────────────
async function fetchGoogle({ isbn13, isbn10, title }) {
  const queries = [];
  if (isbn13) queries.push(`isbn:${isbn13}`);
  if (isbn10) queries.push(`isbn:${isbn10}`);
  if (title) queries.push(`intitle:"${title.replace(/"/g, "")}"`);

  const key = CONFIG.net.googleBooksApiKey ? `&key=${CONFIG.net.googleBooksApiKey}` : "";
  const wanted = [isbn13, isbn10].filter(Boolean);

  for (const q of queries) {
    // no retry: Google's 429 here is a daily quota, not a burst limit
    const json = await core.netJson(
      `https://www.googleapis.com/books/v1/volumes?maxResults=5&q=${encodeURIComponent(q)}${key}`,
      { timeout: CONFIG.net.timeoutMs },
    );
    const items = json?.items ?? [];
    if (!items.length) continue;
    if (q.startsWith("isbn:")) {
      // prefer a volume that actually carries the ISBN asked for
      return items.find((it) =>
        (it.volumeInfo?.industryIdentifiers ?? []).some((x) => wanted.includes(x.identifier))) ?? items[0];
    }
    // by title, only a close match is trusted
    const want = core.normTitle(title);
    const hit = items.find((it) => core.normTitle(it.volumeInfo?.title).startsWith(want.slice(0, 20)));
    if (hit) return hit;
  }
  return null;
}

// ── Open Library ────────────────────────────────────────────────────────────
async function fetchOpenLibrary({ isbn13, isbn10 }) {
  const key = isbn13 ?? isbn10;
  if (!key) return null;
  const base = `https://openlibrary.org/api/books?format=json&bibkeys=ISBN:${key}`;
  const [data, details] = await Promise.all([
    core.netJson(`${base}&jscmd=data`, { retries: 1, timeout: CONFIG.net.timeoutMs }),
    core.netJson(`${base}&jscmd=details`, { retries: 1, timeout: CONFIG.net.timeoutMs }),
  ]);
  const d = data?.[`ISBN:${key}`] ?? null;
  const det = details?.[`ISBN:${key}`]?.details ?? null;
  return d || det ? { data: d, details: det } : null;
}

// ── normalising ─────────────────────────────────────────────────────────────
const ORDINALS = {
  first: "1st", second: "2nd", third: "3rd", fourth: "4th", fifth: "5th",
  sixth: "6th", seventh: "7th", eighth: "8th", ninth: "9th", tenth: "10th",
};
const ORDINAL_WORDS = Object.keys(ORDINALS).join("|");
const EDITION_WORD = "(?:edition|edn\\b|ed\\b\\.?|aufl)";

const ordinal = (n) =>
  n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th");

/**
 * "Second edition" / "2nd ed." / "2. Aufl." → "2nd". A title or subtitle
 * only says which edition it is next to the word "edition" — "A First Course
 * in Probability" is not a first edition, "Python 3" not a third. Open
 * Library's edition_name is about nothing else, so it is read `loose`.
 */
function normalizeEdition(raw, { loose = false } = {}) {
  const s = core.squish(raw).toLowerCase();
  if (!s) return null;
  const word = s.match(new RegExp(`\\b(${ORDINAL_WORDS})\\s+${EDITION_WORD}`))
    ?? (loose ? s.match(new RegExp(`\\b(${ORDINAL_WORDS})\\b`)) : null);
  if (word) return ORDINALS[word[1]];
  const digits = s.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\.?\\s*${EDITION_WORD}`))
    ?? (loose ? s.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/) : null);
  if (digits) {
    const n = Number(digits[1]);
    return n >= 1 && n <= 40 ? ordinal(n) : null;
  }
  return /revised/.test(s) && (loose || /revised\s+edition/.test(s)) ? "revised" : null;
}

/**
 * "Reinforcement Learning, second edition" → "Reinforcement Learning"; the
 * edition has its own key. A subtitle that is nothing but "Second Edition"
 * comes back null.
 */
const withoutEdition = (title) =>
  core.squish(String(title ?? "").replace(
    new RegExp(`(?:^|[,:(\\s]+)(?:\\d{1,2}(?:st|nd|rd|th)?|${ORDINAL_WORDS}|revised|updated|new)\\s+${EDITION_WORD}\\)?\\s*$`, "i"),
    "",
  )) || null;

/** …and a trailing "(Adaptive Computation and Machine Learning series)" goes too. */
const tidyTitle = (s) => withoutEdition(String(s ?? "").replace(/\s*\([^)]*\bseries\)\s*$/i, ""));

/**
 * Title and subtitle, tidied: the source's own subtitle field, else what
 * follows the title's first ": ".
 *   "Reinforcement Learning, second edition: An Introduction (… series)"
 *     → { title: "Reinforcement Learning", subtitle: "An Introduction" }
 */
function titleParts(fullTitle, subtitle) {
  const parts = core.splitSubtitle(fullTitle, tidyTitle(subtitle));
  return { title: tidyTitle(parts.title), subtitle: tidyTitle(parts.subtitle) };
}

function categoryOf(googleCats, olSubjects) {
  const all = [...(googleCats ?? []), ...(olSubjects ?? []).map((s) => s.name ?? s)]
    .map((c) => String(c).toLowerCase());
  if (!all.length) return null;
  if (all.some((c) => /\bnon-?fiction\b/.test(c))) return "non-fiction";
  if (all.some((c) => /\bfiction\b/.test(c))) return "fiction";
  return "non-fiction";     // technical shelves (Computers, Mathematics, …) are all non-fiction
}

function blurbOf(google, ol) {
  const raw = google?.volumeInfo?.description
    ?? (typeof ol?.details?.description === "string" ? ol.details.description : ol?.details?.description?.value)
    ?? null;
  let text = core.stripHtml(raw);
  if (!text) return null;

  // Open Library blurbs are transcribed from jackets and keep the artifacts:
  // wrapping quotes, a trailing "--Publisher description", source lines.
  text = text
    .replace(/\s*--\s*(publisher|provided by publisher|back cover|jacket)?[^.]*$/i, "")
    .replace(/^["“]+/, "").replace(/["”]+\s*$/, "")
    .replace(/\s*\(source of description\)[\s\S]*$/i, "")
    .trim();
  if (!text) return null;
  if (text.length <= 700) return text;
  const cut = text.slice(0, 700);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return stop > 300 ? cut.slice(0, stop + 1) : cut.trimEnd() + "…";
}

// ── collect ─────────────────────────────────────────────────────────────────
async function collectBook(input, noteTitle, step = () => { }) {
  let ids = identifiers(input);
  const notes = [];

  // A Kindle ASIN: the Amazon page for the print ISBN, or at least a title.
  let amazon = null;
  if (!ids.isbn13 && !ids.isbn10 && ids.asin) {
    step("reading the Amazon page");
    amazon = await fetchAmazon(ids.asin);
    if (amazon?.isbn) ids = { ...identifiers({ isbn: amazon.isbn }), asin: ids.asin };
  }

  // Search by title only on a real one: never by "Untitled".
  const title = searchableTitle(amazon?.title) ?? (core.isPlaceholder(noteTitle) ? null : noteTitle);
  if (!ids.isbn13 && !ids.isbn10 && !title) {
    return {
      ok: false,
      reason: "this ASIN carries no ISBN and Amazon would not say which book it is — paste the ISBN instead",
      notes,
    };
  }

  step("asking Google Books and Open Library");
  const [google, ol] = await Promise.all([fetchGoogle({ ...ids, title }), fetchOpenLibrary(ids)]);
  if (!google && !ol) return { ok: false, reason: "Google Books and Open Library both came up empty", notes };

  const gi = google?.volumeInfo ?? {};
  // Open Library's `data` record can stop at the first author; `details` has them all.
  const authors = core.uniq([
    ...(gi.authors ?? []),
    ...((ol?.data?.authors ?? []).map((a) => a.name)),
    ...((ol?.details?.authors ?? []).map((a) => a.name)),
  ]);

  const industry = gi.industryIdentifiers ?? [];
  const isbn13 = ids.isbn13 ?? industry.find((x) => x.type === "ISBN_13")?.identifier ?? null;
  const isbn10 = ids.isbn10 ?? industry.find((x) => x.type === "ISBN_10")?.identifier ?? null;
  // Open Library often carries the real ASIN outright, which beats deriving it.
  const olAsin = ol?.data?.identifiers?.amazon?.[0] ?? null;
  const fullTitle = core.squish(gi.title ?? ol?.data?.title) || null;
  const parts = titleParts(fullTitle, gi.subtitle ?? ol?.data?.subtitle);

  return {
    ok: true,
    notes,
    asin: ids.asin ?? olAsin ?? isbn10,
    title: parts.title,
    subtitle: parts.subtitle,
    authors,
    publisher: core.squish(gi.publisher ?? ol?.data?.publishers?.[0]?.name) || null,
    published: core.isoDate(gi.publishedDate) ?? core.isoDate(ol?.data?.publish_date) ?? null,
    pages: gi.pageCount || ol?.data?.number_of_pages || ol?.details?.number_of_pages || null,
    edition: normalizeEdition(ol?.details?.edition_name, { loose: true })
      ?? normalizeEdition(gi.subtitle) ?? normalizeEdition(fullTitle),
    category: categoryOf(gi.categories, ol?.data?.subjects),
    blurb: blurbOf(google, ol),
    isbn13, isbn10,
    olCoverId: ol?.details?.covers?.[0] ?? null,
    googleVolume: google,
  };
}

// ── assets ──────────────────────────────────────────────────────────────────
/**
 * The book's PDF, if you keep one: the one `title:` already links, else
 * "<name>.pdf" anywhere resolvable, else the only PDF in the note's own folder
 * — renamed to "<name>.pdf" unless another note links it.
 */
async function findBookPdf(file, name, fm) {
  const opts = { link: fm.title, names: [`${name}.pdf`] };
  return CONFIG.book.renamePdf ? core.claimPdf(file, name, opts) : core.findOwnPdf(file, opts);
}

async function downloadCover(meta, file, pdfFile, basename = core.assetName(file, meta.title)) {
  if (!core.netCanCrossOrigin()) return { skipped: "cover download needs desktop Obsidian" };

  const best = await covers.resolveCover({
    isbn13: meta.isbn13,
    isbn10: meta.isbn10,
    asin: meta.asin,
    olCoverId: meta.olCoverId,
    googleVolume: meta.googleVolume,
    title: meta.title ?? file.basename,
    author: meta.authors?.[0],
  });
  if (!best || best.failed) return { error: "no cover survived the size check", tried: best?.tried ?? [] };

  const folder = CONFIG.book.coverFolder
    || (CONFIG.book.coverBesidePdf && pdfFile ? core.parentFolder(pdfFile.path) : core.parentFolder(file.path));
  const saved = await core.saveBinary(folder, `${basename}.${best.ext || "jpg"}`, best.buffer, { overwrite: CONFIG.book.overwriteCover });
  return { file: saved.file, reused: saved.reused, url: best.url, width: best.width, height: best.height };
}

// ── the run ─────────────────────────────────────────────────────────────────
async function populateBook(path, input, step = () => { }) {
  const g = core.guardPath(path);
  if (!g.ok) return { ok: false, notes: [g.message] };

  return core.exclusive(g.file, async () => {
    const file = g.file;
    const asked = readInput(input);
    if (!asked) return { ok: false, notes: [`cannot read an ASIN or ISBN from "${input}"`] };

    // an ISBN already typed into the note counts too
    const before = core.frontmatterOf(file);
    const meta = await collectBook(
      { asin: asked.asin, isbn: asked.isbn ?? (core.isBlank(before.isbn) ? null : before.isbn) },
      file.basename,
      step,
    );
    if (!meta.ok) return { ok: false, notes: [meta.reason, ...(meta.notes ?? [])] };
    const notes = [...meta.notes];

    const renamed = await core.renameFromTitle(file, meta.title);
    if (renamed?.skipped) notes.push(renamed.skipped);

    const fm = core.frontmatterOf(file);
    const name = core.assetName(file, meta.title);
    const own = CONFIG.book.linkTitleToPdf ? await findBookPdf(file, name, fm) : null;
    const pdfFile = own?.file ?? null;
    if (own?.renamed) notes.push(`renamed ${own.was} to ${own.file.name}`);
    if (own?.skipped) notes.push(own.skipped);

    const values = {
      subtitle: meta.subtitle,
      author: meta.authors?.length ? meta.authors : undefined,
      edition: meta.edition,
      pages: meta.pages,
      published: meta.published,
      isbn: core.formatIsbn13(meta.isbn13) ?? meta.isbn10,
      asin: meta.asin,
      publisher: meta.publisher,
      category: meta.category,
      blurb: meta.blurb,
      ...CONFIG.book.defaults,
    };

    // `title` doubles as the link to the book file, as the book views expect.
    // A typed link may not have followed the rename, so that one is rewritten,
    // keeping its alias.
    const force = [asked.asin ? "asin" : null, "isbn"];
    if (meta.title) {
      const alias = own?.how === "linked" ? String(fm.title).match(/\|([^\]]+)\]\]/)?.[1] : null;
      values.title = pdfFile ? core.linkTo(pdfFile, file.path, alias ?? meta.title) : meta.title;
      if (own?.how === "linked" && own.renamed) force.push("title");
    }

    let cover = null;
    if (CONFIG.book.downloadCover && core.isBlank(fm.cover)) {
      step("finding the largest cover");
      cover = await downloadCover(meta, file, pdfFile, name);
      if (cover?.file) {
        values.cover = core.linkTo(cover.file, file.path, CONFIG.book.coverAlias);
        notes.push(`${cover.reused ? "reused" : "downloaded"} ${cover.file.name}`
          + (cover.width ? ` (${cover.width}×${cover.height})` : ""));
      } else {
        notes.push(cover?.error ?? cover?.skipped);
      }
    }

    step("writing properties");
    // the id the run started from is the note's, and a YAML-mangled isbn is
    // rewritten as a quoted string
    const patch = await core.patchFrontmatter(file, values, { force: force.filter(Boolean) });

    const coverMissing = CONFIG.book.downloadCover && core.isBlank(fm.cover) && !cover?.file;
    const complete = !!meta.title && !coverMissing;
    if (complete) {
      await core.finish(file, "book", MARKER);
      core.notify(`${file.basename} — ${patch.applied.length} properties filled`);
    }
    return { ok: true, complete, patch, notes };
  });
}

/** Swap the block out without a complete run — "keep it as is". */
async function keepBook(path) {
  const file = core.fileAt(path);
  if (file) await core.finish(file, "book", MARKER);
}

// ── the block ───────────────────────────────────────────────────────────────
/** The shelf's blank cloth cover, where the artwork will be. */
const CoverPlaceholder = ({ path }) => (
  <div class="hc-cover hc-fx-plain is-blank">
    <BlankCover book={{ path: path ?? "new book", name: "New book", get: () => null }} />
  </div>
);

function BookPopulate({ path }) {
  return (
    <PopulateForm
      skin="book"
      SkinStyles={Styles}
      Placeholder={CoverPlaceholder}
      path={path}
      heading="New book"
      hint="An ASIN fetches the sharpest cover; an ISBN or an Amazon link works too."
      label="ASIN"
      field="asin"
      placeholder="0262039249"
      run={populateBook}
      keep={keepBook}
    />
  );
}

return {
  BookPopulate, populateBook, keepBook, MARKER,
  readInput, identifiers, fetchAmazon, fetchGoogle, fetchOpenLibrary,
  normalizeEdition, withoutEdition, tidyTitle, titleParts, collectBook, findBookPdf, downloadCover,
};
