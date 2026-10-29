// ════════════════════════════════════════════════════════════════════════════
//  panel.jsx  —  the card a populate block draws: one box, one button
//  Location: Meta/Obsidian/_datacore/populate/panel.jsx
//
//  Drawn in the infobox's own classes — `.pcx` for a paper, `.hcx` for a book
//  — so the card stands where the infobox will, in the same type and theme
//  colours, with an empty page (paper) or a blank cloth cover (book) where the
//  PDF or the artwork is about to land. Only the form is styled here.
//
//    <PopulateForm
//      skin="paper"            "paper" | "book": whose infobox it borrows
//      SkinStyles={Styles}     that infobox's stylesheet component
//      Placeholder={…}         what stands where the page / cover will be ({ path })
//      path={path}
//      heading="New paper" hint="…"
//      label="arXiv" field="arxiv" placeholder="…"
//      run={(path, input, step) => report}
//      keep={(path) => …}      swap the block out without finishing
//    />
//
//  `run` gets `step(text)` for the line under the box and returns
//  { ok, complete, notes, patch }. A complete run has already swapped the
//  block out of the note, so the card is about to unmount. A partial one (the
//  PDF or cover could not be had) keeps it, says why, and leaves the input
//  filled, so pressing Populate again retries.
//
//  NOTE: never declare a local named `h` in this file — it is the JSX pragma.
// ════════════════════════════════════════════════════════════════════════════

const core = await dc.require("Meta/Obsidian/_datacore/populate/core.jsx");

// ── run state ───────────────────────────────────────────────────────────────
// Kept per TFile rather than in the component: writing the frontmatter makes
// Live Preview re-render the block, and the run may rename the note, so the
// card that finishes a run is not always the one that started it. The TFile
// keeps its identity through both.
const IDLE = { phase: "idle", notes: [] };
const RUNS = new WeakMap();
const WATCHERS = new Set();

function setRun(file, state) {
  RUNS.set(file, state);
  for (const fn of WATCHERS) fn(file);
}

function useRun(file) {
  const [, bump] = dc.useState(0);
  dc.useEffect(() => {
    if (!file) return;
    const fn = (f) => { if (f === file) bump((n) => n + 1); };
    WATCHERS.add(fn);
    return () => WATCHERS.delete(fn);
  }, [file]);
  return (file && RUNS.get(file)) ?? IDLE;
}

// ── the card ────────────────────────────────────────────────────────────────
function PopulateForm({
  skin = "paper", SkinStyles = null, Placeholder = null,
  path, heading, hint, label, field, placeholder, run, keep,
}) {
  const k = skin === "book" ? "hcx" : "pcx";
  const rev = dc.useIndexUpdates();
  const guard = dc.useMemo(() => core.guardPath(path), [path, rev]);
  const state = useRun(guard.file);

  // What the note already says, so a half-done run picks up where it stopped.
  const [value, setValue] = dc.useState(() => {
    const v = path ? app.metadataCache.getCache(path)?.frontmatter?.[field] : null;
    return v == null ? "" : String(v);
  });

  const busy = state.phase === "running";
  const ready = guard.ok && !busy;

  const submit = async (e) => {
    e?.preventDefault?.();
    const input = value.trim();
    const file = guard.file;
    if (!ready || !input || !file) return;
    setRun(file, { phase: "running", step: "starting", notes: [] });
    try {
      const report = await run(path, input, (text) => setRun(file, { phase: "running", step: text, notes: [] }));
      setRun(file, {
        phase: !report?.ok ? "failed" : report.complete ? "done" : "partial",
        notes: (report?.notes ?? []).filter(Boolean),
        filled: Object.keys(report?.patch?.plan ?? {}).length,
      });
    } catch (err) {
      console.error("[populate]", err);
      setRun(file, { phase: "failed", notes: [String(err?.message ?? err)] });
    }
  };

  const keepAsIs = async (e) => {
    e.preventDefault();
    if (keep) await keep(path);
  };

  const filled = state.filled
    ? `Filled ${state.filled} propert${state.filled === 1 ? "y" : "ies"}.`
    : "Nothing left to fill.";

  return (
    <>
      {SkinStyles && <SkinStyles />}
      <PanelStyles />
      <div class={`${k} pfx pfx-${skin}`}>
        {Placeholder && <Placeholder path={path} />}

        <div class={`${k}-body pfx-body`}>
          <h3 class={`${k}-title`}>{heading}</h3>
          <div class={`${k}-authors`}>{hint}</div>

          <form class="pfx-form" onSubmit={submit}>
            <span class="pfx-key">{label}</span>
            <input
              type="text"
              class="pfx-input"
              value={value}
              placeholder={placeholder}
              spellcheck={false}
              autocomplete="off"
              disabled={!ready}
              onInput={(e) => setValue(e.currentTarget.value)}
            />
            <button type="submit" class="mod-cta pfx-go" disabled={!ready || !value.trim()}>
              {busy ? "Populating…" : "Populate"}
            </button>
          </form>

          {guard.code === "template" && <div class="pfx-line is-faint">{guard.message}</div>}
          {guard.code === "no-file" && <div class="pfx-line is-faint">{guard.message}</div>}
          {busy && <div class="pfx-line is-busy">{state.step}</div>}

          {state.phase === "done" && <div class="pfx-line is-done">{filled}</div>}
          {state.phase === "partial" && <div class="pfx-line">{filled}</div>}
          {(state.phase === "failed" || state.phase === "partial") && state.notes.length > 0 && (
            <ul class={"pfx-notes" + (state.phase === "failed" ? " is-error" : "")}>
              {state.notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          )}
          {state.phase === "partial" && keep && (
            <div class="pfx-line">
              Populate again to retry, or <a href="#" class="pfx-keep" onClick={keepAsIs}>keep it as is</a>.
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── styles ──────────────────────────────────────────────────────────────────
// The card, the type and the colours are the infobox's; this is the form.
const STYLE_ID = "populate-datacore-styles";

const CSS = `
.pfx-form { display: flex; align-items: center; gap: 6px; margin-top: 10px; }
.pfx-key {
  flex: none; color: var(--text-faint);
  font-size: var(--font-ui-smaller); letter-spacing: .02em;
}
.pfx .pfx-input {
  flex: 1 1 auto; min-width: 0;
  font-family: var(--font-monospace); font-size: var(--font-ui-smaller);
}
.pfx .pfx-go {
  flex: none; cursor: pointer;
  font-size: var(--font-ui-smaller); font-weight: var(--font-medium);
}
.pfx .pfx-go:disabled { opacity: .5; cursor: default; }

.pfx-line {
  margin-top: 9px; font-size: var(--font-ui-smaller); line-height: 1.5;
  color: var(--text-muted);
}
.pfx-line.is-faint { color: var(--text-faint); font-style: italic; }
.pfx-line.is-done { color: var(--color-green); }
.pfx-line.is-busy { color: var(--text-accent); }
.pfx-line.is-busy::after { content: ""; animation: pfx-wait 1.2s steps(4, end) infinite; }
@keyframes pfx-wait { 0% { content: ""; } 25% { content: "."; } 50% { content: ".."; } 75% { content: "..."; } }

.pfx-notes {
  margin: 6px 0 0; padding-left: 1.1em;
  font-size: var(--font-ui-smaller); line-height: 1.5; color: var(--text-muted);
}
.pfx-notes.is-error { color: var(--text-error); }

/* the book infobox's link style */
.pfx a.pfx-keep {
  color: var(--text-muted) !important; text-decoration: none !important;
  border-bottom: 1px solid var(--background-modifier-border);
  transition: color .1s ease-out, border-color .1s ease-out;
}
.pfx a.pfx-keep:hover { color: var(--text-accent) !important; border-bottom-color: var(--text-accent); }

/* paper: the empty page stands where page one will, smaller than the real one */
.pcx.pfx { max-width: 640px; }
.pcx.pfx .pcx-page { width: 168px; font-size: var(--font-ui-smaller); }
.pcx.pfx .pcx-page:hover { translate: none; }
/* book: the blank cloth cover stands where the artwork will */
.hcx.pfx .hc-cover { cursor: default; }
.hcx.pfx .hc-cover:hover { translate: none; box-shadow: var(--hc-drop); }
`;

function PanelStyles() {
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

return { PopulateForm, PanelStyles, useRun };
