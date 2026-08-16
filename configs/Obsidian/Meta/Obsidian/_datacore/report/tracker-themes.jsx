/* ==========================================================================
   TRACKER THEMES  ·  Meta/Obsidian/_datacore/report/tracker-themes.jsx
   --------------------------------------------------------------------------
   One structural stylesheet driven by CSS variables, plus six skins.
   Everything is scoped under .tk so it can never leak into your notes.

   Skins:  aware · glass-dark · glass-light · skeuo-dark · skeuo-light · fancy
   ========================================================================== */

const SKIN_LIST = [
  { id: "aware", label: "Adaptive", swatch: "linear-gradient(135deg,#8b8f9c 0 50%,#6366f1 50%)" },
  { id: "glass-dark", label: "Glass dark", swatch: "linear-gradient(135deg,#1b1e2c 0 50%,#7c8cff 50%)" },
  { id: "glass-light", label: "Glass light", swatch: "linear-gradient(135deg,#eef1f9 0 50%,#4f46e5 50%)" },
  { id: "skeuo-dark", label: "Skeuo dark", swatch: "linear-gradient(135deg,#2e3238 0 50%,#6d83f2 50%)" },
  { id: "skeuo-light", label: "Skeuo light", swatch: "linear-gradient(135deg,#f1f3f7 0 50%,#4c5fd7 50%)" },
  { id: "fancy", label: "Fancy a Story", swatch: "linear-gradient(135deg,#f0e0bd 0 50%,#a8842c 50%)" }
];

const PALETTES = {
  "aware": ["#6366f1", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6", "#14b8a6", "#f97316", "#3b82f6", "#84cc16", "#e11d48"],
  "glass-dark": ["#7c8cff", "#22d3ee", "#34d399", "#fbbf24", "#fb7185", "#f472b6", "#a78bfa", "#2dd4bf", "#fb923c", "#60a5fa", "#a3e635", "#f43f5e"],
  "glass-light": ["#4f46e5", "#0891b2", "#059669", "#d97706", "#dc2626", "#db2777", "#7c3aed", "#0d9488", "#ea580c", "#2563eb", "#65a30d", "#be123c"],
  "skeuo-dark": ["#6d83f2", "#2fb8d4", "#3fbf87", "#dda032", "#d9534f", "#c96196", "#8f7ae0", "#2fa89b", "#dd8342", "#4a86d8", "#8fae3c", "#cf4a63"],
  "skeuo-light": ["#4c5fd7", "#1189a8", "#2b9c68", "#c07d14", "#c0392b", "#ad3f7a", "#7057c4", "#1d8a80", "#c26a25", "#2f6fc0", "#6f9223", "#b03050"],
  "fancy": ["#a8842c", "#8b2f26", "#4e6644", "#35507a", "#a05a2b", "#6a3a5a", "#2f6560", "#7d6a3a", "#5a6b8c", "#8c5a3c", "#496b6b", "#7a4a2f"]
};

/* --------------------------------------------------------------- structure */

const STRUCTURE = `
.tk{ color:var(--tk-tx); font-family:var(--tk-font); font-size:var(--tk-fs,14px); line-height:1.5; }
.tk *{ box-sizing:border-box; }
.tk button{ font-family:inherit; }
.tk-shell{ position:relative; padding:var(--tk-shell-pad,0); border-radius:var(--tk-rad);
  background:var(--tk-page,transparent); border:var(--tk-shell-bd,0); box-shadow:var(--tk-shell-sh,none); }
.tk-inner{ position:relative; z-index:1; }

/* hero */
.tk-hero{ position:relative; overflow:hidden; border-radius:var(--tk-rad); padding:24px 26px 22px;
  margin-bottom:16px; background:var(--tk-hero); border:1px solid var(--tk-bd);
  box-shadow:var(--tk-sh); backdrop-filter:var(--tk-blur,none); }
.tk-hero-fx{ position:absolute; inset:-40% -10% auto -10%; height:200%; pointer-events:none;
  background:var(--tk-hero-fx,none); opacity:var(--tk-hero-fx-o,1); }
.tk-hero-in{ position:relative; z-index:1; }
.tk-kick{ font-family:var(--tk-fonth); font-size:10.5px; letter-spacing:var(--tk-kick-ls,.22em);
  text-transform:uppercase; color:var(--tk-mut); font-weight:600; }
.tk-title{ font-family:var(--tk-fonth); font-size:clamp(23px,3vw,34px); font-weight:var(--tk-title-w,800);
  letter-spacing:var(--tk-title-ls,-.02em); margin:7px 0 4px; color:var(--tk-tx-strong,var(--tk-tx)); }
.tk-sub{ color:var(--tk-mut); font-size:14px; font-style:var(--tk-sub-i,normal); }
.tk-head-row{ display:flex; align-items:flex-start; gap:16px; flex-wrap:wrap; }
.tk-head-row > div:first-child{ flex:1; min-width:200px; }

/* stat tiles */
.tk-tiles{ display:grid; grid-template-columns:repeat(auto-fit,minmax(122px,1fr)); gap:10px; margin-top:20px; }
.tk-tile{ padding:12px 13px; border-radius:var(--tk-rad2); background:var(--tk-tile); border:1px solid var(--tk-bd2);
  box-shadow:var(--tk-tile-sh,none); text-align:var(--tk-tile-al,left); }
.tk-tile .cap{ height:3px; border-radius:2px; margin-bottom:9px; }
.tk-tile b{ display:block; font-family:var(--tk-fonth); font-size:23px; font-weight:var(--tk-num-w,750);
  letter-spacing:-.02em; line-height:1.2; color:var(--tk-tx-strong,var(--tk-tx)); }
.tk-tile i{ display:block; font-style:normal; font-family:var(--tk-fonth); font-size:9.5px;
  letter-spacing:.15em; text-transform:uppercase; color:var(--tk-fnt); font-weight:600; margin-top:5px; }
.tk-tile em{ display:block; font-style:var(--tk-sub-i,normal); font-size:11.5px; color:var(--tk-mut); margin-top:3px; }

/* panels */
.tk-grid{ display:grid; grid-template-columns:repeat(12,1fr); gap:14px; }
.tk-panel{ padding:16px 17px 15px; border-radius:var(--tk-rad); background:var(--tk-pnl);
  border:1px solid var(--tk-bd); box-shadow:var(--tk-sh); backdrop-filter:var(--tk-blur,none); }
.tk-panel > h3{ margin:0 0 3px; font-family:var(--tk-fonth); font-size:12px; font-weight:700;
  letter-spacing:var(--tk-hd-ls,.03em); text-transform:var(--tk-hd-tf,none);
  color:var(--tk-hd-c,var(--tk-tx)); display:flex; align-items:center; gap:9px; }
.tk-panel > h3 .dot{ width:7px; height:7px; border-radius:99px; flex:0 0 auto; }
.tk-panel > h3:after{ content:''; flex:1; height:1px; background:var(--tk-hd-rule,transparent); }
.tk-panel > p.n{ margin:0 0 14px; font-size:12px; color:var(--tk-fnt); font-style:var(--tk-sub-i,normal); }
.s12{grid-column:span 12} .s8{grid-column:span 8} .s7{grid-column:span 7}
.s6{grid-column:span 6} .s5{grid-column:span 5} .s4{grid-column:span 4}
@media (max-width:1000px){ .s8,.s7,.s6,.s5,.s4{grid-column:span 12} }

/* donut */
.tk-dw{ display:flex; gap:20px; align-items:center; flex-wrap:wrap; }
.tk-donut{ position:relative; flex:0 0 auto; }
.tk-dmid{ position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
.tk-dmid b{ font-family:var(--tk-fonth); font-size:30px; font-weight:var(--tk-num-w,800); line-height:1;
  color:var(--tk-tx-strong,var(--tk-tx)); }
.tk-dmid i{ font-style:var(--tk-sub-i,normal); font-size:11px; color:var(--tk-mut); margin-top:4px; }
.tk-legend{ flex:1; min-width:170px; display:flex; flex-direction:column; gap:6px; }
.tk-lg{ display:flex; align-items:center; gap:9px; font-size:13px; }
.tk-lg .sw{ width:10px; height:10px; border-radius:3px; flex:0 0 auto; }
.tk-lg .nm{ flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.tk-lg .vl{ color:var(--tk-mut); font-variant-numeric:tabular-nums; font-size:12.5px; }

/* aligned bar rows — one shared grid so every track starts and ends together */
.tk-bars{ display:grid; grid-template-columns:minmax(96px,1.25fr) minmax(120px,3fr) max-content;
  column-gap:14px; row-gap:10px; align-items:center; font-size:13px; }
.tk-bar{ display:contents; }
.tk-bar .lb{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0; }
.tk-bar .tk-track2{ position:relative; height:16px; border-radius:var(--tk-bar-rad,99px);
  background:var(--tk-trk); box-shadow:var(--tk-inset,none); overflow:hidden; min-width:0; }
.tk-bar .fl{ position:absolute; inset:0 auto 0 0; border-radius:var(--tk-bar-rad,99px); opacity:.26; }
.tk-bar .fd{ position:absolute; inset:0 auto 0 0; border-radius:var(--tk-bar-rad,99px); box-shadow:var(--tk-bar-sh,none); }
.tk-bar .vl{ font-variant-numeric:tabular-nums; color:var(--tk-mut); font-size:12px; white-space:nowrap; text-align:right; }

/* day columns */
.tk-days{ display:flex; gap:10px; align-items:flex-end; }
.tk-day{ flex:1; display:flex; flex-direction:column; align-items:center; gap:6px; min-width:0; }
.tk-col{ width:100%; height:120px; display:flex; flex-direction:column; justify-content:flex-end;
  border-bottom:var(--tk-axis,none); }
.tk-stack{ position:relative; width:100%; border-radius:var(--tk-col-rad,7px 7px 3px 3px); overflow:hidden;
  background:var(--tk-trk); border:1px solid var(--tk-bd2); }
.tk-stack i{ position:absolute; left:0; right:0; bottom:0; display:block; box-shadow:var(--tk-bar-sh,none); }
.tk-dl{ font-family:var(--tk-fonth); font-size:10px; letter-spacing:.1em; text-transform:uppercase;
  color:var(--tk-mut); font-weight:600; }
.tk-dv{ font-size:11px; color:var(--tk-fnt); font-variant-numeric:tabular-nums; }

/* timeline */
.tk-ax{ position:relative; height:15px; margin-left:46px; margin-bottom:4px; }
.tk-ax span{ position:absolute; transform:translateX(-50%); font-size:10px; color:var(--tk-fnt);
  font-variant-numeric:tabular-nums; }
.tk-tr{ display:flex; align-items:center; gap:8px; margin-bottom:5px; }
.tk-tday{ width:38px; flex:0 0 38px; font-family:var(--tk-fonth); font-size:10px; letter-spacing:.1em;
  text-transform:uppercase; color:var(--tk-mut); text-align:right; font-weight:600; }
.tk-track{ position:relative; flex:1; height:22px; border-radius:var(--tk-bar-rad,7px); background:var(--tk-trk);
  border:1px solid var(--tk-bd2); box-shadow:var(--tk-inset,none); overflow:hidden; }
.tk-tick{ position:absolute; top:0; bottom:0; width:1px; background:var(--tk-bd); }
.tk-tick.maj{ opacity:.75; }
.tk-blk{ position:absolute; top:3px; bottom:3px; border-radius:3px; min-width:2px; box-shadow:var(--tk-bar-sh,none); }
.tk-blk.undone{ opacity:.3; }
.tk-open{ position:absolute; top:0; bottom:0; width:0; border-left:2px dashed var(--tk-warn); }
.tk-tfoot{ display:flex; flex-wrap:wrap; gap:10px 16px; margin-top:10px; font-size:11.5px; color:var(--tk-fnt); }

/* tables */
.tk-wrap{ overflow-x:auto; }
table.tk-t{ width:100%; border-collapse:collapse; font-size:13px; }
table.tk-t th{ font-family:var(--tk-fonth); font-size:9.5px; letter-spacing:.13em; text-transform:uppercase;
  color:var(--tk-fnt); font-weight:700; text-align:left; padding:0 8px 8px;
  border-bottom:1px solid var(--tk-bd); white-space:nowrap; }
table.tk-t td{ padding:6px 8px; border-bottom:1px solid var(--tk-bd2); vertical-align:middle; }
table.tk-t tr:hover td{ background:var(--tk-hover); }
.tk-cell{ display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px;
  border-radius:var(--tk-cell-rad,6px); font-size:11px; line-height:1; }
.tk-cell.done{ color:var(--tk-onacc); box-shadow:var(--tk-bar-sh,none); }
.tk-cell.missed{ border:1px dashed var(--tk-bd); color:var(--tk-fnt); }
.tk-cell.cancelled{ border:1px solid var(--tk-bd); color:var(--tk-fnt); }
.tk-cell.absent{ color:var(--tk-fnt); opacity:.35; }
.tk-pill{ display:inline-block; padding:1px 8px; border-radius:99px; font-size:11px; font-weight:600;
  font-variant-numeric:tabular-nums; background:var(--tk-tile); border:1px solid var(--tk-bd2); color:var(--tk-mut); }
.tk-mini{ position:relative; height:6px; border-radius:99px; background:var(--tk-trk); min-width:60px;
  box-shadow:var(--tk-inset,none); }
.tk-mini i{ position:absolute; left:0; top:0; bottom:0; border-radius:99px; }

/* metric cards */
.tk-mc{ display:grid; grid-template-columns:repeat(auto-fit,minmax(172px,1fr)); gap:12px; }
.tk-card{ padding:13px 14px 12px; border-radius:var(--tk-rad2); background:var(--tk-tile);
  border:1px solid var(--tk-bd2); box-shadow:var(--tk-tile-sh,none); }
.tk-card h4{ margin:0; font-family:var(--tk-fonth); font-size:9.5px; letter-spacing:.14em;
  text-transform:uppercase; color:var(--tk-fnt); font-weight:700; }
.tk-card b{ display:block; font-family:var(--tk-fonth); font-size:23px; font-weight:var(--tk-num-w,750);
  letter-spacing:-.02em; margin:5px 0 2px; }
.tk-card em{ font-style:var(--tk-sub-i,normal); font-size:11.5px; color:var(--tk-mut); }
.tk-spark{ display:flex; align-items:flex-end; gap:3px; height:30px; margin-top:10px; }
.tk-spark i{ flex:1; border-radius:2px 2px 1px 1px; min-height:2px; }

/* heat matrix */
.tk-heat{ display:grid; gap:4px; }
.tk-heat .hd{ font-family:var(--tk-fonth); font-size:9.5px; letter-spacing:.1em; text-transform:uppercase;
  color:var(--tk-fnt); text-align:center; font-weight:700; }
.tk-heat .rl{ font-size:12.5px; color:var(--tk-mut); padding-right:8px; overflow:hidden;
  text-overflow:ellipsis; white-space:nowrap; text-align:right; }
.tk-heat .hc{ height:24px; border-radius:var(--tk-cell-rad,6px); display:flex; align-items:center;
  justify-content:center; font-size:10.5px; font-variant-numeric:tabular-nums; }

/* controls */
.tk-ctrl{ display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-bottom:13px; }
.tk-ctrl input[type=text]{ flex:1; min-width:150px; padding:6px 11px; font-size:13px; color:var(--tk-tx);
  background:var(--tk-tile); border:1px solid var(--tk-bd2); border-radius:var(--tk-rad2);
  box-shadow:var(--tk-inset,none); font-family:inherit; }
.tk-btn{ font-family:var(--tk-fonth); font-size:11px; font-weight:600; cursor:pointer; padding:6px 11px;
  border-radius:var(--tk-rad2); border:1px solid var(--tk-bd2); color:var(--tk-tx);
  background:var(--tk-btn); box-shadow:var(--tk-tile-sh,none); letter-spacing:var(--tk-btn-ls,0); }
.tk-btn:hover{ color:var(--tk-tx); border-color:var(--tk-acc); }
.tk-btn.on{ background:var(--tk-acc); color:var(--tk-onacc); border-color:var(--tk-acc); }
.tk-btn:active{ box-shadow:var(--tk-inset,none); transform:translateY(1px); }
.tk-btn.big{ font-size:12.5px; padding:9px 16px; }
.tk-btn.danger{ color:var(--tk-warn); border-color:var(--tk-warn); }
.tk-btn[disabled]{ opacity:.45; cursor:default; }
.tk-lbl{ font-size:12px; color:var(--tk-fnt); }

/* ledger */
.tk-sec{ margin-bottom:12px; border-radius:var(--tk-rad2); overflow:hidden; border:1px solid var(--tk-bd2); }
.tk-sec > summary{ cursor:pointer; list-style:none; display:flex; align-items:center; gap:10px;
  padding:9px 12px; background:var(--tk-tile); }
.tk-sec > summary::-webkit-details-marker{ display:none; }
.tk-sec .swatch{ width:4px; height:18px; border-radius:99px; flex:0 0 auto; }
.tk-sec h4{ margin:0; font-family:var(--tk-fonth); font-size:13px; font-weight:700; flex:1;
  color:var(--tk-tx-strong,var(--tk-tx)); }
.tk-sec .meta{ font-size:11.5px; color:var(--tk-fnt); }
.tk-rows{ display:grid; grid-template-columns:40px 88px 50px minmax(120px,1fr) max-content;
  column-gap:10px; align-items:baseline; }
.tk-row{ display:contents; }
.tk-row > *{ padding:5px 0; }
.tk-row > :first-child{ padding-left:12px; border-radius:var(--tk-rad2) 0 0 var(--tk-rad2); }
.tk-row > :last-child{ padding-right:12px; border-radius:0 var(--tk-rad2) var(--tk-rad2) 0; }
.tk-row.odd > *{ background:var(--tk-zebra,rgba(128,128,128,.055)); }
.tk-row:hover > *{ background:var(--tk-hover); }
.tk-row .d{ font-size:10px; letter-spacing:.08em; text-transform:uppercase; color:var(--tk-fnt); font-weight:600; }
.tk-row .t{ font-variant-numeric:tabular-nums; font-size:11.5px; color:var(--tk-mut); }
.tk-row .u{ font-size:11px; color:var(--tk-fnt); font-variant-numeric:tabular-nums; }
.tk-row .n{ min-width:0; overflow-wrap:anywhere; }
.tk-row .n a{ color:var(--tk-link); text-decoration:none; cursor:pointer; }
.tk-row .n a:hover{ text-decoration:underline; }
.tk-row.sub .n{ padding-left:22px; }
.tk-row.is-done .n{ color:var(--tk-mut); }
.tk-row.is-cancelled .n{ color:var(--tk-fnt); text-decoration:line-through; }
.tk-mark{ margin-right:7px; }
.tk-chip{ display:inline-block; margin-left:7px; padding:0 6px; border-radius:99px; font-size:10.5px;
  background:var(--tk-trk); color:var(--tk-mut); border:1px solid var(--tk-bd2); white-space:nowrap; }
@media (max-width:760px){
  .tk-rows{ grid-template-columns:36px minmax(100px,1fr) max-content; }
  .tk-row .t,.tk-row .u:not(:last-child){ display:none; }
}

/* skin picker — colour swatches, no labels */
.tk-skins{ display:flex; gap:5px; align-items:center; flex:0 0 auto; }
.tk-sw{ width:17px; height:17px; padding:0; border-radius:5px; cursor:pointer;
  border:1px solid var(--tk-bd); box-shadow:var(--tk-tile-sh,none); opacity:.6; transition:opacity .12s; }
.tk-sw:hover{ opacity:1; }
.tk-sw.on{ opacity:1; box-shadow:0 0 0 2px var(--tk-acc); }
.tk-empty{ text-align:center; padding:36px 20px; color:var(--tk-mut); font-size:13.5px; }
.tk-msg{ font-size:12.5px; color:var(--tk-ok); }
.tk-err{ font-size:12.5px; color:var(--tk-warn); }
.tk-foot{ display:flex; flex-wrap:wrap; gap:9px; align-items:center; margin-top:16px; padding-top:13px;
  border-top:1px solid var(--tk-bd2); }
`;

/* -------------------------------------------------------------------- skins */

const SKINS = {

  "aware": `
.tk{ --tk-page:transparent; --tk-pnl:var(--background-secondary); --tk-tile:var(--background-primary);
  --tk-btn:var(--background-primary); --tk-hero:var(--background-secondary);
  --tk-hero-fx:radial-gradient(ellipse at 12% 22%, rgba(99,102,241,.28), transparent 55%),
               radial-gradient(ellipse at 78% 6%, rgba(236,72,153,.22), transparent 52%),
               radial-gradient(ellipse at 52% 96%, rgba(6,182,212,.22), transparent 55%);
  --tk-bd:var(--background-modifier-border); --tk-bd2:var(--background-modifier-border);
  --tk-tx:var(--text-normal); --tk-mut:var(--text-muted); --tk-fnt:var(--text-faint);
  --tk-acc:var(--interactive-accent); --tk-onacc:var(--text-on-accent,#fff);
  --tk-link:var(--link-color,var(--interactive-accent));
  --tk-trk:var(--background-primary); --tk-hover:var(--background-primary);
  --tk-ok:var(--color-green,#10b981); --tk-warn:var(--color-red,#ef4444);
  --tk-card:var(--background-primary);
  --tk-rad:14px; --tk-rad2:9px; --tk-sh:none; --tk-font:var(--font-interface); --tk-fonth:var(--font-interface); }
`,

  "glass-dark": `
.tk{ --tk-page:linear-gradient(150deg,#12131a 0%,#171a2b 45%,#1b1430 100%);
  --tk-shell-pad:24px; --tk-shell-bd:1px solid rgba(255,255,255,.07); --tk-shell-sh:0 30px 70px -40px #000;
  --tk-pnl:rgba(255,255,255,.055); --tk-tile:rgba(255,255,255,.05); --tk-btn:rgba(255,255,255,.07);
  --tk-hero:rgba(255,255,255,.06);
  --tk-hero-fx:radial-gradient(ellipse at 10% 20%, rgba(124,140,255,.42), transparent 58%),
               radial-gradient(ellipse at 82% 4%, rgba(244,114,182,.32), transparent 55%),
               radial-gradient(ellipse at 55% 100%, rgba(34,211,238,.3), transparent 58%);
  --tk-blur:blur(22px) saturate(140%);
  --tk-bd:rgba(255,255,255,.13); --tk-bd2:rgba(255,255,255,.08);
  --tk-tx:#e8eaf2; --tk-tx-strong:#fff; --tk-mut:#a7adc4; --tk-fnt:#767d96;
  --tk-acc:#7c8cff; --tk-onacc:#0d0f18; --tk-link:#9fb0ff;
  --tk-trk:rgba(255,255,255,.07); --tk-hover:rgba(255,255,255,.05);
  --tk-ok:#34d399; --tk-warn:#fb7185;
  --tk-rad:18px; --tk-rad2:12px; --tk-sh:0 8px 32px -18px rgba(0,0,0,.9), inset 0 1px 0 rgba(255,255,255,.08);
  --tk-card:#1e2131; --tk-tile-sh:inset 0 1px 0 rgba(255,255,255,.06); --tk-bar-sh:0 0 14px -3px currentColor;
  --tk-font:var(--font-interface); --tk-fonth:var(--font-interface); }
.tk-panel:hover{ border-color:rgba(255,255,255,.2); }
`,

  "glass-light": `
.tk{ --tk-page:linear-gradient(150deg,#eef1f7 0%,#e8ecf7 45%,#f2ecf8 100%);
  --tk-shell-pad:24px; --tk-shell-bd:1px solid rgba(255,255,255,.7); --tk-shell-sh:0 30px 70px -45px rgba(40,50,90,.5);
  --tk-pnl:rgba(255,255,255,.55); --tk-tile:rgba(255,255,255,.62); --tk-btn:rgba(255,255,255,.7);
  --tk-hero:rgba(255,255,255,.55);
  --tk-hero-fx:radial-gradient(ellipse at 10% 20%, rgba(79,70,229,.26), transparent 58%),
               radial-gradient(ellipse at 82% 4%, rgba(219,39,119,.2), transparent 55%),
               radial-gradient(ellipse at 55% 100%, rgba(8,145,178,.2), transparent 58%);
  --tk-blur:blur(20px) saturate(150%);
  --tk-bd:rgba(255,255,255,.85); --tk-bd2:rgba(90,100,140,.14);
  --tk-tx:#232a3d; --tk-tx-strong:#141a2b; --tk-mut:#5c657f; --tk-fnt:#8b93a9;
  --tk-acc:#4f46e5; --tk-onacc:#fff; --tk-link:#4338ca;
  --tk-trk:rgba(90,100,140,.13); --tk-hover:rgba(255,255,255,.55);
  --tk-ok:#059669; --tk-warn:#dc2626;
  --tk-rad:18px; --tk-rad2:12px;
  --tk-sh:0 10px 30px -20px rgba(40,50,90,.55), inset 0 1px 0 rgba(255,255,255,.9);
  --tk-card:#f8f9fd; --tk-tile-sh:inset 0 1px 0 rgba(255,255,255,.8);
  --tk-font:var(--font-interface); --tk-fonth:var(--font-interface); }
`,

  "skeuo-dark": `
.tk{ --tk-page:linear-gradient(180deg,#232529 0%,#1c1e22 100%);
  --tk-shell-pad:22px; --tk-shell-bd:1px solid #101215;
  --tk-shell-sh:inset 0 1px 0 rgba(255,255,255,.05), 0 22px 50px -30px #000;
  --tk-pnl:linear-gradient(180deg,#2e3238 0%,#25282d 100%);
  --tk-tile:linear-gradient(180deg,#333840 0%,#2a2e34 100%);
  --tk-btn:linear-gradient(180deg,#3a3f47 0%,#2d3138 100%);
  --tk-hero:linear-gradient(180deg,#343a42 0%,#272b31 100%);
  --tk-hero-fx:radial-gradient(ellipse at 20% 0%, rgba(255,255,255,.09), transparent 60%);
  --tk-bd:#15171a; --tk-bd2:#1d2024;
  --tk-tx:#d8dce2; --tk-tx-strong:#f2f5f9; --tk-mut:#9aa1ab; --tk-fnt:#727a85;
  --tk-acc:#6d83f2; --tk-onacc:#fff; --tk-link:#8fa2ff;
  --tk-trk:#1e2126; --tk-hover:rgba(255,255,255,.04);
  --tk-ok:#3fbf87; --tk-warn:#d9534f;
  --tk-rad:11px; --tk-rad2:8px; --tk-bar-rad:5px; --tk-col-rad:5px 5px 0 0; --tk-cell-rad:5px;
  --tk-sh:inset 0 1px 0 rgba(255,255,255,.07), inset 0 -1px 0 rgba(0,0,0,.4), 0 4px 10px -4px rgba(0,0,0,.7);
  --tk-card:linear-gradient(180deg,#333840 0%,#2a2e34 100%);
  --tk-tile-sh:inset 0 1px 0 rgba(255,255,255,.06), 0 2px 4px -2px rgba(0,0,0,.6);
  --tk-inset:inset 0 2px 4px rgba(0,0,0,.55), inset 0 -1px 0 rgba(255,255,255,.04);
  --tk-bar-sh:inset 0 1px 0 rgba(255,255,255,.28), inset 0 -2px 4px rgba(0,0,0,.3);
  --tk-axis:1px solid #15171a;
  --tk-font:var(--font-interface); --tk-fonth:var(--font-interface); --tk-hd-tf:uppercase; --tk-hd-ls:.14em; }
`,

  "skeuo-light": `
.tk{ --tk-page:linear-gradient(180deg,#eceef1 0%,#dfe3e8 100%);
  --tk-shell-pad:22px; --tk-shell-bd:1px solid #c3c9d1;
  --tk-shell-sh:inset 0 1px 0 #fff, 0 20px 44px -32px rgba(40,50,70,.6);
  --tk-pnl:linear-gradient(180deg,#fdfdfe 0%,#eef0f4 100%);
  --tk-tile:linear-gradient(180deg,#ffffff 0%,#f1f3f7 100%);
  --tk-btn:linear-gradient(180deg,#ffffff 0%,#e8ebf0 100%);
  --tk-hero:linear-gradient(180deg,#ffffff 0%,#e9edf3 100%);
  --tk-hero-fx:radial-gradient(ellipse at 20% 0%, rgba(76,95,215,.14), transparent 62%);
  --tk-bd:#c6ccd5; --tk-bd2:#dde1e8;
  --tk-tx:#2b3140; --tk-tx-strong:#161b26; --tk-mut:#5f6879; --tk-fnt:#8a92a1;
  --tk-acc:#4c5fd7; --tk-onacc:#fff; --tk-link:#3a4ec0;
  --tk-trk:#dfe3ea; --tk-hover:rgba(76,95,215,.06);
  --tk-ok:#2b9c68; --tk-warn:#c0392b;
  --tk-rad:11px; --tk-rad2:8px; --tk-bar-rad:5px; --tk-col-rad:5px 5px 0 0; --tk-cell-rad:5px;
  --tk-sh:inset 0 1px 0 #fff, 0 3px 8px -4px rgba(40,50,70,.35);
  --tk-card:linear-gradient(180deg,#ffffff 0%,#f1f3f7 100%);
  --tk-tile-sh:inset 0 1px 0 #fff, 0 2px 4px -3px rgba(40,50,70,.45);
  --tk-inset:inset 0 2px 4px rgba(60,70,90,.22), inset 0 -1px 0 #fff;
  --tk-bar-sh:inset 0 1px 0 rgba(255,255,255,.55), inset 0 -2px 4px rgba(0,0,0,.14);
  --tk-axis:1px solid #c6ccd5;
  --tk-font:var(--font-interface); --tk-fonth:var(--font-interface); --tk-hd-tf:uppercase; --tk-hd-ls:.14em; }
`,

  "fancy": `
.tk{
  /* Colours are read from Fancy-a-Story when it is loaded (--color-base-*, --middle-color)
     and fall back to a warm parchment when it is not, so this skin follows whichever
     FAS colour scheme and light/dark mode you have selected. */
  --tk-page:
    radial-gradient(ellipse at 10% 6%, rgba(176,142,86,.13), transparent 55%),
    radial-gradient(ellipse at 92% 96%, rgba(140,110,60,.15), transparent 55%),
    repeating-linear-gradient(94deg, rgba(160,130,80,.04) 0 2px, transparent 2px 5px),
    linear-gradient(158deg, var(--color-base-00,#f8efdb) 0%, var(--color-base-05,#f1e3c6) 52%, var(--color-base-10,#e6d3ab) 100%);
  --tk-shell-pad:30px;
  --tk-shell-bd:2px solid var(--color-base-40,#b59a68);
  --tk-shell-sh:inset 0 0 60px rgba(150,115,60,.18), inset 0 1px 0 rgba(255,255,255,.45),
                0 18px 40px -22px rgba(0,0,0,.45);
  --tk-pnl:linear-gradient(180deg, rgba(255,255,255,.30), rgba(0,0,0,.025));
  --tk-tile:linear-gradient(180deg, rgba(255,255,255,.42), rgba(0,0,0,.02));
  --tk-card:linear-gradient(180deg, var(--color-base-00,#fdf7e9), var(--color-base-10,#efdfbb));
  --tk-btn:linear-gradient(180deg, rgba(255,255,255,.5), rgba(0,0,0,.03));
  --tk-hero:transparent; --tk-hero-fx:none;
  --tk-bd:var(--color-base-35,rgba(168,132,44,.45));
  --tk-bd2:var(--color-base-25,rgba(168,132,44,.26));
  --tk-tx:var(--text-normal,#3a2d1c);
  --tk-tx-strong:var(--color-base-100,#2f2413);
  --tk-mut:var(--text-muted,#6a5840);
  --tk-fnt:var(--text-faint,#9a875f);
  --tk-acc:var(--middle-color,#a8842c);
  --tk-onacc:var(--color-base-00,#fffaf0);
  --tk-link:var(--link-color,var(--color-brown,#7a3f22));
  --tk-trk:var(--color-base-20,rgba(120,95,50,.16));
  --tk-hover:var(--color-base-20,rgba(216,190,135,.3));
  --tk-zebra:var(--color-base-05,rgba(150,115,60,.07));
  --tk-ok:var(--color-green,#4e6644);
  --tk-warn:var(--color-red,#8b2f26);
  --tk-rad:3px; --tk-rad2:3px; --tk-bar-rad:2px; --tk-col-rad:2px 2px 0 0; --tk-cell-rad:3px;
  --tk-sh:inset 0 1px 0 rgba(255,255,255,.4);
  --tk-tile-sh:inset 0 0 0 1px rgba(255,255,255,.35), 0 2px 6px -4px rgba(80,60,20,.45);
  --tk-inset:inset 0 1px 2px rgba(90,70,30,.2);
  --tk-bar-sh:inset 0 1px 0 rgba(255,255,255,.3), inset 0 -1px 0 rgba(0,0,0,.12);
  --tk-axis:1px solid var(--tk-acc);
  --tk-hd-rule:linear-gradient(90deg,var(--tk-acc),transparent);
  --tk-hd-c:var(--tk-acc); --tk-hd-tf:uppercase; --tk-hd-ls:.2em;
  --tk-sub-i:italic; --tk-tile-al:center; --tk-kick-ls:.42em; --tk-title-ls:.06em; --tk-title-w:700;
  --tk-num-w:700; --tk-btn-ls:.12em; --tk-fs:15px;
  --tk-font:var(--font-text,'EB Garamond','IM Fell English',Georgia,'Times New Roman',serif);
  --tk-fonth:var(--h3-font,'Cinzel','IM Fell English SC','Fondamento',Georgia,serif); }

/* centred masthead, picker pinned right — same side as every other skin.
   overflow must stay visible or the 2px selection ring on the last swatch
   gets clipped by the hero box. */
.tk-hero{ position:relative; overflow:visible; text-align:center; border:0; box-shadow:none; padding:2px 0 0; }
.tk-head-row{ display:block; }
.tk-skins{ position:absolute; top:2px; right:2px; z-index:2; }

/* illuminated frame */
.tk-frame{ position:absolute; inset:9px; border:1px solid var(--tk-acc); opacity:.5; pointer-events:none; }
.tk-frame:after{ content:''; position:absolute; inset:4px; border:1px solid var(--tk-acc); opacity:.45; }
.tk-corner{ position:absolute; width:34px; height:34px; color:var(--tk-acc); opacity:.75; pointer-events:none; }
.tk-rule{ display:flex; align-items:center; gap:12px; margin:14px 2px 18px; color:var(--tk-acc); }
.tk-rule:before,.tk-rule:after{ content:''; flex:1; height:1px;
  background:linear-gradient(90deg,transparent,var(--tk-acc),transparent); opacity:.7; }
.tk-rule span{ font-size:15px; letter-spacing:.3em; }

/* drop-cap section initials in the ledger */
.tk-sec > summary .swatch{ width:auto; height:auto; background:none !important;
  font-family:var(--tk-fonth); font-size:18px; font-weight:700; color:var(--tk-acc); }
.tk-tile{ border-top:1px solid var(--tk-acc); }
`
};

/* Prefix every selector so two dashboards rendered at once cannot leak
   variables into each other (that is what produced white-on-white). */
function prefixRules(chunk, scope) {
  return chunk.replace(/([^{}]+)\{([^{}]*)\}/g, function (m, sel, body) {
    const out = sel.split(",").map(function (x) {
      x = x.trim();
      return x ? (scope + " " + x) : "";
    }).filter(Boolean).join(", ");
    return out + "{" + body + "}";
  });
}
function scopeCss(css, scope) {
  css = String(css).replace(/\/\*[\s\S]*?\*\//g, "");
  if (!scope) return css;
  const out = [];
  let i = 0;
  while (i < css.length) {
    const at = css.indexOf("@", i);
    if (at < 0) { out.push(prefixRules(css.slice(i), scope)); break; }
    out.push(prefixRules(css.slice(i, at), scope));
    const open = css.indexOf("{", at);
    if (open < 0) { out.push(css.slice(at)); break; }
    let depth = 0, j = open;
    for (; j < css.length; j++) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") { depth--; if (!depth) break; }
    }
    out.push(css.slice(at, open + 1) + prefixRules(css.slice(open + 1, j), scope) + "}");
    i = j + 1;
  }
  return out.join("");
}

const LEGACY = { medieval: "fancy" };
function normalise(id) { return LEGACY[id] || (SKINS[id] ? id : "aware"); }

function skinCss(id, scope) {
  id = normalise(id);
  return scopeCss(STRUCTURE + SKINS[id], scope);
}
function palette(id) { return PALETTES[normalise(id)] || PALETTES["aware"]; }
function isFancy(id) { return normalise(id) === "fancy"; }
function isMedieval(id) { return isFancy(id); }

return {
  SKIN_LIST: SKIN_LIST, PALETTES: PALETTES,
  skinCss: skinCss, palette: palette, isFancy: isFancy, isMedieval: isMedieval,
  normalise: normalise, scopeCss: scopeCss
};
