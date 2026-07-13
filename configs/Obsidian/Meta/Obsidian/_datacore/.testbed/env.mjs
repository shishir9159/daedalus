// A Datacore-shaped sandbox: happy-dom for the document, Preact for the
// renderer, a fake vault for the data. Enough to mount the real .jsx files
// unmodified and click on them.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transformSync } from "@babel/core";
import { Window } from "happy-dom";

// .testbed lives inside the folder it is testing.
const VAULT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PREFIX = "Meta/Obsidian/_datacore/";

// ── DOM ─────────────────────────────────────────────────────────────────────
const win = new Window({ url: "https://localhost/", width: 1600, height: 1000 });
for (const k of [
  "window", "document", "navigator", "HTMLElement", "Element", "Node", "Event",
  "MouseEvent", "KeyboardEvent", "CustomEvent", "getComputedStyle", "requestAnimationFrame",
  "cancelAnimationFrame", "setTimeout", "clearTimeout", "setInterval", "clearInterval",
  "localStorage", "CSS", "SVGElement", "Text", "DocumentFragment", "Image",
]) {
  if (win[k] === undefined) continue;
  try { globalThis[k] = win[k]; } catch { /* node owns this one; leave it */ }
}
globalThis.window = win;
globalThis.document = win.document;
globalThis.IntersectionObserver = class {
  constructor(cb) { this.cb = cb; }
  observe() { this.cb([{ isIntersecting: true }]); }
  disconnect() {}
  unobserve() {}
};
globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
globalThis.devicePixelRatio = 1;

const { h, Fragment, render } = await import("preact");
const hooks = await import("preact/hooks");
globalThis.h = h;
globalThis.Fragment = Fragment;

// ── the fake vault ──────────────────────────────────────────────────────────
// Six papers: two topics, one relation chain, one pair with identical tags,
// one with no venue at all, one already marked up.
export const PAPERS = [
  {
    path: "Papers/Attention Is All You Need.md",
    fm: {
      author: ["A. Vaswani", "N. Shazeer", "N. Parmar"],
      affiliation: ["Google Brain", "Google Research"],
      venue: "NeurIPS", year: 2017, citations: 188791, tier: "S+++",
      status: "reading", pages: 15, progress: 9, highlights: 41, figure: 3,
      tags: ["paper", "transformer", "attention"],
      paper: "[[attention.pdf]]",
      "builds-on": ["[[Neural Machine Translation]]"],
      related: ["[[Layer Normalization]]"],
      claim: "Attention alone, no recurrence.",
    },
  },
  {
    path: "Papers/Layer Normalization.md",
    fm: {
      author: ["J. Ba", "J. Kiros", "G. Hinton"], affiliation: ["University of Toronto"],
      venue: "arXiv", year: 2016, citations: 9000, tier: "A",
      tags: ["paper", "transformer", "attention"],
      paper: "[[layernorm.pdf]]",
    },
  },
  {
    path: "Papers/Neural Machine Translation.md",
    fm: {
      author: ["D. Bahdanau"], affiliation: ["Jacobs University"],
      year: 2015, citations: 30000, tags: ["paper", "attention"],
    },
  },
  {
    path: "Papers/Deep Residual Learning.md",
    fm: {
      author: ["K. He"], affiliation: ["MSRA"], venue: "CVPR", year: 2016,
      citations: 200000, tags: ["paper", "vision"], status: "planned",
    },
  },
  {
    path: "Papers/An Image Is Worth 16x16 Words.md",
    fm: {
      author: ["A. Dosovitskiy"], affiliation: ["Google"], year: 2021,
      citations: 40000, tags: ["paper", "vision"], status: "planned",
    },
  },
  {
    path: "Papers/A Paper With No Venue.md",
    fm: { author: ["X. Nobody"], tags: ["paper", "vision"] },
  },
];

const byPath = new Map(PAPERS.map((p) => [p.path, p]));

const fakeFile = (p) => ({
  path: p, name: p.split("/").pop(), extension: p.split(".").pop(),
  stat: { mtime: 1700000000000, size: 1000 },
});

globalThis.app = {
  metadataCache: {
    getCache: (p) => (byPath.has(p) ? { frontmatter: byPath.get(p).fm, tags: [] } : null),
    getFirstLinkpathDest: (link, src) => {
      const bare = String(link).replace(/\.md$/, "");
      for (const p of PAPERS) if (p.path.replace(/\.md$/, "").endsWith(bare)) return fakeFile(p.path);
      if (/\.pdf$/i.test(link)) return fakeFile("PDFs/" + link);
      return null;
    },
  },
  vault: {
    getAbstractFileByPath: (p) => (byPath.has(p) ? fakeFile(p) : null),
    readBinary: async () => new ArrayBuffer(8),
    adapter: { exists: async () => false },
  },
  workspace: {
    openLinkText: (...a) => { globalThis.__opened.push(a); },
    getActiveFile: () => null,
  },
  fileManager: { processFrontMatter: async () => {} },
};
globalThis.__opened = [];

// ── dc ──────────────────────────────────────────────────────────────────────
const modules = new Map();

async function requireFile(rel) {
  if (modules.has(rel)) return modules.get(rel);
  const file = path.join(VAULT, rel.startsWith(PREFIX) ? rel.slice(PREFIX.length) : rel);
  const src = fs.readFileSync(file, "utf8");
  // Datacore evaluates a required file as an async FUNCTION BODY — top-level
  // `return` and `await` are legal, `import`/`export` are not. Parse it the
  // same way, so a file that only works as a module fails here too.
  const { code } = transformSync(src, {
    filename: file,
    sourceType: "script",
    parserOpts: { allowReturnOutsideFunction: true, allowAwaitOutsideFunction: true },
    presets: [["@babel/preset-react", {
      runtime: "classic", development: false, pragma: "h", pragmaFrag: "Fragment",
    }]],
    configFile: false, babelrc: false,
  });
  const fn = new Function("dc", "app", "h", "Fragment", `return (async () => { ${code} })();`);
  const mod = await fn(dc, globalThis.app, h, Fragment);
  modules.set(rel, mod);
  return mod;
}

export const dc = {
  require: requireFile,
  useState: hooks.useState,
  useEffect: hooks.useEffect,
  useLayoutEffect: hooks.useLayoutEffect,
  useMemo: hooks.useMemo,
  useCallback: hooks.useCallback,
  useRef: hooks.useRef,
  useReducer: hooks.useReducer,
  useContext: hooks.useContext,
  useIndexUpdates: () => 0,
  useCurrentPath: () => "Notes/Drawers.md",
  useCurrentFile: () => null,
  useQuery: () => PAPERS.map((p) => ({ $path: p.path })),
  useFullQuery: () => PAPERS.map((p) => ({ $path: p.path })),
  parseQuery: (q) => q,
  Markdown: () => null,
  Link: () => null,
};

export { h, Fragment, render, hooks, win, requireFile };
