// ════════════════════════════════════════════════════════════════════════════
//  populate.jsx  —  a new paper note, filled in from its arXiv id
//  Location: Meta/Obsidian/_datacore/paper/populate.jsx
//
//  The Paper template carries this block and every property, empty:
//
//    ```datacorejsx
//    const { PaperPopulate } = await dc.require("Meta/Obsidian/_datacore/paper/populate.jsx");
//    return function View() { return <PaperPopulate path={dc.useCurrentPath()} />; };
//    ```
//
//  Paste an arXiv id or link (1706.03762, arXiv:1706.03762v7, an abs / pdf /
//  alphaxiv / Hugging Face URL) and press Populate:
//
//    1. arXiv, Semantic Scholar and OpenAlex are asked for the metadata
//    2. the title is split at its first ": " — "BERT: Pre-training of …" is
//       `title: BERT` with the rest as `subtitle` — and a note still called
//       "Untitled" is renamed after the title; the infobox reads its heading
//       off the filename and the subtitle off `subtitle:`
//    3. the PDF becomes `<note>.pdf`. One already there — the one `paper:`
//       links, one named after the arXiv id (arXiv's own 1706.03762v7.pdf),
//       or the only PDF in the note's own folder — is renamed; otherwise it is
//       downloaded through pdf.jsx's fetchArxivPdf, the same call the
//       infobox's Update button uses
//    4. every empty property that can be known is filled; nothing already
//       typed is overwritten
//    5. this block swaps itself for the paper infobox
//
//  `arxiv-version` records which version was downloaded. That is what the
//  infobox compares against arXiv to offer its "Update to vN" button, so it is
//  only written when the PDF came from arXiv — or, for a PDF that was already
//  there, when its old name said (1706.03762v5.pdf).
//
//  If the PDF could not be had, the block stays and says why; pressing
//  Populate again retries.
//
//  Sources, in precedence order per field:
//    arXiv Atom API   title, authors, published (v1 date), version, comment, doi
//    Semantic Scholar venue, venue kind, citations, doi, tldr → claim, oa pdf
//    OpenAlex         affiliations, venue / citation fallback, page range
//
//  Only Semantic Scholar and OpenAlex send CORS headers; arXiv needs
//  requestUrl or Node, so on mobile the arXiv leg and the PDF are skipped.
//
//  Tuning: Meta/Obsidian/_datacore/populate/config.jsx.
//
//  NOTE: never declare a local named `h` in this file — it is the JSX pragma.
// ════════════════════════════════════════════════════════════════════════════

const core = await dc.require("Meta/Obsidian/_datacore/populate/core.jsx");
const { PopulateForm } = await dc.require("Meta/Obsidian/_datacore/populate/panel.jsx");
const { Styles } = await dc.require("Meta/Obsidian/_datacore/paper/infobox.jsx");

const { CONFIG } = core;
const MARKER = "paper/populate.jsx";

// ── the arXiv id ────────────────────────────────────────────────────────────
/**
 * 1706.03762, arXiv:1706.03762v7, https://arxiv.org/abs/1706.03762,
 * …/pdf/1706.03762v7.pdf, the old cs.CL/9901001 style — and, failing those,
 * a modern id anywhere in the text (alphaxiv, huggingface.co/papers, a DOI).
 */
function parseArxivId(raw) {
  if (raw == null) return null;
  const text = String(raw).trim();
  const s = text
    .replace(/^arxiv[:\s]*/i, "")
    .replace(/^(?:https?:\/\/)?(?:www\.|export\.)?arxiv\.org\/(?:abs|pdf|html)\//i, "")
    .replace(/\.pdf$/i, "");
  const m = s.match(/^((?:\d{4}\.\d{4,5})|(?:[a-z-]+(?:\.[A-Z]{2})?\/\d{7}))(?:v(\d+))?/i)
    ?? text.match(/(?<!\d)(\d{4}\.\d{4,5})(?:v(\d+))?(?!\d)/);
  if (!m) return null;
  return { id: m[1], version: m[2] ? Number(m[2]) : null, raw: text };
}

/**
 * YAML reads `arxiv: 1706.03760` as the number 1706.0376 and eats the trailing
 * zero. A modern id with fewer than 4 (or 5) fractional digits is retried with
 * zero padding.
 */
function arxivIdVariants(id) {
  const out = [id];
  const m = id.match(/^(\d{4})\.(\d{1,5})$/);
  if (m && m[2].length < 5) {
    if (m[2].length < 4) out.push(`${m[1]}.${m[2].padEnd(4, "0")}`);
    out.push(`${m[1]}.${m[2].padEnd(5, "0")}`);
  }
  return core.uniq(out);
}

// ── arXiv ───────────────────────────────────────────────────────────────────
const ARXIV_NS = "http://arxiv.org/schemas/atom";

function nsText(el, local, ns) {
  const byNs = el.getElementsByTagNameNS?.(ns, local);
  if (byNs?.length) return core.squish(byNs[0].textContent);
  const byName = el.getElementsByTagName(local);
  if (byName?.length) return core.squish(byName[0].textContent);
  return null;
}

async function fetchArxiv(id) {
  const url = `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}&max_results=1`;
  // arXiv sends no CORS headers
  const res = await core.netGet(url, { crossOrigin: true, retries: CONFIG.net.retries, timeout: CONFIG.net.timeoutMs });
  if (!res?.text || res.status >= 400) return null;

  const doc = new DOMParser().parseFromString(res.text, "text/xml");
  const entry = doc.getElementsByTagName("entry")[0];
  if (!entry) return null;

  const title = core.squish(entry.getElementsByTagName("title")[0]?.textContent);
  if (!title || /^error$/i.test(title)) return null;

  const authors = [];
  for (const a of entry.getElementsByTagName("author")) {
    const n = core.squish(a.getElementsByTagName("name")[0]?.textContent);
    if (n) authors.push(n);
  }

  const idUrl = core.squish(entry.getElementsByTagName("id")[0]?.textContent);
  const vm = idUrl?.match(/v(\d+)\s*$/);

  const cats = [];
  for (const c of entry.getElementsByTagName("category")) {
    const t = c.getAttribute("term");
    if (t) cats.push(t);
  }

  return {
    id,
    title,
    authors,
    abstract: core.squish(entry.getElementsByTagName("summary")[0]?.textContent),
    published: core.isoDate(entry.getElementsByTagName("published")[0]?.textContent),
    updated: core.isoDate(entry.getElementsByTagName("updated")[0]?.textContent),
    version: vm ? Number(vm[1]) : null,
    doi: nsText(entry, "doi", ARXIV_NS),
    journalRef: nsText(entry, "journal_ref", ARXIV_NS),
    comment: nsText(entry, "comment", ARXIV_NS),
    categories: core.uniq(cats),
  };
}

// ── Semantic Scholar ────────────────────────────────────────────────────────
const S2_FIELDS = [
  "title", "abstract", "venue", "publicationVenue", "year", "publicationDate",
  "externalIds", "citationCount", "openAccessPdf",
  "authors.name", "authors.affiliations", "tldr", "publicationTypes", "journal",
].join(",");

async function fetchSemanticScholar(arxivId) {
  const url = `https://api.semanticscholar.org/graph/v1/paper/arXiv:${arxivId}?fields=${S2_FIELDS}`;
  const headers = CONFIG.net.semanticScholarApiKey ? { "x-api-key": CONFIG.net.semanticScholarApiKey } : undefined;
  // sends CORS headers, so this leg works on mobile too
  const json = await core.netJson(url, { headers, retries: CONFIG.net.retries, timeout: CONFIG.net.timeoutMs });
  return json && !json.error ? json : null;
}

// ── OpenAlex ────────────────────────────────────────────────────────────────
/**
 * `year` is arXiv's: OpenAlex merges records loosely, and the arXiv DOI of
 * "Attention Is All You Need" resolves to a 2025 work. A record more than a
 * year before or three after the preprint is someone else's.
 */
async function fetchOpenAlex({ arxivId, doi, title, year = null }) {
  const tail = CONFIG.net.openAlexMailto ? `&mailto=${encodeURIComponent(CONFIG.net.openAlexMailto)}` : "";
  const tries = [];
  if (doi) tries.push(`https://api.openalex.org/works/doi:${encodeURIComponent(doi)}?x=1${tail}`);
  if (arxivId) tries.push(`https://api.openalex.org/works/doi:${encodeURIComponent(`10.48550/arxiv.${arxivId}`)}?x=1${tail}`);
  if (title) {
    tries.push(`https://api.openalex.org/works?per-page=1&filter=title.search:${encodeURIComponent(title.replace(/[,:]/g, " "))}${tail}`);
  }

  for (const url of tries) {
    const json = await core.netJson(url, { retries: 1, timeout: CONFIG.net.timeoutMs });
    const work = json?.id ? json : json?.results?.[0];
    if (!work) continue;
    if (title && work.display_name) {
      const a = core.normTitle(title).replace(/ /g, "");
      const b = core.normTitle(work.display_name).replace(/ /g, "");
      if (!a.startsWith(b.slice(0, 20)) && !b.startsWith(a.slice(0, 20))) continue;
    }
    const y = Number(work.publication_year);
    if (year && y && (y < year - 1 || y > year + 3)) continue;
    return work;
  }
  return null;
}

// ── normalising ─────────────────────────────────────────────────────────────
function normalizeVenue(rawName, hintKind) {
  const name = core.squish(rawName);
  if (!name) return { venue: null, kind: hintKind ?? null };
  for (const [re, canonical, kind] of CONFIG.venueAliases) {
    if (re.test(name)) return { venue: canonical, kind: hintKind ?? kind };
  }
  return { venue: name, kind: hintKind ?? null };
}

/**
 * OpenAlex indexes the arXiv preprint as its own work, so primary_location is
 * usually the repository even for a NeurIPS paper. Look through every location
 * for a real journal or conference first.
 */
function openAlexVenue(work) {
  const locs = [work?.primary_location, ...(work?.locations ?? [])].filter(Boolean);
  for (const l of locs) {
    const s = l.source;
    if (!s?.display_name) continue;
    if (s.type === "repository" || /\barxiv\b|preprint|repositor/i.test(s.display_name)) continue;
    return { name: s.display_name, type: String(s.type ?? "").toLowerCase() };
  }
  return null;
}

function venueKindFrom(s2, oaVenue, openalex, journalRef) {
  const t = String(s2?.publicationVenue?.type ?? "").toLowerCase();
  if (t.includes("conference")) return "conference";
  if (t.includes("journal")) return "journal";
  if (t.includes("workshop")) return "workshop";

  const types = (s2?.publicationTypes ?? []).map((x) => String(x).toLowerCase());
  if (types.includes("conference")) return "conference";
  if (types.includes("journalarticle")) return "journal";

  if (oaVenue?.type === "conference") return "conference";
  if (oaVenue?.type === "journal") return "journal";
  if (!oaVenue && String(openalex?.type ?? "") === "preprint") return "preprint";

  return journalRef ? "journal" : null;
}

/** "15 pages, 5 figures", or a page range like "5998-6008". */
function pagesFrom(arxiv, s2, openalex) {
  const m = String(arxiv?.comment ?? "").match(/(\d+)\s*pages?/i);
  if (m) return Number(m[1]);

  const range = s2?.journal?.pages
    ?? [openalex?.biblio?.first_page, openalex?.biblio?.last_page].filter(Boolean).join("-");
  const rm = String(range ?? "").match(/^(\d+)\s*[-–]+\s*(\d+)$/);
  if (rm) {
    const n = Number(rm[2]) - Number(rm[1]) + 1;
    if (n > 0 && n < 2000) return n;
  }
  return null;
}

/** Authors often park the repo in the abstract or the arXiv comment. */
function codeUrlFrom(...texts) {
  for (const t of texts) {
    const m = String(t ?? "").match(/https?:\/\/(?:www\.)?github\.com\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+/);
    if (m) return m[0].replace(/[.,);\]]+$/, "").replace(/\.git$/, "");
  }
  return null;
}

/**
 * OpenAlex is the only source that reliably has institutions, but it hands
 * back the current disambiguated org with the country tagged on: "Google" and
 * "Google (United States)" are one place. The parenthetical goes, duplicates
 * go, and the list is capped — the noisiest field of the lot.
 */
function affiliationsFrom(s2, openalex) {
  const out = [];
  for (const a of s2?.authors ?? []) for (const aff of a.affiliations ?? []) out.push(aff);
  for (const a of openalex?.authorships ?? []) {
    for (const inst of a.institutions ?? []) if (inst.display_name) out.push(inst.display_name);
    if (!out.length) for (const raw of a.raw_affiliation_strings ?? []) out.push(raw);
  }
  const cleaned = out.map((s) => core.squish(String(s).replace(/\s*\([^)]*\)\s*$/, "")));
  return core.uniq(cleaned).slice(0, CONFIG.paper.maxAffiliations ?? 6);
}

// ── collect ─────────────────────────────────────────────────────────────────
async function collectPaper(parsed, step = () => { }) {
  const notes = [];
  let arxiv = null, id = parsed.id;

  step("asking arXiv");
  for (const candidate of arxivIdVariants(parsed.id)) {
    arxiv = await fetchArxiv(candidate);
    if (arxiv) { id = candidate; break; }
  }
  if (!arxiv) {
    notes.push(core.netCanCrossOrigin()
      ? `arXiv returned nothing for ${parsed.id}`
      : "arXiv needs desktop Obsidian; using Semantic Scholar only");
  } else if (id !== parsed.id) {
    notes.push(`recovered id ${id}: YAML had eaten a trailing zero`);
  }

  step("asking Semantic Scholar");
  const s2 = await fetchSemanticScholar(id);
  if (!s2) notes.push("Semantic Scholar unavailable (offline or rate-limited)");

  step("asking OpenAlex");
  const doi = s2?.externalIds?.DOI ?? arxiv?.doi ?? null;
  const title = arxiv?.title ?? s2?.title ?? null;
  const openalex = await fetchOpenAlex({ arxivId: id, doi, title, year: core.yearOf(arxiv?.published) });

  if (!arxiv && !s2 && !openalex) return { ok: false, reason: "every metadata source failed", notes };

  const authors = core.uniq(
    arxiv?.authors?.length
      ? arxiv.authors
      : (s2?.authors ?? []).map((a) => a.name)
        .concat((openalex?.authorships ?? []).map((a) => a.author?.display_name)),
  );

  const oaVenue = openAlexVenue(openalex);
  const rawVenue = s2?.publicationVenue?.name ?? s2?.venue ?? oaVenue?.name ?? arxiv?.journalRef ?? null;
  let { venue, kind } = normalizeVenue(rawVenue, venueKindFrom(s2, oaVenue, openalex, arxiv?.journalRef));

  // "arXiv / preprint" is only trustworthy when Semantic Scholar answered and
  // still found no venue; without it a NeurIPS paper would be mislabelled
  // because OpenAlex only knows the preprint record.
  if (venue === "arXiv" && !s2) venue = null;
  if (!venue && !s2) {
    notes.push("venue left blank: without Semantic Scholar a published venue cannot be ruled out");
    kind = null;
  }

  // Same trap for citations: OpenAlex's preprint record undercounts badly
  // (ResNet reads ~5k there against ~200k on the published record).
  let citations = Number.isFinite(s2?.citationCount) ? s2.citationCount : null;
  if (citations === null && openalex && openalex.type !== "preprint") citations = openalex.cited_by_count ?? null;
  else if (citations === null && openalex) notes.push("citations left blank: only OpenAlex's preprint record was reachable");

  const published = arxiv?.published ?? core.isoDate(s2?.publicationDate) ?? core.isoDate(openalex?.publication_date);
  // the venue's year when Semantic Scholar knows it, else the preprint's
  const year = s2?.year ?? core.yearOf(arxiv?.published) ?? openalex?.publication_year ?? core.yearOf(published);

  return {
    ok: true,
    notes,
    id,
    // the version asked for, else arXiv's latest — what a plain /pdf/<id> serves
    version: parsed.version ?? arxiv?.version ?? null,
    title,
    authors,
    affiliation: affiliationsFrom(s2, openalex),
    venue,
    venueKind: kind,
    year,
    published,
    doi: doi ?? `10.48550/arXiv.${id}`,
    citations,
    pages: pagesFrom(arxiv, s2, openalex),
    claim: CONFIG.paper.claimFromTldr && s2?.tldr?.text ? core.squish(s2.tldr.text) : null,
    code: codeUrlFrom(arxiv?.abstract, arxiv?.comment, s2?.abstract),
    openAccessPdf: s2?.openAccessPdf?.url || openalex?.best_oa_location?.pdf_url || null,
  };
}

// ── the PDF ─────────────────────────────────────────────────────────────────
/**
 * arXiv first (the version asked for, or the latest), then the open-access
 * copy Semantic Scholar / OpenAlex know of. `version` is set only when the
 * bytes came from arXiv, since only then is it known which one they are.
 */
async function downloadPdf(meta, file, basename = core.assetName(file, meta.title)) {
  if (!core.netCanCrossOrigin()) return { skipped: "PDF download needs desktop Obsidian" };

  const reasons = [];
  let got = await core.fetchArxivPdf(meta.id, meta.version);
  let fromArxiv = got.ok;
  if (!got.ok) {
    reasons.push(got.reason);
    if (meta.openAccessPdf && !/arxiv\.org/i.test(meta.openAccessPdf)) {
      got = await core.fetchPdf(meta.openAccessPdf, { crossOrigin: true });
      if (!got.ok) reasons.push(got.reason);
    }
  }
  if (!got.ok) return { error: `no PDF: ${reasons.join("; ")}` };

  const folder = CONFIG.paper.pdfFolder || core.parentFolder(file.path);
  const saved = await core.saveBinary(folder, `${basename}.pdf`, got.buf, { overwrite: CONFIG.paper.overwritePdf });
  return {
    file: saved.file,
    reused: saved.reused,
    version: fromArxiv && !saved.reused ? meta.version : null,
    pages: core.pdfPageCount(got.buf),
  };
}

/** "1706.03762v5.pdf" → 5: which version a PDF already in the vault is, if its name says. */
function versionIn(name, id) {
  const m = String(name ?? "").match(new RegExp(`(?<![\\d.])${core.escapeRe(id)}v(\\d+)`, "i"));
  return m ? Number(m[1]) : null;
}

// ── the run ─────────────────────────────────────────────────────────────────
async function populatePaper(path, input, step = () => { }) {
  const g = core.guardPath(path);
  if (!g.ok) return { ok: false, notes: [g.message] };

  return core.exclusive(g.file, async () => {
    const file = g.file;
    const parsed = parseArxivId(input);
    if (!parsed) return { ok: false, notes: [`cannot read an arXiv id from "${input}"`] };

    const meta = await collectPaper(parsed, step);
    if (!meta.ok) return { ok: false, notes: [meta.reason, ...(meta.notes ?? [])] };
    const notes = [...meta.notes];

    // the note is named after the title alone; the subtitle has its own key
    const { title, subtitle } = core.splitSubtitle(meta.title);
    const renamed = await core.renameFromTitle(file, title);
    if (renamed?.skipped) notes.push(renamed.skipped);

    const fm = core.frontmatterOf(file);
    const values = {
      title,
      subtitle,
      author: meta.authors?.length ? meta.authors : undefined,
      affiliation: meta.affiliation?.length ? meta.affiliation : undefined,
      venue: meta.venue,
      "venue-kind": meta.venueKind,
      year: meta.year,
      published: meta.published,
      arxiv: meta.id,
      doi: meta.doi,
      citekey: core.makeCitekey(meta.authors, meta.year, meta.title),
      citations: meta.citations,
      pages: meta.pages,
      claim: meta.claim,
      code: meta.code,
      ...CONFIG.paper.defaults,
    };

    // The PDF first, so `paper` lands in the same single frontmatter write: one
    // already here is renamed after the note, otherwise one is downloaded.
    // The id the run started from is the note's id, however it was typed.
    // A `paper:` typed by hand names the PDF: if it resolves to nothing, no
    // other PDF is touched.
    const force = ["arxiv"];
    const pdfName = core.assetName(file, title);
    let pdfRes = null;
    const own = CONFIG.paper.renamePdf && (core.isBlank(fm.paper) || core.resolvePdf(fm.paper, file.path))
      ? await core.claimPdf(file, pdfName, { link: fm.paper, match: (f) => f.basename.includes(meta.id) })
      : null;
    if (own) {
      pdfRes = own;
      values.paper = core.linkTo(own.file, file.path);
      // a typed link may not have followed the rename
      if (own.how === "linked" && own.renamed) force.push("paper");
      const v = versionIn(own.was, meta.id);
      if (v) values["arxiv-version"] = `v${v}`;
      if (!values.pages) values.pages = core.pdfPageCount(await app.vault.readBinary(own.file));
      notes.push(own.renamed ? `renamed ${own.was} to ${own.file.name}` : `kept ${own.file.name}`);
      if (own.skipped) notes.push(own.skipped);
    } else if (CONFIG.paper.downloadPdf && core.isBlank(fm.paper)) {
      step("downloading the PDF");
      pdfRes = await downloadPdf(meta, file, pdfName);
      if (pdfRes?.file) {
        values.paper = core.linkTo(pdfRes.file, file.path);
        if (pdfRes.version) {
          values["arxiv-version"] = `v${pdfRes.version}`;
          force.push("arxiv-version");
        }
        if (!values.pages && pdfRes.pages) values.pages = pdfRes.pages;
        notes.push(`${pdfRes.reused ? "reused" : "downloaded"} ${pdfRes.file.name}`);
      } else {
        notes.push(pdfRes?.error ?? pdfRes?.skipped);
      }
    }

    step("writing properties");
    const patch = await core.patchFrontmatter(file, values, { force });

    const pdfMissing = CONFIG.paper.downloadPdf && core.isBlank(fm.paper) && !pdfRes?.file;
    const complete = !!meta.title && !pdfMissing;
    if (complete) {
      await core.finish(file, "paper", MARKER);
      core.notify(`${file.basename} — ${patch.applied.length} properties filled`);
    }
    return { ok: true, complete, patch, notes };
  });
}

/** Swap the block out without a complete run — "keep it as is". */
async function keepPaper(path) {
  const file = core.fileAt(path);
  if (file) await core.finish(file, "paper", MARKER);
}

// ── the block ───────────────────────────────────────────────────────────────
/** The infobox's empty page, smaller, where page one will be. */
const PagePlaceholder = () => (
  <div class="pcx-sheet">
    <div class="pcx-page pcx-empty">page one lands here</div>
  </div>
);

function PaperPopulate({ path }) {
  return (
    <PopulateForm
      skin="paper"
      SkinStyles={Styles}
      Placeholder={PagePlaceholder}
      path={path}
      heading="New paper"
      hint="An arXiv id or link. Title, authors, venue, citations, the claim and the PDF follow."
      label="arXiv"
      field="arxiv"
      placeholder="1706.03762"
      run={populatePaper}
      keep={keepPaper}
    />
  );
}

return {
  PaperPopulate, populatePaper, keepPaper, MARKER,
  parseArxivId, arxivIdVariants, fetchArxiv, fetchSemanticScholar, fetchOpenAlex,
  normalizeVenue, collectPaper, downloadPdf, versionIn,
};
