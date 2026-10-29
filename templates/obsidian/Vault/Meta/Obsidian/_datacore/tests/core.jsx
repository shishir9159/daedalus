// ════════════════════════════════════════════════════════════════════════════
//  core.jsx  —  tests for populate/core.jsx
//  Location: Meta/Obsidian/_datacore/tests/core.jsx
//
//  Run from tests/runner.jsx (inside Obsidian) or tests/node.jsx (a terminal).
// ════════════════════════════════════════════════════════════════════════════

const core = await dc.require("Meta/Obsidian/_datacore/populate/core.jsx");

const MARKER = "paper/populate.jsx";

return {
  name: "populate/core",

  tests: {
    "ISBN checksums, both forms, and the zero YAML ate": (t) => {
      t.eq(core.isbnCheckOk("0262039249"), true);
      t.eq(core.isbnCheckOk("0262039248"), false);
      t.eq(core.normalizeIsbn("0262039249"), { isbn10: "0262039249", isbn13: "9780262039246" });
      t.eq(core.normalizeIsbn("978-0262039246"), { isbn10: "0262039249", isbn13: "9780262039246" });
      t.eq(core.recoverIsbn(262039249), "0262039249");
      t.eq(core.formatIsbn13("9780262039246"), "978-0262039246");
    },

    "citekeys and file names": (t) => {
      t.eq(core.makeCitekey(["Ashish Vaswani"], 2017, "Attention Is All You Need"), "vaswani2017attention");
      t.eq(core.makeCitekey(["Ludwig van Beethoven"], 1808, "On the Fifth"), "vanbeethoven1808fifth");
      t.eq(core.sanitizeFileName("BERT: Pre-training / of [x]"), "BERT Pre-training of x");
    },

    "a subtitle is what follows the first colon": (t) => {
      t.eq(core.splitSubtitle("BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding"),
        { title: "BERT", subtitle: "Pre-training of Deep Bidirectional Transformers for Language Understanding" });
      t.eq(core.splitSubtitle("Attention Is All You Need"), { title: "Attention Is All You Need", subtitle: null });
      t.eq(core.splitSubtitle("Mamba: Linear-Time Sequence Modeling: with Selective State Spaces"),
        { title: "Mamba", subtitle: "Linear-Time Sequence Modeling: with Selective State Spaces" });
      t.eq(core.splitSubtitle("Re:Zero"), { title: "Re:Zero", subtitle: null }, "no space, no split");
      // a source's own subtitle field wins, and comes off the title if repeated there
      t.eq(core.splitSubtitle("Reinforcement Learning", "An Introduction"),
        { title: "Reinforcement Learning", subtitle: "An Introduction" });
      t.eq(core.splitSubtitle("Deep Learning: Foundations and Concepts", "Foundations and Concepts"),
        { title: "Deep Learning", subtitle: "Foundations and Concepts" });
      t.eq(core.splitSubtitle(null), { title: null, subtitle: null });
    },

    "the populate block swaps itself for the infobox": async (t) => {
      const tpl = await t.template("Paper.md");
      const note = await t.note("Untitled.md", tpl);
      t.eq(await core.finish(note, "paper", MARKER), 1);
      const after = await t.read(note);
      t.ok(!after.includes(MARKER), "populate block gone");
      t.ok(after.includes('dc.require("Meta/Obsidian/_datacore/paper/infobox.jsx")'), "infobox block in");
      t.ok(after.includes("<Infobox path={dc.useCurrentPath()} />"), "infobox renders the note");
      t.ok(after.startsWith("---\ntitle:\nsubtitle:\n"), "frontmatter untouched");

      // a second finish finds nothing to swap and leaves the infobox alone
      t.eq(await core.finish(note, "paper", MARKER), 0);
      t.eq(await t.read(note), after);

      // a note that already has an infobox loses the populate block, no second infobox
      const both = await t.note("Both.md", tpl + "\n" + after.slice(after.indexOf("```datacorejsx")));
      await core.finish(both, "paper", MARKER);
      t.eq(((await t.read(both)).match(/infobox\.jsx/g) ?? []).length, 1);

      // CRLF notes too
      const crlf = await t.note("Crlf.md", tpl.replace(/\n/g, "\r\n"));
      t.eq(await core.finish(crlf, "paper", MARKER), 1);
    },

    "patchFrontmatter fills blanks, keeps what is typed, forced keys win": async (t) => {
      const note = await t.note("P.md", "---\ntitle:\ntier: S\narxiv: 1706.0376\nauthor:\n  - \"\"\n---\nbody\n");
      const r = await core.patchFrontmatter(note,
        { title: "T", tier: "A", arxiv: "1706.03760", author: ["A B"], venue: "X" },
        { force: ["arxiv"] });
      t.eq(r.applied.sort(), ["arxiv", "author", "title"]);
      t.eq(r.skipped.map(([k]) => k).sort(), ["tier", "venue"]);
      const fm = await t.fm(note);
      t.eq([fm.title, fm.tier, String(fm.arxiv), fm.author], ["T", "S", "1706.03760", ["A B"]]);
      t.ok(!("venue" in fm), "a key the note lacks is not added");
      t.ok((await t.read(note)).endsWith("body\n"), "the body is kept");
    },

    "only an Untitled note is renamed, and never over another": async (t) => {
      const u = await t.note(`${t.unique("Untitled")}.md`, "");
      t.eq((await core.renameFromTitle(u, "BERT: Pre-training of Deep Bidirectional Transformers")).to,
        t.path("BERT - Pre-training of Deep Bidirectional Transformers.md"));
      t.eq(u.basename, "BERT - Pre-training of Deep Bidirectional Transformers");
      t.eq(await core.renameFromTitle(u, "Something else"), null, "a named note keeps its name");

      const v = await t.note("Untitled.md", "");
      await t.note("Taken.md", "");
      t.ok((await core.renameFromTitle(v, "Taken")).skipped, "Taken.md already exists");
      t.eq(v.basename, "Untitled");
    },

    "templates are inert": (t) => {
      t.eq(core.guardPath("Meta/Obsidian/Templates/Paper.md").code, "template");
      t.eq(core.guardPath("Meta/Obsidian/Templates/STEM Book.md").code, "template");
      t.eq(core.guardPath("Nowhere/At all.md").code, "no-file");
    },

    "the only PDF in the note's own folder is claimed and renamed": async (t) => {
      const note = await t.note("Attention Is All You Need.md", "---\npaper:\n---\n");
      const was = `${t.unique("1706.03762v5")}.pdf`;
      const pdf = await t.pdf(was);
      const got = await core.claimPdf(note, "Attention Is All You Need", {});
      t.eq([got.how, got.was, got.renamed, got.skipped], ["alone", was, true, null]);
      t.eq(pdf.path, t.path("Attention Is All You Need.pdf"));
      // claimed again, it is already named right
      t.eq((await core.claimPdf(note, "Attention Is All You Need", {})).renamed, false);
    },

    "a shared folder needs a name match; another note's PDF is never claimed": async (t) => {
      const note = await t.note("A.md", "---\npaper:\n---\n");
      await t.note("B.md", "");
      await t.pdf("one.pdf");
      await t.pdf("A.pdf");
      t.eq(core.findOwnPdf(note), null, "two notes here: not the template's empty folder");
      t.eq(core.findOwnPdf(note, { names: ["A.pdf"] })?.how, "named");

      // C links one.pdf, so it is C's
      const one = core.fileAt(t.path("one.pdf"));
      await t.note("C.md", `[[${one.path}]]`);
      const got = await core.claimPdf(note, "Mine", { link: `[[${one.path}]]` });
      t.eq([got.how, got.shared, got.renamed], ["linked", true, false]);
      t.ok(/another note links it/.test(got.skipped), got.skipped);
      t.eq(one.name, "one.pdf");
    },

    "the note's own folder beats a same-named PDF elsewhere": async (t) => {
      // a name no real vault holds, so Obsidian's resolver has one candidate
      const names = ["Zzyzx Field Guide.pdf"];
      const far = await t.pdf("far/Zzyzx Field Guide.pdf");
      const note = await t.note("here/Zzyzx Field Guide.md", "");
      const near = await t.pdf("here/scan-0042.pdf");
      t.eq(core.findOwnPdf(note, { names })?.file.path, near.path);
      // with nothing beside it, the one elsewhere still counts
      const bare = await t.note("bare/Zzyzx Field Guide.md", "");
      t.eq(core.findOwnPdf(bare, { names })?.file.path, far.path);
    },

    "an asset is named after the note, or the title while it is still Untitled": async (t) => {
      const named = await t.note("Reinforcement Learning.md", "");
      t.eq(core.assetName(named, "Anything"), "Reinforcement Learning");
      const untitled = await t.note("Untitled.md", "");
      t.eq(core.assetName(untitled, "BERT"), "BERT");
    },
  },
};
