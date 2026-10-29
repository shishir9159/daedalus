// ════════════════════════════════════════════════════════════════════════════
//  node.jsx  —  the same tests, from a terminal
//  Location: Meta/Obsidian/_datacore/tests/node.jsx
//
//  Plain Node, no JSX in this file. It stands in for Obsidian and Datacore —
//  an in-memory vault that reads through to the real one but never writes to
//  it, a metadata cache, dc.require — compiles each module's JSX with sucrase,
//  and runs runner.jsx's suites against that.
//
//    node node.jsx              every module compiles, then the offline tests
//    node node.jsx --network    …and the end-to-end ones (arXiv, Google Books, …)
//
//  It needs sucrase, and @xmldom/xmldom for --network, installed outside the
//  vault:
//
//    npm install --prefix ~/.cache/datacore-tests sucrase @xmldom/xmldom
//    NODE_PATH=~/.cache/datacore-tests/node_modules node node.jsx --network
//
//  The stand-in renames without rewriting links, like Obsidian with
//  "Automatically update internal links" off: the stricter case.
//
//  Datacore never loads this file; it is .jsx so that the vault holds no
//  other kind of script.
// ════════════════════════════════════════════════════════════════════════════

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const VAULT = path.resolve(__dirname, "../../../..");
const DATACORE = "Meta/Obsidian/_datacore";
const NETWORK = process.argv.includes("--network");

let transform;
try { ({ transform } = require("sucrase")); }
catch {
  console.error("node.jsx needs sucrase on NODE_PATH; see the top of this file.");
  process.exit(2);
}

// ── frontmatter, as much YAML as the templates use ──────────────────────────
const FM = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

function scalar(raw) {
  const s = raw.trim();
  if (s === "" || s === "null" || s === "~") return null;
  if (/^".*"$/.test(s)) return JSON.parse(s);
  if (/^'.*'$/.test(s)) return s.slice(1, -1).replace(/''/g, "'");
  if (s === "true" || s === "false") return s === "true";
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);      // and 1706.03760 loses its zero, as in Obsidian
  if (/^\[.*\]$/.test(s)) return s.slice(1, -1).split(",").map((x) => x.trim()).filter(Boolean).map(scalar);
  return s;
}

function parseFm(text) {
  const m = FM.exec(text ?? "");
  if (!m) return null;
  const fm = {};
  let key = null;
  for (const line of m[1].split(/\r?\n/)) {
    const item = line.match(/^\s+-\s?(.*)$/);
    if (item && key) {
      if (!Array.isArray(fm[key])) fm[key] = [];
      fm[key].push(item[1].trim() === "" ? null : scalar(item[1]));
      continue;
    }
    const kv = line.match(/^([^\s#][^:]*):(?:\s+(.*))?$/);
    if (kv) { key = kv[1]; fm[key] = scalar(kv[2] ?? ""); }
  }
  return fm;
}

const quoteIfNeeded = (v) =>
  typeof v === "string" &&
    (v === "" || /^[\s[\]{}"'!&*#?|>@`%,-]|:\s|\s#|\s$/.test(v) || /^(-?\d+(\.\d+)?|true|false|null)$/.test(v))
    ? JSON.stringify(v) : String(v);

function dumpFm(fm) {
  const out = [];
  for (const [k, v] of Object.entries(fm)) {
    if (Array.isArray(v)) {
      out.push(v.length ? `${k}:` : `${k}: []`);
      for (const x of v) out.push(`  - ${quoteIfNeeded(x)}`);
    } else {
      out.push(v == null ? `${k}:` : `${k}: ${quoteIfNeeded(v)}`);
    }
  }
  return out.join("\n");
}

// ── the vault: in memory, reading through to disk ───────────────────────────
const mem = new Map();          // path → { text } | { binary }, plus disk: true if read off disk
const folders = new Set([""]);
const handles = new Map();      // path → its one file object, as Obsidian keeps one TFile per path

const parentOf = (p) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");
const onDisk = (p) => { try { return fs.statSync(path.join(VAULT, p)); } catch { return null; } };

function place(f, p) {
  f.path = p;
  f.name = p.split("/").pop();
  f.extension = f.name.includes(".") ? f.name.split(".").pop() : "";
  f.basename = f.extension ? f.name.slice(0, -f.extension.length - 1) : f.name;
  f.parent = { path: parentOf(p) || "/" };
}

function handle(p) {
  let f = handles.get(p);
  if (!f) {
    f = { stat: { mtime: Date.now(), ctime: Date.now(), size: 0 } };
    place(f, p);
    handles.set(p, f);
  }
  return f;
}

function entry(p) {
  if (mem.has(p)) return mem.get(p);
  const st = p ? onDisk(p) : null;
  if (!st?.isFile()) return null;
  const buf = fs.readFileSync(path.join(VAULT, p));
  const e = /\.(md|jsx|css|json|txt)$/i.test(p)
    ? { text: buf.toString("utf8"), disk: true }
    : { binary: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), disk: true };
  mem.set(p, e);
  return e;
}

const isFolder = (p) => folders.has(p) || !!onDisk(p)?.isDirectory();
const touch = (f) => {
  const e = mem.get(f.path);
  f.stat = { ...f.stat, mtime: Date.now(), size: e?.binary?.byteLength ?? e?.text?.length ?? 0 };
  return f;
};

const vault = {
  getAbstractFileByPath(p) {
    if (entry(p)) return handle(p);
    return isFolder(p) ? { path: p, name: p.split("/").pop(), children: [] } : null;
  },
  getRoot: () => ({ path: "/", name: "", children: [] }),
  getFiles: () => [...mem].filter(([, e]) => !e.disk).map(([p]) => handle(p)),
  async create(p, text) {
    if (entry(p)) throw new Error("File already exists.");
    mem.set(p, { text });
    return touch(handle(p));
  },
  async createBinary(p, binary) {
    if (entry(p)) throw new Error("File already exists.");
    mem.set(p, { binary });
    return touch(handle(p));
  },
  async createFolder(p) {
    if (isFolder(p)) throw new Error("Folder already exists.");
    folders.add(p);
  },
  read: async (f) => entry(f.path).text,
  cachedRead: async (f) => entry(f.path).text,
  readBinary: async (f) => entry(f.path).binary,
  async modify(f, text) { entry(f.path).text = text; touch(f); },
  async modifyBinary(f, binary) { entry(f.path).binary = binary; touch(f); },
  async process(f, fn) { const e = entry(f.path); e.text = fn(e.text); touch(f); return e.text; },
  async delete(f) {
    const under = (p) => p === f.path || p.startsWith(f.path + "/");
    for (const p of [...mem.keys()]) if (under(p)) { mem.delete(p); handles.delete(p); }
    for (const p of [...folders]) if (under(p)) folders.delete(p);
  },
  adapter: {
    exists: async (p) => !!entry(p) || isFolder(p),
    writeBinary: async (p, binary) => { mem.set(p, { binary }); },
  },
};

const metadataCache = {
  getFileCache(f) {
    const e = f ? entry(f.path) : null;
    if (!e) return null;
    const frontmatter = e.text != null ? parseFm(e.text) : null;
    return frontmatter ? { frontmatter } : {};
  },
  getCache(p) { return metadataCache.getFileCache(entry(p) ? handle(p) : null); },
  /** A path, else a name (with or without .md), nearest the source first. */
  getFirstLinkpathDest(linkpath, source = "") {
    const lp = String(linkpath ?? "").split("#")[0].trim();
    if (!lp) return null;
    for (const p of [lp, `${lp}.md`]) if (entry(p)) return handle(p);
    const hits = [...mem.keys()].filter((p) => p.endsWith("/" + lp) || p.endsWith("/" + lp + ".md"));
    const here = parentOf(source);
    const best = hits.find((p) => parentOf(p) === here) ?? hits.sort((a, b) => a.length - b.length)[0];
    return best ? handle(best) : null;
  },
  get resolvedLinks() {
    const out = {};
    for (const [p, e] of mem) {
      if (e.disk || e.text == null || !p.endsWith(".md")) continue;
      const dests = {};
      for (const m of e.text.matchAll(/\[\[([^\]|#]+)/g)) {
        const d = metadataCache.getFirstLinkpathDest(m[1], p);
        if (d) dests[d.path] = (dests[d.path] ?? 0) + 1;
      }
      out[p] = dests;
    }
    return out;
  },
  on: () => ({}),
  offref: () => { },
};

const fileManager = {
  async processFrontMatter(f, fn) {
    const e = entry(f.path);
    const fm = parseFm(e.text) ?? {};
    fn(fm);
    const m = FM.exec(e.text);
    e.text = `---\n${dumpFm(fm)}\n---\n` + (m ? e.text.slice(m[0].length) : e.text);
    touch(f);
  },
  async renameFile(f, to) {
    if (entry(to)) throw new Error("Destination file already exists!");
    const e = entry(f.path);
    mem.delete(f.path);
    handles.delete(f.path);
    mem.set(to, e);
    place(f, to);
    handles.set(to, f);
  },
  generateMarkdownLink: () => null,
};

const app = {
  vault, metadataCache, fileManager,
  workspace: { on: () => ({}), offref: () => { }, getActiveFile: () => null, openLinkText: () => { } },
};

// ── Datacore ────────────────────────────────────────────────────────────────
function compile(rel) {
  const src = fs.readFileSync(path.join(VAULT, rel), "utf8");
  const { code } = transform(src, {
    transforms: ["jsx"], jsxPragma: "h", jsxFragmentPragma: "Fragment", production: true,
  });
  return new vm.Script(`(async function (dc, app, h, Fragment) {\n${code}\n})`, { filename: path.join(VAULT, rel) });
}

const Fragment = Symbol("Fragment");
const h = (type, props, ...children) => ({ type, props: props ?? {}, children });

const modules = new Map();
const dc = {
  require(rel) {
    if (!modules.has(rel)) modules.set(rel, compile(rel).runInThisContext()(dc, app, h, Fragment));
    return modules.get(rel);
  },
  useState: (init) => [typeof init === "function" ? init() : init, () => { }],
  useEffect: () => { },
  useMemo: (fn) => fn(),
  useRef: (current) => ({ current }),
  useCallback: (fn) => fn,
  useIndexUpdates: () => 0,
  useCurrentPath: () => "",
  useQuery: () => [],
};

// what desktop Obsidian has and Node lacks
globalThis.window = globalThis;
globalThis.app = app;
globalThis.require = require;            // pdf.jsx's Node transport
globalThis.Notice = class { };           // populate's toasts, swallowed
globalThis.localStorage = { getItem: () => null, setItem: () => { }, removeItem: () => { } };
try {
  const { DOMParser } = require("@xmldom/xmldom");
  globalThis.DOMParser = class {
    parseFromString(s, type) {
      const doc = new DOMParser({ onError: () => { } }).parseFromString(s, type);
      // a browser's HTMLCollection is iterable; xmldom's NodeList is not
      const proto = Object.getPrototypeOf(doc.getElementsByTagName("x"));
      proto[Symbol.iterator] ??= function* () { for (let i = 0; i < this.length; i++) yield this[i]; };
      return doc;
    }
  };
} catch {
  if (NETWORK) {
    console.error("--network needs @xmldom/xmldom on NODE_PATH; see the top of this file.");
    process.exit(2);
  }
}

// ── the run ─────────────────────────────────────────────────────────────────
const tint = (code, s) => (process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s);

/** Every module under _datacore compiles, and none is a .js. This file is not a module. */
function compileAll() {
  const walk = (dir) => fs.readdirSync(path.join(VAULT, dir), { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]));
  let bad = 0, ok = 0;
  for (const rel of walk(DATACORE)) {
    if (/\.(js|mjs|cjs|ts|tsx)$/i.test(rel)) { bad++; console.log(tint(31, `  ✗ ${rel}: not .jsx`)); continue; }
    if (!rel.endsWith(".jsx") || rel === `${DATACORE}/tests/node.jsx`) continue;
    try { compile(rel); ok++; }
    catch (e) { bad++; console.log(tint(31, `  ✗ ${rel}\n      ${e.message}`)); }
  }
  console.log(`${bad ? tint(31, "✗") : tint(32, "✓")} ${ok} modules compile`);
  return bad;
}

(async () => {
  const t0 = Date.now();
  const bad = compileAll();
  const { runSuites } = await dc.require(`${DATACORE}/tests/runner.jsx`);

  let suite = null;
  const results = await runSuites({
    network: NETWORK,
    quietMs: 0,
    onResult(r) {
      if (r.suite !== suite) console.log(`\n${suite = r.suite}`);
      const tag = r.network ? tint(90, " [network]") : "";
      console.log(`  ${r.ok ? tint(32, "✓") : tint(31, "✗")} ${r.title}${tag} ${tint(90, `${r.ms} ms`)}`);
      if (r.error) console.log(tint(31, r.error.replace(/^/gm, "      ")));
      if (!r.ok || process.argv.includes("--verbose")) for (const l of r.logs) console.log(tint(90, `      ${l}`));
    },
  });

  const failed = results.filter((r) => !r.ok).length + bad;
  console.log(`\n${results.length - (failed - bad)} passed, ${failed} failed (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
