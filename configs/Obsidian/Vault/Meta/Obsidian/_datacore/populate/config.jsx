// ════════════════════════════════════════════════════════════════════════════
//  config.jsx  —  one place to tune the populate blocks
//  Location: Meta/Obsidian/_datacore/populate/config.jsx
//
//  Read by populate/core.jsx, paper/populate.jsx, book/populate.jsx and
//  book/covers.jsx.
//
//  NOTE: Datacore evaluates a required file as a function body, not an ES
//  module. Exports are the object returned at the bottom.
// ════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  // ── safety ──────────────────────────────────────────────────────────────
  /** Notes under these folders are inert: no writes, no downloads, no swap. */
  inertFolders: ["Meta/Obsidian/Templates"],

  /** Note names that mean "not named yet" (prefix match, case-insensitive). */
  placeholderTitles: ["Untitled"],

  /** A note still under a placeholder name is renamed after what it holds,
   *  so the PDF / cover land under a real name. The paper infobox reads its
   *  heading off the filename, so for papers this matters. */
  renameUntitled: true,

  /** Only fill keys the note already has. The templates ship every key, and
   *  this is what keeps their order: leave it false. */
  addMissingKeys: false,

  /** Once a run is complete, swap the populate block for the infobox.
   *  false just removes it. */
  swapForInfobox: true,

  /** "vault" honours your Obsidian link settings; "wikilink" always [[...]]. */
  linkStyle: "wikilink",

  // ── network ─────────────────────────────────────────────────────────────
  // Requests go through pdf.jsx's netGet: requestUrl or Node on desktop, plain
  // fetch on mobile, where only hosts that send CORS headers can be reached.
  net: {
    timeoutMs: 20000,
    retries: 2,
    /** Free, optional, lifts Semantic Scholar's shared rate limit. */
    semanticScholarApiKey: "",
    /** Optional. The anonymous Google Books quota is shared and does run out
     *  (HTTP 429); a free key from console.cloud.google.com fixes it. Without
     *  one, Open Library is the fallback. */
    googleBooksApiKey: "",
    /** OpenAlex "polite pool": your email gets faster, saner limits. Left
     *  empty on purpose, since it is sent to a third party on every lookup. */
    openAlexMailto: "",
  },

  // ── paper ───────────────────────────────────────────────────────────────
  paper: {
    /** "" = beside the note. Otherwise a vault-absolute folder. */
    pdfFolder: "",
    downloadPdf: true,
    overwritePdf: false,
    /** A PDF already there — the one `paper:` links, one named after the
     *  arXiv id, or the only PDF in the note's own folder — is renamed after
     *  the paper and linked instead of downloading a second copy. */
    renamePdf: true,
    /** Filled only when the key is present and empty. */
    defaults: { status: "planned" },
    /** Trust Semantic Scholar's TLDR model for `claim`. */
    claimFromTldr: true,
    /** OpenAlex affiliations are current-employer-ish and occasionally wrong.
     *  0 leaves `affiliation` to you. */
    maxAffiliations: 6,
  },

  // ── book ────────────────────────────────────────────────────────────────
  book: {
    /** "" = beside the note. */
    coverFolder: "",
    /** If the book's PDF is found, the cover goes beside the PDF instead:
     *  Books/Sutton/{Reinforcement Learning}.{pdf,jpg} */
    coverBesidePdf: true,
    downloadCover: true,
    overwriteCover: false,
    /** Alias in the cover wikilink. */
    coverAlias: "Cover Image",
    /** With the book's PDF found — "<Note Title>.pdf" anywhere, or the only
     *  PDF in the note's own folder — `title` links to it. */
    linkTitleToPdf: true,
    /** …and a PDF found by being the only one there is renamed after the book. */
    renamePdf: true,
    /** Stop probing cover candidates once one is at least this tall. */
    goodEnoughHeight: 1200,
    /** Reject anything smaller: catches Amazon / Open Library placeholder pixels. */
    minWidth: 260,
    minBytes: 3000,
    /** With only a Kindle ASIN (no ISBN in it), read the Amazon page for the
     *  ISBN and title. Best effort: Amazon sometimes answers with a captcha. */
    readAmazonPage: true,
    defaults: { status: "planned" },
  },

  // ── venue normalisation ─────────────────────────────────────────────────
  /** [pattern, canonical name, kind]. First match wins. */
  venueAliases: [
    [/neural information processing|\bneurips\b|\bnips\b/i, "NeurIPS", "conference"],
    [/international conference on machine learning|\bicml\b/i, "ICML", "conference"],
    [/international conference on learning representations|\biclr\b/i, "ICLR", "conference"],
    [/computer vision and pattern recognition|\bcvpr\b/i, "CVPR", "conference"],
    [/international conference on computer vision|\biccv\b/i, "ICCV", "conference"],
    [/european conference on computer vision|\beccv\b/i, "ECCV", "conference"],
    [/association for computational linguistics|^acl\b/i, "ACL", "conference"],
    [/empirical methods in natural language processing|\bemnlp\b/i, "EMNLP", "conference"],
    [/north american chapter.*computational linguistics|\bnaacl\b/i, "NAACL", "conference"],
    [/\baaai\b/i, "AAAI", "conference"],
    [/\bijcai\b/i, "IJCAI", "conference"],
    [/knowledge discovery and data mining|\bkdd\b/i, "KDD", "conference"],
    [/\bsiggraph\b/i, "SIGGRAPH", "conference"],
    [/\buai\b/i, "UAI", "conference"],
    [/artificial intelligence and statistics|\baistats\b/i, "AISTATS", "conference"],
    [/journal of machine learning research|\bjmlr\b/i, "JMLR", "journal"],
    [/transactions on machine learning research|\btmlr\b/i, "TMLR", "journal"],
    [/transactions of the association for computational linguistics|\btacl\b/i, "TACL", "journal"],
    [/transactions on pattern analysis|\btpami\b/i, "TPAMI", "journal"],
    [/^nature\b/i, "Nature", "journal"],
    [/^science\b/i, "Science", "journal"],
    [/\barxiv\b|corr abs/i, "arXiv", "preprint"],
  ],
};

return { CONFIG };
