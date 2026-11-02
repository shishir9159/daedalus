// ════════════════════════════════════════════════════════════════════════════
//  paper.jsx  —  tests for paper/populate.jsx, the galleries' tags, and the
//                infobox's arXiv update
//  Location: Meta/Obsidian/_datacore/tests/paper.jsx
//
//  Run from tests/runner.jsx (inside Obsidian) or tests/node.jsx (a terminal).
//  The `network` ones ask arXiv, Semantic Scholar and OpenAlex for real.
// ════════════════════════════════════════════════════════════════════════════

const core = await dc.require("Meta/Obsidian/_datacore/populate/core.jsx");
const paper = await dc.require("Meta/Obsidian/_datacore/paper/populate.jsx");
const pdf = await dc.require("Meta/Obsidian/_datacore/pdf/pdf.jsx");
const { paperTags } = await dc.require("Meta/Obsidian/_datacore/paper/core.jsx");

/** A note made from the Paper template, populated from `input`. */
async function populated(t, input, { pdfs = [] } = {}) {
  const note = await t.note(`${t.unique("Untitled")}.md`, await t.template("Paper.md"));
  for (const name of pdfs) await t.pdf(name);
  const r = await paper.populatePaper(note.path, input, (s) => t.log(s));
  for (const n of r.notes ?? []) t.log("· " + n);
  return { note, r, fm: await t.fm(note), text: await t.read(note) };
}

return {
  name: "paper",

  tests: {
    "arXiv ids, however they are pasted": (t) => {
      const id = (s) => { const p = paper.parseArxivId(s); return p && [p.id, p.version]; };
      t.eq(id("1706.03762"), ["1706.03762", null]);
      t.eq(id("arXiv:1706.03762v7"), ["1706.03762", 7]);
      t.eq(id("https://arxiv.org/abs/1706.03762"), ["1706.03762", null]);
      t.eq(id("https://arxiv.org/pdf/1706.03762v5.pdf"), ["1706.03762", 5]);
      t.eq(id("arxiv.org/html/2401.12345v2"), ["2401.12345", 2]);
      t.eq(id("https://huggingface.co/papers/2401.12345"), ["2401.12345", null]);
      t.eq(id("https://www.alphaxiv.org/abs/2310.06825v1"), ["2310.06825", 1]);
      t.eq(id("10.48550/arXiv.1706.03762"), ["1706.03762", null]);
      t.eq(id("cs.CL/9901001"), ["cs.CL/9901001", null]);
      t.eq(id(1706.0376), ["1706.0376", null]);
      t.eq(paper.arxivIdVariants("1706.0376"), ["1706.0376", "1706.03760"]);
      t.eq(id("hello"), null);
    },

    "the version in arXiv's own file name": (t) => {
      t.eq(paper.versionIn("1706.03762v5.pdf", "1706.03762"), 5);
      t.eq(paper.versionIn("1706.03762.pdf", "1706.03762"), null);
      t.eq(paper.versionIn("1706.037621v5.pdf", "1706.0376"), null, "a longer id is another paper");
      t.eq(paper.versionIn("Attention Is All You Need.pdf", "1706.03762"), null);
    },

    "galleries: #paper always, and every tag listed": (t) => {
      t.eq(paperTags(), ["paper"]);
      t.eq(paperTags([]), ["paper"]);
      t.eq(paperTags("transformer"), ["paper", "transformer"]);
      t.eq(paperTags(["#transformer", "nlp", "Paper", "nlp"]), ["paper", "transformer", "nlp"]);
    },

    "a note in Templates is never populated": async (t) => {
      const r = await paper.populatePaper("Meta/Obsidian/Templates/Paper.md", "1706.03762");
      t.eq(r.ok, false);
      t.ok(/template/.test(r.notes[0]), r.notes[0]);
    },
  },

  network: {
    "an arXiv link: renamed, PDF downloaded, block swapped": async (t) => {
      const { note, r, fm, text } = await populated(t, "https://arxiv.org/abs/1706.03762");
      t.eq([r.ok, r.complete], [true, true]);
      t.eq(note.path, t.path("Attention Is All You Need.md"));
      t.eq([fm.title, fm.arxiv, fm.doi], ["Attention Is All You Need", "1706.03762", "10.48550/arXiv.1706.03762"]);
      t.ok(core.isBlank(fm.subtitle), "no colon, no subtitle");
      t.ok(fm.author?.includes("Ashish Vaswani"), "authors");
      t.ok(/^v\d+$/.test(fm["arxiv-version"]), `arxiv-version ${fm["arxiv-version"]}`);
      const file = pdf.resolvePdf(fm.paper, note.path);
      t.eq(file?.path, t.path("Attention Is All You Need.pdf"));
      t.ok((await app.vault.readBinary(file)).byteLength > 500000, "a real PDF");
      t.ok(text.includes("paper/infobox.jsx") && !text.includes("paper/populate.jsx"), "block swapped");
    },

    "BERT: subtitle split, arXiv's own PDF renamed instead of downloaded": async (t) => {
      const was = `${t.unique("1810.04805v2")}.pdf`;
      const { note, r, fm } = await populated(t, "1810.04805", { pdfs: [was] });
      t.eq([r.ok, r.complete], [true, true]);
      t.eq(note.path, t.path("BERT.md"));
      t.eq(fm.title, "BERT");
      t.eq(fm.subtitle, "Pre-training of Deep Bidirectional Transformers for Language Understanding");
      t.eq(fm["arxiv-version"], "v2", "read off the old file name");
      const file = pdf.resolvePdf(fm.paper, note.path);
      t.eq(file?.path, t.path("BERT.pdf"));
      t.ok((await app.vault.readBinary(file)).byteLength < 1000, "the PDF that was there, not a download");
      t.eq(core.fileAt(t.path(was)), null, "old name gone");
    },

    "the infobox's Update button: a newer version is found and fetched": async (t) => {
      const latest = await pdf.arxivLatestVersion("1706.03762");
      t.ok(latest >= 7, `latest ${latest}`);
      const old = await t.pdf("A.pdf");
      const r = await pdf.replaceArxivPdf(old, "1706.03762", latest, { haveVersion: 1 });
      t.ok(r.ok, r.reason);
      t.eq(r.backup, t.path("A.v1.pdf.bk"));
      t.ok((await app.vault.readBinary(old)).byteLength > 500000, "the new version is in place");
    },
  },
};
