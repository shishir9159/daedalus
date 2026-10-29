// ════════════════════════════════════════════════════════════════════════════
//  book.jsx  —  tests for book/populate.jsx
//  Location: Meta/Obsidian/_datacore/tests/book.jsx
//
//  Run from tests/runner.jsx (inside Obsidian) or tests/node.jsx (a terminal).
//  The `network` one asks Google Books, Open Library and the cover hosts for
//  real.
// ════════════════════════════════════════════════════════════════════════════

const core = await dc.require("Meta/Obsidian/_datacore/populate/core.jsx");
const book = await dc.require("Meta/Obsidian/_datacore/book/populate.jsx");
const pdf = await dc.require("Meta/Obsidian/_datacore/pdf/pdf.jsx");

return {
  name: "book",

  tests: {
    "ASINs, ISBNs and Amazon links": (t) => {
      t.eq(book.readInput("0262039249"), { asin: "0262039249" });
      t.eq(book.readInput("978-0262039246"), { isbn: "9780262039246" });
      t.eq(book.readInput("ISBN 978 0 262 03924 6"), { isbn: "9780262039246" });
      t.eq(book.readInput("https://www.amazon.com/Reinforcement-Learning/dp/0262039249/ref=sr_1_1"), { asin: "0262039249" });
      t.eq(book.readInput("https://www.amazon.com/gp/product/B07GVB3KTG?x=1"), { asin: "B07GVB3KTG" });
      t.eq(book.readInput("b07gvb3ktg"), { asin: "B07GVB3KTG" });
      t.eq(book.readInput("nope"), null);
    },

    "every identifier from any one of them": (t) => {
      const all = { isbn10: "0262039249", isbn13: "9780262039246", asin: "0262039249" };
      t.eq(book.identifiers({ asin: "0262039249" }), all);
      t.eq(book.identifiers({ isbn: "9780262039246" }), all);
      t.eq(book.identifiers({ asin: "B07GVB3KTG" }), { isbn10: null, isbn13: null, asin: "B07GVB3KTG" });
      t.eq(book.identifiers({ isbn: 262039249 }).isbn10, "0262039249", "YAML ate the leading zero");
    },

    "an edition only beside the word edition": (t) => {
      t.eq(book.normalizeEdition("Reinforcement Learning, second edition"), "2nd");
      t.eq(book.normalizeEdition("Deep Learning, 2nd ed."), "2nd");
      t.eq(book.normalizeEdition("A First Course in Probability, 10th Edition"), "10th");
      t.eq(book.normalizeEdition("A First Course in Probability"), null);
      t.eq(book.normalizeEdition("Python 3 for Beginners"), null);
      t.eq(book.normalizeEdition("2nd", { loose: true }), "2nd", "Open Library's edition_name");
      t.eq(book.normalizeEdition("Third", { loose: true }), "3rd");
      t.eq(book.withoutEdition("Reinforcement Learning, second edition"), "Reinforcement Learning");
      t.eq(book.withoutEdition("Calculus (3rd Edition)"), "Calculus");
      t.eq(book.withoutEdition("Second Edition"), null);
      t.eq(book.withoutEdition("Deep Learning"), "Deep Learning");
    },

    "title and subtitle, tidied": (t) => {
      const parts = (title, sub) => { const p = book.titleParts(title, sub); return [p.title, p.subtitle]; };
      t.eq(parts("Reinforcement Learning, second edition", "An Introduction"), ["Reinforcement Learning", "An Introduction"]);
      t.eq(parts("Reinforcement Learning, second edition: An Introduction (Adaptive Computation and Machine Learning series)"),
        ["Reinforcement Learning", "An Introduction"], "Amazon's style: all in one");
      t.eq(parts("Reinforcement Learning: An Introduction", "An Introduction"), ["Reinforcement Learning", "An Introduction"]);
      t.eq(parts("Artificial Intelligence", "A Modern Approach, 4th Edition"), ["Artificial Intelligence", "A Modern Approach"]);
      t.eq(parts("Calculus", "Second Edition"), ["Calculus", null], "a subtitle that only names the edition");
      t.eq(parts("Deep Learning"), ["Deep Learning", null]);
    },

    "the book's PDF is found and renamed after the note": async (t) => {
      const note = await t.note("Reinforcement Learning.md", "---\ntitle:\n---\n");
      const scan = `${t.unique("scan")}.pdf`;
      const file = await t.pdf(scan);
      const got = await book.findBookPdf(note, "Reinforcement Learning", {});
      t.eq([got.how, got.was, got.renamed], ["alone", scan, true]);
      t.eq(file.path, t.path("Reinforcement Learning.pdf"));
    },
  },

  network: {
    "an ISBN: renamed, PDF renamed and linked, cover beside it, block swapped": async (t) => {
      const note = await t.note(`${t.unique("Untitled")}.md`, await t.template("STEM Book.md"));
      await t.pdf(`${t.unique("scan")}.pdf`, 548);
      const r = await book.populateBook(note.path, "0262039249", (s) => t.log(s));
      for (const n of r.notes ?? []) t.log("· " + n);
      const fm = await t.fm(note);
      const text = await t.read(note);

      t.eq([r.ok, r.complete], [true, true]);
      t.eq(note.path, t.path("Reinforcement Learning.md"));
      t.eq(fm.subtitle, "An Introduction");
      t.ok(fm.author?.some((a) => /Barto/.test(a)), `authors ${JSON.stringify(fm.author)}`);
      t.eq([fm.isbn, fm.asin], ["978-0262039246", "0262039249"]);
      t.eq(pdf.resolvePdf(fm.title, note.path)?.path, t.path("Reinforcement Learning.pdf"), "title links the renamed PDF");
      t.ok(/\|Reinforcement Learning\]\]$/.test(fm.title), `title alias: ${fm.title}`);
      const cover = app.metadataCache.getFirstLinkpathDest(pdf.parseLink(fm.cover), note.path);
      t.eq(cover?.path?.replace(/\.\w+$/, ""), t.path("Reinforcement Learning"), "cover beside the note");
      t.ok(text.includes("book/infobox.jsx") && !text.includes("book/populate.jsx"), "block swapped");
    },
  },
};
