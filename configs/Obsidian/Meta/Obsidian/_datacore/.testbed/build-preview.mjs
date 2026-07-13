// Bundle the real .jsx files into one self-contained HTML page, so the views
// can be looked at in a real engine with real layout and real hit testing.
// The node harness dispatches clicks straight at an element; that proves the
// handler works, not that a pointer can reach it.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transformSync } from "@babel/core";

// .testbed lives inside the folder it is testing, so neither path is hardcoded.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const VAULT = path.resolve(HERE, "..");
const OUT = path.join(HERE, "preview.html");

const preact = fs.readFileSync(path.join(HERE, "node_modules/preact/dist/preact.umd.js"), "utf8");
const phooks = fs.readFileSync(path.join(HERE, "node_modules/preact/hooks/dist/hooks.umd.js"), "utf8");

const files = ["pdf/pdf.jsx", "book/core.jsx", "paper/core.jsx", "paper/drawers.jsx", "paper/views.jsx"];
const compiled = {};
for (const rel of files) {
  const src = fs.readFileSync(path.join(VAULT, rel), "utf8");
  compiled["Meta/Obsidian/_datacore/" + rel] = transformSync(src, {
    filename: rel, sourceType: "script",
    parserOpts: { allowReturnOutsideFunction: true, allowAwaitOutsideFunction: true },
    presets: [["@babel/preset-react", {
      runtime: "classic", development: false, pragma: "h", pragmaFrag: "Fragment",
    }]],
    configFile: false, babelrc: false,
  }).code;
}

const env = fs.readFileSync(path.join(HERE, "env-browser.js"), "utf8");

fs.writeFileSync(OUT, `<!doctype html>
<html><head><meta charset="utf-8"><title>paper views — live</title>
<style>
  html,body{margin:0;height:100%;background:#1b1b1f;font-family:system-ui}
  /* a stand-in for the Obsidian note that hosts the view */
  .markdown-preview-view{height:100%;overflow:auto}
  .markdown-preview-sizer{max-width:700px;margin:0 auto;padding:24px}
  #probe{position:fixed;right:8px;bottom:8px;z-index:99999;background:#000c;color:#0f0;
    font:11px/1.4 monospace;padding:8px;max-width:46vw;white-space:pre-wrap}
</style></head>
<body>
<div class="markdown-preview-view"><div class="markdown-preview-sizer">
  <p>a paragraph above the view</p>
  <div id="mount"></div>
  <p>a paragraph below the view</p>
</div></div>
<div id="probe">booting…</div>
<script>${preact}</script>
<script>${phooks}</script>
<script>window.__MODULES__ = ${JSON.stringify(compiled)};</script>
<script>${env}</script>
</body></html>
`);
console.log("wrote", OUT, fs.statSync(OUT).size, "bytes");
