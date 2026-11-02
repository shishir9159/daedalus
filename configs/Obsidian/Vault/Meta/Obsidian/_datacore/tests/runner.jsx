// ════════════════════════════════════════════════════════════════════════════
//  runner.jsx  —  the tests, run inside Obsidian
//  Location: Meta/Obsidian/_datacore/tests/runner.jsx
//
//  Give it a note of its own:
//
//    ```datacorejsx
//    const { Tests } = await dc.require("Meta/Obsidian/_datacore/tests/runner.jsx");
//    return function View() { return <Tests />; };
//    ```
//
//  "Run" runs every suite against this vault's own Obsidian; "Run with
//  network" adds the end-to-end ones, which populate notes from arXiv, Google
//  Books and Open Library and download a PDF and a cover. Every note and file
//  a test makes goes in a sandbox folder beside this file, deleted afterwards.
//
//  The same suites run from a terminal, against a stand-in vault: node.jsx.
//
//  A suite (core.jsx, paper.jsx, book.jsx) is a module returning
//
//    { name, tests: { "what it checks": async (t) => { … } }, network: { … } }
//
//  and `t` is:
//    t.eq(actual, expected, msg)   deep equality
//    t.ok(value, msg)
//    t.path(name)                  a path in this test's own sandbox folder
//    t.unique(base)                "base k3x9q": a name no real note links to,
//                                  for files a test renames — Obsidian updates
//                                  links to a renamed file wherever they are
//    t.note(name, text)            a note there, once Obsidian has read it
//    t.pdf(name, pages)            a tiny PDF there
//    t.fm(file)                    its frontmatter, once Obsidian has caught up
//    t.settle()                    wait for Obsidian to catch up
//    t.read(file)                  its text
//    t.template(name)              the text of Meta/Obsidian/Templates/<name>,
//                                  minus its tags
//    t.log(msg)                    a line under the test's result
//
//  NOTE: never declare a local named `h` in this file — it is the JSX pragma.
// ════════════════════════════════════════════════════════════════════════════

const core = await dc.require("Meta/Obsidian/_datacore/populate/core.jsx");

const HERE = "Meta/Obsidian/_datacore/tests";
const SUITES = ["core", "paper", "book"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── assertions ──────────────────────────────────────────────────────────────
class Failure extends Error { }

function deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length &&
    ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
}

const show = (v) => {
  try { return JSON.stringify(v); } catch { return String(v); }
};

// ── the metadata cache, caught up ───────────────────────────────────────────
/**
 * Obsidian parses a written file a moment after the write. `quiet()` resolves
 * once the cache has gone `ms` without news, and no sooner than `ms` after
 * the call. ms = 0 (the stand-in vault, which is synchronous) skips the wait.
 */
function watchCache(ms) {
  let last = Date.now();
  const bump = () => { last = Date.now(); };
  const refs = ["changed", "resolve", "resolved"].map((e) => app.metadataCache.on(e, bump));
  const quiet = () => new Promise((resolve) => {
    if (!ms) return resolve();
    const start = Date.now();
    const tick = () => {
      const now = Date.now();
      if ((now - last >= ms && now - start >= ms) || now - start > 8000) resolve();
      else setTimeout(tick, 50);
    };
    tick();
  });
  const stop = () => refs.forEach((r) => app.metadataCache.offref(r));
  return { quiet, stop };
}

/** A PDF of `pages` pages, as far as pdfPageCount and looksLikePdf can tell. */
function fakePdf(pages = 1) {
  const text = `%PDF-1.4\n1 0 obj\n<< /Type /Pages /Count ${pages} /Kids [] >>\nendobj\n` +
    `trailer\n<< /Root 1 0 R >>\n%%EOF\n`;
  return new TextEncoder().encode(text).buffer;
}

// ── t ───────────────────────────────────────────────────────────────────────
function makeT(folder, quiet, logs) {
  const tag = Math.random().toString(36).slice(2, 7);
  // every folder down to `path`'s own; a name may hold a subfolder ("far/x.pdf")
  const ready = async (path) => {
    const parts = core.parentFolder(path).split("/");
    for (let i = 1; i <= parts.length; i++) await core.ensureFolder(parts.slice(0, i).join("/"));
  };

  const t = {
    eq(actual, expected, msg) {
      if (!deepEqual(actual, expected)) {
        throw new Failure(`${msg ? msg + ": " : ""}got ${show(actual)}, expected ${show(expected)}`);
      }
    },
    ok(value, msg) {
      if (!value) throw new Failure(msg ?? `expected something truthy, got ${show(value)}`);
    },
    path: (name) => `${folder}/${name}`,
    unique: (base) => `${base} ${tag}`,
    async note(name, text) {
      await ready(t.path(name));
      const file = await app.vault.create(t.path(name), text);
      // a new file has no cache entry until Obsidian has read it
      for (let i = 0; i < 150 && !app.metadataCache.getFileCache(file); i++) await sleep(20);
      await quiet();
      return file;
    },
    async pdf(name, pages = 1) {
      await ready(t.path(name));
      const file = await app.vault.createBinary(t.path(name), fakePdf(pages));
      await quiet();
      return file;
    },
    async fm(file) {
      await quiet();
      return core.frontmatterOf(file);
    },
    settle: () => quiet(),
    read: (file) => app.vault.read(file),
    // without its tags, so a sandbox note never turns up in a gallery or on a shelf
    async template(name) {
      const file = core.fileAt(`Meta/Obsidian/Templates/${name}`);
      if (!file) throw new Failure(`no template called ${name}`);
      return (await app.vault.read(file)).replace(/^tags:[^\n]*\n(?:[ \t]+-[^\n]*\n)*/m, "");
    },
    log: (msg) => { logs.push(String(msg)); },
  };
  return t;
}

// ── the run ─────────────────────────────────────────────────────────────────
/**
 * Every suite in order, each test in a sandbox folder of its own; the sandbox
 * goes once the run is over, pass or fail. → [{ suite, title, network, ok,
 * error, logs, ms }]
 */
async function runSuites({ network = false, quietMs = 400, onResult = () => { } } = {}) {
  const sandbox = `${HERE}/sandbox-${Date.now().toString(36)}`;
  const { quiet, stop } = watchCache(quietMs);
  const results = [];
  const record = (r) => { results.push(r); onResult(r, results); };
  let n = 0;

  try {
    for (const name of SUITES) {
      let suite;
      try { suite = await dc.require(`${HERE}/${name}.jsx`); }
      catch (e) {
        record({ suite: name, title: "loads", network: false, ok: false, error: String(e?.stack ?? e), logs: [], ms: 0 });
        continue;
      }
      const cases = [
        ...Object.entries(suite.tests ?? {}),
        ...(network ? Object.entries(suite.network ?? {}).map(([k, fn]) => [k, fn, true]) : []),
      ];
      for (const [title, fn, net] of cases) {
        const logs = [];
        const t = makeT(`${sandbox}/${String(++n).padStart(2, "0")}`, quiet, logs);
        const t0 = Date.now();
        let error = null;
        try { await fn(t); }
        catch (e) {
          error = e instanceof Failure ? e.message : String(e?.stack ?? e).split("\n").slice(0, 4).join("\n");
        }
        record({ suite: suite.name ?? name, title, network: !!net, ok: !error, error, logs, ms: Date.now() - t0 });
      }
    }
  } finally {
    stop();
    const root = core.fileAt(sandbox);
    if (root) await app.vault.delete(root, true);
  }
  return results;
}

// ── the view ────────────────────────────────────────────────────────────────
function Tests() {
  const [run, setRun] = dc.useState({ busy: false, network: false, results: [], ms: null });

  const go = async (withNetwork) => {
    if (run.busy) return;
    const t0 = Date.now();
    setRun({ busy: true, network: withNetwork, results: [], ms: null });
    const results = await runSuites({
      network: withNetwork,
      onResult: (_, all) => setRun((s) => ({ ...s, results: [...all] })),
    });
    setRun({ busy: false, network: withNetwork, results, ms: Date.now() - t0 });
  };

  const failed = run.results.filter((r) => !r.ok).length;
  const passed = run.results.length - failed;
  const suites = [];
  for (const r of run.results) {
    let group = suites.find((g) => g.name === r.suite);
    if (!group) suites.push(group = { name: r.suite, rows: [] });
    group.rows.push(r);
  }

  return (
    <div class="tsx">
      <TestStyles />
      <div class="tsx-bar">
        <button class="mod-cta" disabled={run.busy} onClick={() => go(false)}>
          {run.busy && !run.network ? "Running…" : "Run"}
        </button>
        <button disabled={run.busy} onClick={() => go(true)}>
          {run.busy && run.network ? "Running…" : "Run with network"}
        </button>
        {run.results.length > 0 && (
          <span class={"tsx-sum " + (failed ? "is-bad" : "is-good")}>
            {passed} passed{failed ? ` · ${failed} failed` : ""}
            {run.ms != null ? ` · ${(run.ms / 1000).toFixed(1)} s` : ""}
          </span>
        )}
      </div>
      {!run.busy && !run.results.length && (
        <div class="tsx-hint">
          The network run populates real notes in a sandbox folder and downloads a PDF and a cover; give it a minute.
        </div>
      )}
      {suites.map((g) => (
        <div class="tsx-suite">
          <div class="tsx-suite-name">{g.name}</div>
          {g.rows.map((r) => (
            <div class={"tsx-row " + (r.ok ? "is-ok" : "is-bad")}>
              <span class="tsx-mark">{r.ok ? "✓" : "✗"}</span>
              <span class="tsx-title">
                {r.title}
                {r.network && <span class="tsx-tag">network</span>}
              </span>
              <span class="tsx-ms">{r.ms} ms</span>
              {r.error && <pre class="tsx-err">{r.error}</pre>}
              {r.logs.map((l) => <div class="tsx-log">{l}</div>)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── styles ──────────────────────────────────────────────────────────────────
const STYLE_ID = "tests-datacore-styles";

const CSS = `
.tsx { font-size: var(--font-ui-small); line-height: 1.5; }
.tsx-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 10px; }
.tsx-bar button { cursor: pointer; font-size: var(--font-ui-smaller); font-weight: var(--font-medium); }
.tsx-bar button:disabled { opacity: .5; cursor: default; }
.tsx-sum { font-size: var(--font-ui-smaller); }
.tsx-sum.is-good { color: var(--color-green); }
.tsx-sum.is-bad { color: var(--text-error); }
.tsx-hint { color: var(--text-faint); font-style: italic; font-size: var(--font-ui-smaller); }

.tsx-suite { margin: 12px 0 0; }
.tsx-suite-name {
  color: var(--text-faint); font-size: var(--font-ui-smaller);
  letter-spacing: .04em; text-transform: uppercase; margin-bottom: 2px;
}
.tsx-row {
  display: grid; grid-template-columns: 1.2em 1fr auto;
  column-gap: 8px; align-items: baseline; padding: 1px 0;
}
.tsx-mark { font-weight: var(--font-bold); }
.tsx-row.is-ok .tsx-mark { color: var(--color-green); }
.tsx-row.is-bad .tsx-mark, .tsx-row.is-bad .tsx-title { color: var(--text-error); }
.tsx-tag {
  margin-left: 6px; padding: 0 5px; border-radius: 4px;
  font-size: var(--font-ui-smaller); color: var(--text-faint);
  border: 1px solid var(--background-modifier-border);
}
.tsx-ms { color: var(--text-faint); font-size: var(--font-ui-smaller); font-variant-numeric: tabular-nums; }
.tsx-err, .tsx-log { grid-column: 2 / -1; font-size: var(--font-ui-smaller); }
.tsx-err {
  margin: 2px 0 6px; padding: 6px 8px; border-radius: 4px; white-space: pre-wrap;
  color: var(--text-error); background: rgba(var(--color-red-rgb), .08);
}
.tsx-log { color: var(--text-muted); }
`;

function TestStyles() {
  dc.useEffect(() => {
    let el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement("style");
      el.id = STYLE_ID;
      document.head.appendChild(el);
    }
    if (el.textContent !== CSS) el.textContent = CSS;
  }, []);
  return null;
}

return { Tests, runSuites, SUITES, deepEqual, fakePdf };
