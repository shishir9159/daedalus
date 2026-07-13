// findAbstract works on LINES with a y each, because a paragraph break is a
// gap on the page and nothing else. These are hand-built page layouts.
import { requireFile } from "./env.mjs";

const { findAbstract } = await requireFile("Meta/Obsidian/_datacore/paper/core.jsx");

let fails = 0;
const ok = (label, cond, extra = "") => {
  console.log(`${cond ? "  ok  " : "  FAIL"}  ${label}${extra ? "  — " + extra : ""}`);
  if (!cond) fails++;
};

/** Lay text out down a page: each entry is [text, gapAbove]. */
function page(rows, top = 700) {
  let y = top;
  return rows.map(([text, gap = 12]) => { y -= gap; return { y, text }; });
}

const P1 =
  "The dominant sequence transduction models are based on complex recurrent or " +
  "convolutional neural networks that include an encoder and a decoder. The best " +
  "performing models also connect the encoder and decoder through an attention " +
  "mechanism. We propose a new simple network architecture, the Transformer.";
const P2 =
  "Experiments on two machine translation tasks show these models to be superior " +
  "in quality while being more parallelizable and requiring significantly less " +
  "time to train, reaching 28.4 BLEU on WMT 2014 English-to-German.";

/* Only the FIRST line of a paragraph carries the larger gap — that is what a
   paragraph break is on a page. Setting it on every line would be a change of
   leading, not a break, and would move the median the detector measures. */
const asLines = (s, lead = 12) =>
  s.match(/.{1,60}(\s|$)/g).map((t, i) => [t.trim(), i === 0 ? lead : 12]);

console.log("\n== a heading on its own line, one paragraph");
{
  const lines = page([
    ["Attention Is All You Need", 30],
    ["Ashish Vaswani, Noam Shazeer", 20],
    ["Abstract", 34],
    ...asLines(P1),
    ["1  Introduction", 30],
    ["Recurrent neural networks have firmly established themselves", 12],
  ]);
  const got = findAbstract(lines);
  ok("found it", !!got);
  ok("starts at the abstract", got?.startsWith("The dominant sequence"), got?.slice(0, 34));
  ok("does not run into the body", !/Recurrent neural networks/.test(got ?? ""));
  ok("does not swallow the heading", !/Introduction/.test(got ?? ""));
}

console.log("\n== two paragraphs — the first one only");
{
  const lines = page([
    ["Abstract", 34],
    ...asLines(P1),
    ...asLines(P2, 26),                  // 26 > 12 * 1.5: a paragraph break
    ["1  Introduction", 30],
  ]);
  const got = findAbstract(lines);
  ok("found it", !!got);
  ok("keeps paragraph one", /simple network architecture/.test(got ?? ""));
  ok("stops at the paragraph break", !/Experiments on two machine/.test(got ?? ""),
    (got ?? "").slice(-46));
}

console.log("\n== no Introduction heading at all — the gap still stops it");
{
  const lines = page([
    ["Abstract", 34],
    ...asLines(P1),
    ...asLines("Section one begins here with something else entirely and carries on.", 26),
  ]);
  const got = findAbstract(lines);
  ok("stops without a heading to go on", !/Section one begins/.test(got ?? ""));
}

console.log("\n== the IEEE style, first sentence on the heading line");
{
  const lines = page([
    ["Abstract—" + P1.slice(0, 70), 34],
    ...asLines(P1.slice(70)),
    ["Index Terms—transformers, attention", 26],
  ]);
  const got = findAbstract(lines);
  ok("keeps the inline opening", got?.startsWith("The dominant sequence"), got?.slice(0, 30));
  ok("drops the Index Terms", !/Index Terms/.test(got ?? ""));
}

console.log("\n== letter-spaced heading");
{
  const lines = page([["A B S T R A C T", 34], ...asLines(P1), ["1. Introduction", 30]]);
  ok("still found", !!findAbstract(lines));
}

console.log("\n== a word broken across a line is one word");
{
  const lines = page([
    ["Abstract", 34],
    ["We introduce a new architecture for sequence transduc-", 12],
    ["tion that removes recurrence entirely and relies instead on", 12],
    ["attention, which we show is sufficient on its own for this.", 12],
  ]);
  const got = findAbstract(lines);
  ok("rejoins the hyphen", /transduction that/.test(got ?? ""), got?.slice(30, 70));
}

console.log("\n== not an abstract at all");
{
  ok("no heading anywhere", findAbstract(page([["Introduction", 20], ["Some text here", 12]])) === null);
  ok("a heading with nothing under it", findAbstract(page([["Abstract", 20], ["Fig. 1", 12]])) === null);
}

console.log(`\n${fails === 0 ? "ALL PASS" : fails + " FAILURE(S)"}\n`);
process.exit(fails ? 1 : 0);
