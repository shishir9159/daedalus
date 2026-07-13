# .testbed — running the paper views outside Obsidian

A dot-folder, so Obsidian ignores it.

Two harnesses. They exist because three rounds of "the click does nothing"
could not be diagnosed by reading the code: the handler was correct the whole
time and the pointer was never reaching it.

```bash
npm install
```

## 1a. The abstract parser — `node abstract.test.mjs`

Pure, no DOM. `findAbstract` takes lines with a `y` each and stops at the first
paragraph break, which is a gap on the page rather than a word to search for.
The fixtures are hand-built page layouts: a heading on its own line, an
`Abstract—` opening with the first sentence beside it, a letter-spaced
`A B S T R A C T`, two paragraphs, a paper with no `Introduction` heading at
all, and a word broken across a line.

## 1. Behaviour — `node drawers.test.mjs`

Mounts the real `paper/drawers.jsx` under Preact with happy-dom and a fake
vault of eight papers, then clicks things and asserts on the result. Catches
logic bugs: state that does not stick, an effect that undoes what you just did,
a word that should not be on screen.

It found the drawer re-opening itself — every way of shutting a drawer set
`open` to null, and the "open the first drawer" effect pulled it straight back
out on the next pass.

What it cannot see: layout. happy-dom has no box model, so a click dispatched
at an element always lands on it.

## 2. Layout and hit testing — `node build-preview.mjs`

Bundles every module into one self-contained `preview.html` with the same fake
vault. Open it in a browser and use the console:

```js
mount('drawers', 'medieval', 'scroll')   // view, design, leaf face
probeLeaves()      // is each leaf actually reachable by a pointer?
clickLeaf(0)
probeOverlay()     // the reading panel's real geometry
queueText()
```

`probeLeaves` is the one that mattered. It reports `document.elementFromPoint`
at the centre of every leaf, and it was returning `.pvd-row` — the tray behind
the paper, which has no handler on it. `transform-style: preserve-3d` on
`.pvd-drawer` was flattening its descendants out of the hit test; every leaf
has a transform, a filter and a running animation, so every leaf was a
composited layer and every leaf dropped out.

Note that `document.elementsFromPoint` (plural) still listed the leaf. That
call penetrates `pointer-events`, and a real pointer does not — which is why
the element looked reachable in every check that used it.

## The fake vault

`env.mjs` and `env-browser.js` carry the same eight papers: two with identical
tag sets (the mirror-twins case), one with declared `builds-on` and `related`,
one with no venue at all, one already marked up so it reads as being read.
Edit them together or the two harnesses stop agreeing.
