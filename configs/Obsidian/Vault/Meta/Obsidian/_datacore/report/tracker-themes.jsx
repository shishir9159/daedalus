/* ==========================================================================
   TRACKER THEMES  ·  Meta/Obsidian/_datacore/report/tracker-themes.jsx
   --------------------------------------------------------------------------
   One structural stylesheet driven by CSS variables, plus twelve skins.
   Everything is scoped under .tk so it can never leak into your notes.

   Skins:  aware · glass-dark · glass-light · skeuo-dark · skeuo-light · fancy
           medieval · medieval-night · art-deco · art-deco-night · riso · industry

   Layout knobs the report passes through:
     density   "comfortable" | "compact"     -> --tk-gap, --tk-pnl-pad
     fullWidth true | false                  -> --tk-max
   ========================================================================== */

/* --------------------------------------------------------------- webfonts */
/* Each skin names a font set; the stylesheet link is injected the first time
   that skin is shown.  Every stack ends in a local family, so a vault with no
   network still renders — it just falls back to Georgia / system-ui. */

const FONT_SETS = {
  inter: "family=Inter:wght@400;500;600;700;800",
  classic: "family=Cinzel:wght@400;500;600;700&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=IM+Fell+English:ital@0;1",
  gothic: "family=UnifrakturMaguntia&family=Cinzel:wght@400;500;600;700&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=IM+Fell+English:ital@0;1",
  deco: "family=Limelight&family=Federo&family=Noto+Serif:ital,wght@0,400;0,600;1,400",
  riso: "family=Space+Grotesk:wght@400;500;600;700&family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,600;1,6..96,400",
  industry: "family=Barlow+Condensed:wght@400;500;600;700&family=Barlow:ital,wght@0,400;0,500;0,600;1,400"
};
const SKIN_FONT = {
  "aware": null, "glass-dark": "inter", "glass-light": "inter",
  "skeuo-dark": "inter", "skeuo-light": "inter", "fancy": "classic",
  "medieval": "gothic", "medieval-night": "gothic",
  "art-deco": "deco", "art-deco-night": "deco",
  "riso": "riso", "industry": "industry"
};

function ensureFont(id) {
  const k = SKIN_FONT[id];
  if (!k || typeof document === "undefined" || !FONT_SETS[k]) return;
  const eid = "tkf-" + k;
  if (document.getElementById(eid)) return;
  try {
    const l = document.createElement("link");
    l.id = eid; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?" + FONT_SETS[k] + "&display=swap";
    document.head.appendChild(l);
  } catch (e) { /* offline vaults just use the fallback stacks */ }
}

/* ------------------------------------------------------------------ skins */

const BASE = {
  "--tk-fs": "13.5px", "--tk-rad": "14px", "--tk-rad2": "9px", "--tk-bar-rad": "99px",
  "--tk-cell-rad": "6px", "--tk-col-rad": "7px 7px 3px 3px",
  "--tk-sh": "none", "--tk-tile-sh": "none", "--tk-inset": "none", "--tk-bar-sh": "none",
  "--tk-blur": "none", "--tk-axis": "none", "--tk-shell-pad": "0px", "--tk-shell-bd": "0",
  "--tk-shell-sh": "none", "--tk-hero-bd": "1px solid var(--tk-bd)", "--tk-hero-sh": "none",
  "--tk-hero-pad": "24px 26px 22px", "--tk-hero-mb": "18px",
  "--tk-hero-al": "left", "--tk-hero-jc": "flex-start",
  "--tk-hd-tf": "none", "--tk-hd-ls": ".04em", "--tk-kick-ls": ".22em", "--tk-title-ls": "-.02em",
  "--tk-title-w": "700", "--tk-num-w": "700", "--tk-sub-i": "normal",
  "--tk-hd-rule": "var(--tk-bd2)", "--tk-zebra": "transparent",
  "--tk-hd-c": "var(--tk-tx)", "--tk-page-pad": "0px",
  "--tk-card": "var(--tk-tile)", "--tk-orn": "var(--tk-acc)",
  "--tk-font": "var(--font-interface)", "--tk-fonth": "var(--font-interface)",
  "--tk-fontd": "var(--font-interface)"
};

const SKINS = {

  "aware": {
    label: "Adaptive", swatch: "linear-gradient(135deg,#8b8f9c 0 50%,#6366f1 50%)",
    pal: ["#6366f1", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6", "#14b8a6", "#f97316", "#3b82f6", "#84cc16", "#e11d48"],
    v: {
      "--tk-page": "transparent", "--tk-pnl": "var(--background-secondary)",
      "--tk-tile": "var(--background-primary)", "--tk-btn": "var(--background-primary)",
      "--tk-hero": "var(--background-secondary)",
      "--tk-hero-fx": "radial-gradient(ellipse at 12% 22%,rgba(99,102,241,.28),transparent 55%),radial-gradient(ellipse at 78% 6%,rgba(236,72,153,.22),transparent 52%),radial-gradient(ellipse at 52% 96%,rgba(6,182,212,.22),transparent 55%)",
      "--tk-bd": "var(--background-modifier-border)", "--tk-bd2": "var(--background-modifier-border)",
      "--tk-tx": "var(--text-normal)", "--tk-tx-strong": "var(--text-normal)",
      "--tk-mut": "var(--text-muted)", "--tk-fnt": "var(--text-faint)",
      "--tk-acc": "var(--interactive-accent)", "--tk-onacc": "var(--text-on-accent,#fff)",
      "--tk-link": "var(--link-color,var(--interactive-accent))",
      "--tk-trk": "var(--background-primary)", "--tk-hover": "var(--background-primary)",
      "--tk-zebra": "rgba(128,128,128,.055)",
      "--tk-ok": "var(--color-green,#10b981)", "--tk-warn": "var(--color-red,#ef4444)",
      "--tk-card": "var(--background-primary)",
      "--tk-rad": "14px", "--tk-rad2": "9px"
    }
  },

  "glass-dark": {
    label: "Glass dark", swatch: "linear-gradient(135deg,#1b1e2c 0 50%,#7c8cff 50%)",
    pal: ["#7c8cff", "#22d3ee", "#34d399", "#fbbf24", "#fb7185", "#f472b6", "#a78bfa", "#2dd4bf", "#fb923c", "#60a5fa", "#a3e635", "#f43f5e"],
    v: {
      "--tk-page": "linear-gradient(150deg,#12131a 0%,#171a2b 45%,#1b1430 100%)",
      "--tk-page-pad": "0px", "--tk-shell-pad": "24px",
      "--tk-shell-bd": "1px solid rgba(255,255,255,.07)", "--tk-shell-sh": "0 30px 70px -40px #000",
      "--tk-pnl": "rgba(255,255,255,.055)", "--tk-tile": "rgba(255,255,255,.05)",
      "--tk-btn": "rgba(255,255,255,.07)", "--tk-hero": "rgba(255,255,255,.06)",
      "--tk-hero-fx": "radial-gradient(ellipse at 10% 20%,rgba(124,140,255,.42),transparent 58%),radial-gradient(ellipse at 82% 4%,rgba(244,114,182,.32),transparent 55%),radial-gradient(ellipse at 55% 100%,rgba(34,211,238,.3),transparent 58%)",
      "--tk-blur": "blur(22px) saturate(140%)",
      "--tk-bd": "rgba(255,255,255,.13)", "--tk-bd2": "rgba(255,255,255,.08)",
      "--tk-tx": "#e8eaf2", "--tk-tx-strong": "#fff", "--tk-mut": "#a7adc4", "--tk-fnt": "#767d96",
      "--tk-acc": "#7c8cff", "--tk-onacc": "#0d0f18", "--tk-link": "#9fb0ff",
      "--tk-trk": "rgba(255,255,255,.07)", "--tk-hover": "rgba(255,255,255,.05)",
      "--tk-zebra": "rgba(255,255,255,.04)",
      "--tk-ok": "#34d399", "--tk-warn": "#fb7185",
      "--tk-rad": "18px", "--tk-rad2": "12px",
      "--tk-sh": "0 8px 32px -18px rgba(0,0,0,.9),inset 0 1px 0 rgba(255,255,255,.08)",
      "--tk-card": "#1e2131", "--tk-tile-sh": "inset 0 1px 0 rgba(255,255,255,.06)",
      "--tk-bar-sh": "0 0 14px -3px currentColor"
    }
  },

  "glass-light": {
    label: "Glass light", swatch: "linear-gradient(135deg,#eef1f9 0 50%,#4f46e5 50%)",
    pal: ["#4f46e5", "#0891b2", "#059669", "#d97706", "#dc2626", "#db2777", "#7c3aed", "#0d9488", "#ea580c", "#2563eb", "#65a30d", "#be123c"],
    v: {
      "--tk-page": "linear-gradient(150deg,#eef1f7 0%,#e8ecf7 45%,#f2ecf8 100%)",
      "--tk-page-pad": "0px", "--tk-shell-pad": "24px",
      "--tk-shell-bd": "1px solid rgba(255,255,255,.7)",
      "--tk-shell-sh": "0 30px 70px -45px rgba(40,50,90,.5)",
      "--tk-pnl": "rgba(255,255,255,.55)", "--tk-tile": "rgba(255,255,255,.62)",
      "--tk-btn": "rgba(255,255,255,.7)", "--tk-hero": "rgba(255,255,255,.55)",
      "--tk-hero-fx": "radial-gradient(ellipse at 10% 20%,rgba(79,70,229,.26),transparent 58%),radial-gradient(ellipse at 82% 4%,rgba(219,39,119,.2),transparent 55%),radial-gradient(ellipse at 55% 100%,rgba(8,145,178,.2),transparent 58%)",
      "--tk-blur": "blur(20px) saturate(150%)",
      "--tk-bd": "rgba(255,255,255,.85)", "--tk-bd2": "rgba(90,100,140,.14)",
      "--tk-tx": "#232a3d", "--tk-tx-strong": "#141a2b", "--tk-mut": "#5c657f", "--tk-fnt": "#8b93a9",
      "--tk-acc": "#4f46e5", "--tk-onacc": "#fff", "--tk-link": "#4338ca",
      "--tk-trk": "rgba(90,100,140,.13)", "--tk-hover": "rgba(255,255,255,.55)",
      "--tk-zebra": "rgba(90,100,140,.05)",
      "--tk-ok": "#059669", "--tk-warn": "#dc2626",
      "--tk-rad": "18px", "--tk-rad2": "12px",
      "--tk-sh": "0 10px 30px -20px rgba(40,50,90,.55),inset 0 1px 0 rgba(255,255,255,.9)",
      "--tk-card": "#f8f9fd", "--tk-tile-sh": "inset 0 1px 0 rgba(255,255,255,.8)"
    }
  },

  "skeuo-dark": {
    label: "Skeuo dark", swatch: "linear-gradient(135deg,#2e3238 0 50%,#6d83f2 50%)",
    pal: ["#6d83f2", "#2fb8d4", "#3fbf87", "#dda032", "#d9534f", "#c96196", "#8f7ae0", "#2fa89b", "#dd8342", "#4a86d8", "#8fae3c", "#cf4a63"],
    v: {
      "--tk-page": "linear-gradient(180deg,#232529 0%,#1c1e22 100%)",
      "--tk-page-pad": "0px", "--tk-shell-pad": "22px", "--tk-shell-bd": "1px solid #101215",
      "--tk-shell-sh": "inset 0 1px 0 rgba(255,255,255,.05),0 22px 50px -30px #000",
      "--tk-pnl": "linear-gradient(180deg,#2e3238 0%,#25282d 100%)",
      "--tk-tile": "linear-gradient(180deg,#333840 0%,#2a2e34 100%)",
      "--tk-btn": "linear-gradient(180deg,#3a3f47 0%,#2d3138 100%)",
      "--tk-hero": "linear-gradient(180deg,#343a42 0%,#272b31 100%)",
      "--tk-hero-fx": "radial-gradient(ellipse at 20% 0%,rgba(255,255,255,.09),transparent 60%)",
      "--tk-bd": "#15171a", "--tk-bd2": "#1d2024",
      "--tk-tx": "#d8dce2", "--tk-tx-strong": "#f2f5f9", "--tk-mut": "#9aa1ab", "--tk-fnt": "#727a85",
      "--tk-acc": "#6d83f2", "--tk-onacc": "#fff", "--tk-link": "#8fa2ff",
      "--tk-trk": "#1e2126", "--tk-hover": "rgba(255,255,255,.04)",
      "--tk-zebra": "rgba(255,255,255,.032)",
      "--tk-ok": "#3fbf87", "--tk-warn": "#d9534f",
      "--tk-rad": "11px", "--tk-rad2": "8px", "--tk-bar-rad": "5px",
      "--tk-col-rad": "5px 5px 0 0", "--tk-cell-rad": "5px",
      "--tk-sh": "inset 0 1px 0 rgba(255,255,255,.07),inset 0 -1px 0 rgba(0,0,0,.4),0 4px 10px -4px rgba(0,0,0,.7)",
      "--tk-card": "linear-gradient(180deg,#333840 0%,#2a2e34 100%)",
      "--tk-tile-sh": "inset 0 1px 0 rgba(255,255,255,.06),0 2px 4px -2px rgba(0,0,0,.6)",
      "--tk-inset": "inset 0 2px 4px rgba(0,0,0,.55),inset 0 -1px 0 rgba(255,255,255,.04)",
      "--tk-bar-sh": "inset 0 1px 0 rgba(255,255,255,.28),inset 0 -2px 4px rgba(0,0,0,.3)",
      "--tk-axis": "1px solid #15171a", "--tk-hd-tf": "uppercase", "--tk-hd-ls": ".14em"
    }
  },

  "skeuo-light": {
    label: "Skeuo light", swatch: "linear-gradient(135deg,#f1f3f7 0 50%,#4c5fd7 50%)",
    pal: ["#4c5fd7", "#1189a8", "#2b9c68", "#c07d14", "#c0392b", "#ad3f7a", "#7057c4", "#1d8a80", "#c26a25", "#2f6fc0", "#6f9223", "#b03050"],
    v: {
      "--tk-page": "linear-gradient(180deg,#eceef1 0%,#dfe3e8 100%)",
      "--tk-page-pad": "0px", "--tk-shell-pad": "22px", "--tk-shell-bd": "1px solid #c3c9d1",
      "--tk-shell-sh": "inset 0 1px 0 #fff,0 20px 44px -32px rgba(40,50,70,.6)",
      "--tk-pnl": "linear-gradient(180deg,#fdfdfe 0%,#eef0f4 100%)",
      "--tk-tile": "linear-gradient(180deg,#ffffff 0%,#f1f3f7 100%)",
      "--tk-btn": "linear-gradient(180deg,#ffffff 0%,#e8ebf0 100%)",
      "--tk-hero": "linear-gradient(180deg,#ffffff 0%,#e9edf3 100%)",
      "--tk-hero-fx": "radial-gradient(ellipse at 20% 0%,rgba(76,95,215,.14),transparent 62%)",
      "--tk-bd": "#c6ccd5", "--tk-bd2": "#dde1e8",
      "--tk-tx": "#2b3140", "--tk-tx-strong": "#161b26", "--tk-mut": "#5f6879", "--tk-fnt": "#8a92a1",
      "--tk-acc": "#4c5fd7", "--tk-onacc": "#fff", "--tk-link": "#3a4ec0",
      "--tk-trk": "#dfe3ea", "--tk-hover": "rgba(76,95,215,.06)",
      "--tk-zebra": "rgba(76,95,215,.045)",
      "--tk-ok": "#2b9c68", "--tk-warn": "#c0392b",
      "--tk-rad": "11px", "--tk-rad2": "8px", "--tk-bar-rad": "5px",
      "--tk-col-rad": "5px 5px 0 0", "--tk-cell-rad": "5px",
      "--tk-sh": "inset 0 1px 0 #fff,0 3px 8px -4px rgba(40,50,70,.35)",
      "--tk-card": "linear-gradient(180deg,#ffffff 0%,#f1f3f7 100%)",
      "--tk-tile-sh": "inset 0 1px 0 #fff,0 2px 4px -3px rgba(40,50,70,.45)",
      "--tk-inset": "inset 0 2px 4px rgba(60,70,90,.22),inset 0 -1px 0 #fff",
      "--tk-bar-sh": "inset 0 1px 0 rgba(255,255,255,.55),inset 0 -2px 4px rgba(0,0,0,.14)",
      "--tk-axis": "1px solid #c6ccd5", "--tk-hd-tf": "uppercase", "--tk-hd-ls": ".14em"
    }
  },

  "fancy": {
    label: "Fancy", swatch: "linear-gradient(135deg,#f0e0bd 0 50%,#a8842c 50%)", ornate: 1,
    pal: ["#a8842c", "#8b2f26", "#4e6644", "#35507a", "#a05a2b", "#6a3a5a", "#2f6560", "#7d6a3a", "#5a6b8c", "#8c5a3c", "#496b6b", "#7a4a2f"],
    v: {
      "--tk-page": "radial-gradient(ellipse at 10% 6%,rgba(176,142,86,.13),transparent 55%),radial-gradient(ellipse at 92% 96%,rgba(140,110,60,.15),transparent 55%),repeating-linear-gradient(94deg,rgba(160,130,80,.04) 0 2px,transparent 2px 5px),linear-gradient(158deg,var(--color-base-00,#f8efdb) 0%,var(--color-base-05,#f1e3c6) 52%,var(--color-base-10,#e6d3ab) 100%)",
      "--tk-page-pad": "0px", "--tk-shell-pad": "32px",
      "--tk-shell-bd": "2px solid var(--color-base-40,#b59a68)",
      "--tk-shell-sh": "inset 0 0 60px rgba(150,115,60,.18),inset 0 1px 0 rgba(255,255,255,.45),0 18px 40px -22px rgba(0,0,0,.45)",
      "--tk-pnl": "linear-gradient(180deg,rgba(255,255,255,.30),rgba(0,0,0,.025))",
      "--tk-tile": "linear-gradient(180deg,rgba(255,255,255,.42),rgba(0,0,0,.02))",
      "--tk-btn": "linear-gradient(180deg,rgba(255,255,255,.5),rgba(0,0,0,.03))",
      "--tk-card": "linear-gradient(180deg,var(--color-base-00,#fdf7e9),var(--color-base-10,#efdfbb))",
      "--tk-hero": "transparent", "--tk-hero-fx": "none", "--tk-hero-bd": "0",
      "--tk-hero-pad": "4px 0 0", "--tk-hero-al": "center", "--tk-hero-jc": "center",
      "--tk-hero-mb": "6px",
      "--tk-bd": "var(--color-base-35,rgba(168,132,44,.45))",
      "--tk-bd2": "var(--color-base-25,rgba(168,132,44,.26))",
      "--tk-tx": "var(--text-normal,#3a2d1c)", "--tk-tx-strong": "var(--color-base-100,#2f2413)",
      "--tk-mut": "var(--text-muted,#6a5840)", "--tk-fnt": "var(--text-faint,#9a875f)",
      "--tk-acc": "var(--middle-color,#a8842c)", "--tk-onacc": "var(--color-base-00,#fffaf0)",
      "--tk-link": "var(--link-color,var(--color-brown,#7a3f22))",
      "--tk-trk": "var(--color-base-20,rgba(120,95,50,.16))",
      "--tk-hover": "var(--color-base-20,rgba(216,190,135,.3))",
      "--tk-zebra": "var(--color-base-05,rgba(150,115,60,.07))",
      "--tk-ok": "var(--color-green,#4e6644)", "--tk-warn": "var(--color-red,#8b2f26)",
      "--tk-rad": "3px", "--tk-rad2": "3px", "--tk-bar-rad": "2px",
      "--tk-col-rad": "2px 2px 0 0", "--tk-cell-rad": "3px",
      "--tk-sh": "inset 0 1px 0 rgba(255,255,255,.4)",
      "--tk-tile-sh": "inset 0 0 0 1px rgba(255,255,255,.35),0 2px 6px -4px rgba(80,60,20,.45)",
      "--tk-inset": "inset 0 1px 2px rgba(90,70,30,.2)",
      "--tk-bar-sh": "inset 0 1px 0 rgba(255,255,255,.3),inset 0 -1px 0 rgba(0,0,0,.12)",
      "--tk-axis": "1px solid var(--tk-acc)",
      "--tk-hd-rule": "linear-gradient(90deg,var(--tk-acc),transparent)",
      "--tk-hd-c": "var(--tk-acc)", "--tk-hd-tf": "uppercase", "--tk-hd-ls": ".2em",
      "--tk-sub-i": "italic", "--tk-kick-ls": ".42em", "--tk-title-ls": ".06em",
      "--tk-title-w": "700", "--tk-num-w": "700", "--tk-fs": "14.5px",
      "--tk-font": "var(--font-text,'EB Garamond','IM Fell English',Georgia,serif)",
      "--tk-fonth": "var(--h3-font,'Cinzel','IM Fell English SC',Georgia,serif)",
      "--tk-fontd": "'Cinzel','IM Fell English',Georgia,serif",
      "--tk-orn": "var(--middle-color,#a8842c)"
    }
  },

  "medieval": {
    label: "Medieval", swatch: "linear-gradient(135deg,#e7d8b4 0 50%,#9c2b1c 50%)", ornate: 1, med: 1,
    pal: ["#9c2b1c", "#a8842c", "#4a6b45", "#6d1a10", "#7a5c18", "#2f4a2c", "#c2503a", "#c9a655", "#7a9a6b", "#8a3a28", "#5c7a52", "#a8482f"],
    v: {
      "--tk-page": "radial-gradient(120% 80% at 8% 4%,rgba(120,90,45,.10),transparent 60%),radial-gradient(100% 70% at 96% 100%,rgba(90,65,30,.16),transparent 62%),repeating-linear-gradient(0deg,rgba(120,95,55,.035) 0 1px,transparent 1px 4px),repeating-linear-gradient(90deg,rgba(120,95,55,.028) 0 1px,transparent 1px 6px),linear-gradient(165deg,#efe3c4 0%,#e7d8b4 46%,#dbc89f 100%)",
      "--tk-page-pad": "0px", "--tk-shell-pad": "40px", "--tk-shell-bd": "3px double #8a6a34",
      "--tk-shell-sh": "inset 0 0 90px rgba(120,85,35,.22),0 20px 46px -26px rgba(40,25,0,.5)",
      "--tk-pnl": "linear-gradient(180deg,rgba(255,251,238,.46),rgba(120,90,40,.03))",
      "--tk-tile": "linear-gradient(180deg,rgba(255,252,242,.6),rgba(120,90,40,.03))",
      "--tk-btn": "linear-gradient(180deg,rgba(255,252,242,.66),rgba(120,90,40,.04))",
      "--tk-hero": "transparent", "--tk-hero-fx": "none", "--tk-hero-bd": "0",
      "--tk-hero-pad": "6px 0 0", "--tk-hero-al": "center", "--tk-hero-jc": "center",
      "--tk-hero-mb": "4px",
      "--tk-bd": "rgba(120,88,40,.44)", "--tk-bd2": "rgba(120,88,40,.22)",
      "--tk-tx": "#33261a", "--tk-tx-strong": "#241a10", "--tk-mut": "#6b5638", "--tk-fnt": "#947c52",
      "--tk-acc": "#9c2b1c", "--tk-onacc": "#fdf6e4", "--tk-link": "#7a3f22",
      "--tk-trk": "rgba(120,95,50,.15)", "--tk-hover": "rgba(200,170,110,.24)",
      "--tk-zebra": "rgba(150,115,60,.055)",
      "--tk-ok": "#4a6b45", "--tk-warn": "#9c2b1c",
      "--tk-rad": "2px", "--tk-rad2": "2px", "--tk-bar-rad": "1px",
      "--tk-col-rad": "1px", "--tk-cell-rad": "2px",
      "--tk-sh": "inset 0 1px 0 rgba(255,255,255,.45)",
      "--tk-tile-sh": "inset 0 0 0 1px rgba(255,255,255,.3),0 2px 6px -4px rgba(80,60,20,.4)",
      "--tk-inset": "inset 0 1px 2px rgba(90,70,30,.18)",
      "--tk-bar-sh": "inset 0 1px 0 rgba(255,255,255,.28)",
      "--tk-axis": "1px solid #a8842c",
      "--tk-hd-rule": "linear-gradient(90deg,#a8842c,transparent)",
      "--tk-hd-c": "#9c2b1c", "--tk-hd-tf": "uppercase", "--tk-hd-ls": ".22em",
      "--tk-sub-i": "italic", "--tk-kick-ls": ".46em", "--tk-title-ls": ".01em",
      "--tk-title-w": "400", "--tk-num-w": "600", "--tk-fs": "14.5px",
      "--tk-font": "'EB Garamond','IM Fell English',Georgia,serif",
      "--tk-fonth": "'Cinzel','IM Fell English SC',Georgia,serif",
      "--tk-fontd": "'UnifrakturMaguntia','Cinzel Decorative',Georgia,serif",
      "--tk-orn": "#a8842c"
    }
  },

  "medieval-night": {
    label: "Medieval night", swatch: "linear-gradient(135deg,#241b12 0 50%,#c79a45 50%)", ornate: 1, med: 1,
    pal: ["#c9553c", "#c79a45", "#7fa86f", "#9e3a26", "#a67c30", "#5e8450", "#e08a72", "#e0c079", "#a8c79a", "#b8452e", "#8fa87f", "#d1704f"],
    v: {
      "--tk-page": "radial-gradient(120% 80% at 10% 2%,rgba(199,154,69,.14),transparent 58%),radial-gradient(90% 70% at 94% 100%,rgba(160,110,40,.12),transparent 60%),repeating-linear-gradient(0deg,rgba(220,190,130,.022) 0 1px,transparent 1px 4px),linear-gradient(165deg,#241b12 0%,#1c150e 50%,#150f09 100%)",
      "--tk-page-pad": "0px", "--tk-shell-pad": "40px", "--tk-shell-bd": "3px double #6d5426",
      "--tk-shell-sh": "inset 0 0 100px rgba(0,0,0,.55),0 22px 50px -28px #000",
      "--tk-pnl": "linear-gradient(180deg,rgba(220,190,130,.055),rgba(0,0,0,.12))",
      "--tk-tile": "linear-gradient(180deg,rgba(220,190,130,.07),rgba(0,0,0,.1))",
      "--tk-btn": "linear-gradient(180deg,rgba(220,190,130,.09),rgba(0,0,0,.1))",
      "--tk-hero": "transparent", "--tk-hero-fx": "none", "--tk-hero-bd": "0",
      "--tk-hero-pad": "6px 0 0", "--tk-hero-al": "center", "--tk-hero-jc": "center",
      "--tk-hero-mb": "4px",
      "--tk-bd": "rgba(199,154,69,.34)", "--tk-bd2": "rgba(199,154,69,.18)",
      "--tk-tx": "#e2d3b4", "--tk-tx-strong": "#f6ecd6", "--tk-mut": "#ab9670", "--tk-fnt": "#7d6c4c",
      "--tk-acc": "#c9553c", "--tk-onacc": "#1a1209", "--tk-link": "#d8a563",
      "--tk-trk": "rgba(220,190,130,.08)", "--tk-hover": "rgba(220,190,130,.06)",
      "--tk-zebra": "rgba(220,190,130,.035)",
      "--tk-ok": "#6f9563", "--tk-warn": "#c9553c",
      "--tk-rad": "2px", "--tk-rad2": "2px", "--tk-bar-rad": "1px",
      "--tk-col-rad": "1px", "--tk-cell-rad": "2px",
      "--tk-sh": "inset 0 1px 0 rgba(220,190,130,.09)",
      "--tk-tile-sh": "inset 0 0 0 1px rgba(220,190,130,.06)",
      "--tk-inset": "inset 0 1px 3px rgba(0,0,0,.5)",
      "--tk-bar-sh": "inset 0 1px 0 rgba(255,235,190,.15)",
      "--tk-axis": "1px solid #6d5426",
      "--tk-hd-rule": "linear-gradient(90deg,#c79a45,transparent)",
      "--tk-hd-c": "#c79a45", "--tk-hd-tf": "uppercase", "--tk-hd-ls": ".22em",
      "--tk-sub-i": "italic", "--tk-kick-ls": ".46em", "--tk-title-ls": ".01em",
      "--tk-title-w": "400", "--tk-num-w": "600", "--tk-fs": "14.5px",
      "--tk-font": "'EB Garamond','IM Fell English',Georgia,serif",
      "--tk-fonth": "'Cinzel','IM Fell English SC',Georgia,serif",
      "--tk-fontd": "'UnifrakturMaguntia','Cinzel Decorative',Georgia,serif",
      "--tk-orn": "#c79a45"
    }
  },

  "art-deco": {
    label: "Art Deco", swatch: "linear-gradient(135deg,#f2eee2 0 50%,#161547 50%)", deco: 1,
    pal: ["#161547", "#a8862f", "#2f5c58", "#9c4a4a", "#3a3a6b", "#c2a35f", "#4a7a72", "#7a3a3a", "#22224f", "#8a7440", "#5c7f7a", "#6b3f5c"],
    v: {
      "--tk-page": "linear-gradient(180deg,#f6f3ea 0%,#efeadd 100%)",
      "--tk-page-pad": "0px", "--tk-shell-pad": "38px", "--tk-shell-bd": "1px solid #161547",
      "--tk-shell-sh": "0 0 0 5px #f6f3ea inset,0 0 0 6px rgba(22,21,71,.35) inset",
      "--tk-pnl": "#faf8f1", "--tk-tile": "#f3efe3", "--tk-btn": "#f3efe3",
      "--tk-hero": "transparent", "--tk-hero-fx": "none", "--tk-hero-bd": "0",
      "--tk-hero-pad": "2px 0 0", "--tk-hero-al": "center", "--tk-hero-jc": "center",
      "--tk-hero-mb": "8px",
      "--tk-bd": "rgba(22,21,71,.30)", "--tk-bd2": "rgba(22,21,71,.16)",
      "--tk-tx": "#231f38", "--tk-tx-strong": "#161547", "--tk-mut": "#5a5673", "--tk-fnt": "#8b87a0",
      "--tk-acc": "#161547", "--tk-onacc": "#f6f3ea", "--tk-link": "#2c2a72",
      "--tk-trk": "rgba(22,21,71,.10)", "--tk-hover": "rgba(22,21,71,.05)",
      "--tk-zebra": "rgba(22,21,71,.035)",
      "--tk-ok": "#1f5c58", "--tk-warn": "#7a1f3d",
      "--tk-rad": "0px", "--tk-rad2": "0px", "--tk-bar-rad": "0px",
      "--tk-col-rad": "0", "--tk-cell-rad": "0px",
      "--tk-axis": "1px solid #161547",
      "--tk-hd-rule": "repeating-linear-gradient(90deg,#161547 0 100%)",
      "--tk-hd-c": "#161547", "--tk-hd-tf": "uppercase", "--tk-hd-ls": ".26em",
      "--tk-kick-ls": ".5em", "--tk-title-ls": ".08em",
      "--tk-title-w": "400", "--tk-num-w": "400", "--tk-fs": "14px",
      "--tk-font": "'Noto Serif',Georgia,serif", "--tk-fonth": "'Federo',system-ui,sans-serif",
      "--tk-fontd": "'Limelight','Federo',Impact,sans-serif", "--tk-orn": "#161547"
    }
  },

  "art-deco-night": {
    label: "Art Deco night", swatch: "linear-gradient(135deg,#12121a 0 50%,#e3c24a 50%)", deco: 1,
    pal: ["#e3c24a", "#7fb0a4", "#d9907a", "#a9a3e0", "#c9a350", "#5f9e8f", "#c0705f", "#8f89c9", "#e0d5a8", "#9a8f6a", "#8fbfae", "#c8a0b4"],
    v: {
      "--tk-page": "linear-gradient(180deg,#14141c 0%,#0e0e14 100%)",
      "--tk-page-pad": "0px", "--tk-shell-pad": "38px", "--tk-shell-bd": "1px solid #e3c24a",
      "--tk-shell-sh": "0 0 0 5px #14141c inset,0 0 0 6px rgba(227,194,74,.32) inset",
      "--tk-pnl": "#16161f", "--tk-tile": "#1b1b25", "--tk-btn": "#1b1b25",
      "--tk-hero": "transparent", "--tk-hero-fx": "none", "--tk-hero-bd": "0",
      "--tk-hero-pad": "2px 0 0", "--tk-hero-al": "center", "--tk-hero-jc": "center",
      "--tk-hero-mb": "8px",
      "--tk-bd": "rgba(227,194,74,.34)", "--tk-bd2": "rgba(227,194,74,.17)",
      "--tk-tx": "#e0dcce", "--tk-tx-strong": "#f6f1de", "--tk-mut": "#a49e88", "--tk-fnt": "#78735f",
      "--tk-acc": "#e3c24a", "--tk-onacc": "#12121a", "--tk-link": "#ecd274",
      "--tk-trk": "rgba(227,194,74,.10)", "--tk-hover": "rgba(227,194,74,.06)",
      "--tk-zebra": "rgba(227,194,74,.035)",
      "--tk-ok": "#6fbfae", "--tk-warn": "#d98f7a",
      "--tk-rad": "0px", "--tk-rad2": "0px", "--tk-bar-rad": "0px",
      "--tk-col-rad": "0", "--tk-cell-rad": "0px",
      "--tk-axis": "1px solid #e3c24a",
      "--tk-hd-rule": "repeating-linear-gradient(90deg,#e3c24a 0 100%)",
      "--tk-hd-c": "#e3c24a", "--tk-hd-tf": "uppercase", "--tk-hd-ls": ".26em",
      "--tk-kick-ls": ".5em", "--tk-title-ls": ".08em",
      "--tk-title-w": "400", "--tk-num-w": "400", "--tk-fs": "14px",
      "--tk-font": "'Noto Serif',Georgia,serif", "--tk-fonth": "'Federo',system-ui,sans-serif",
      "--tk-fontd": "'Limelight','Federo',Impact,sans-serif", "--tk-orn": "#e3c24a"
    }
  },

  "riso": {
    label: "Riso print", swatch: "linear-gradient(135deg,#f4f1e8 0 50%,#ff48b0 50%)",
    pal: ["#ff48b0", "#0078bf", "#00a95c", "#ff6c2f", "#765ba7", "#d9a300", "#00868b", "#e4003a", "#3f3f46", "#5c8a00", "#b03f8c", "#0a6ea8"],
    v: {
      "--tk-page": "radial-gradient(rgba(23,22,26,.07) 1px,transparent 1.3px) 0 0/7px 7px,linear-gradient(180deg,#f7f4eb 0%,#f1ede0 100%)",
      "--tk-page-pad": "0px", "--tk-shell-pad": "26px", "--tk-shell-bd": "1.5px solid #17161a",
      "--tk-shell-sh": "9px 9px 0 rgba(255,72,176,.5)",
      "--tk-pnl": "#fbf8f0", "--tk-tile": "#f1ecdd", "--tk-btn": "#f1ecdd", "--tk-hero": "#fbf8f0",
      "--tk-hero-fx": "none", "--tk-hero-bd": "1.5px solid #17161a",
      "--tk-hero-sh": "6px 6px 0 rgba(0,120,191,.45)",
      "--tk-hero-pad": "22px 24px 20px", "--tk-hero-mb": "22px",
      "--tk-bd": "#17161a", "--tk-bd2": "rgba(23,22,26,.28)",
      "--tk-tx": "#17161a", "--tk-tx-strong": "#0e0d10", "--tk-mut": "#575349", "--tk-fnt": "#8b867a",
      "--tk-acc": "#ff48b0", "--tk-onacc": "#fffdf7", "--tk-link": "#0078bf",
      "--tk-trk": "rgba(23,22,26,.11)", "--tk-hover": "rgba(255,72,176,.08)",
      "--tk-zebra": "rgba(23,22,26,.045)",
      "--tk-ok": "#00a95c", "--tk-warn": "#e4003a",
      "--tk-rad": "0px", "--tk-rad2": "0px", "--tk-bar-rad": "0px",
      "--tk-col-rad": "0", "--tk-cell-rad": "0px",
      "--tk-sh": "3px 3px 0 rgba(23,22,26,.14)",
      "--tk-axis": "1.5px solid #17161a",
      "--tk-hd-rule": "repeating-linear-gradient(90deg,#17161a 0 3px,transparent 3px 6px)",
      "--tk-hd-c": "#17161a", "--tk-hd-tf": "uppercase", "--tk-hd-ls": ".16em",
      "--tk-kick-ls": ".34em", "--tk-title-ls": "-.01em",
      "--tk-title-w": "600", "--tk-num-w": "600", "--tk-fs": "13.5px",
      "--tk-font": "'Space Grotesk',system-ui,sans-serif",
      "--tk-fonth": "'Space Grotesk',system-ui,sans-serif",
      "--tk-fontd": "'Bodoni Moda','Space Grotesk',Georgia,serif", "--tk-orn": "#ff48b0"
    }
  },

  "industry": {
    label: "Industry", swatch: "linear-gradient(135deg,#f2f2f3 0 50%,#5980a6 50%)", ind: 1,
    pal: ["#597ea3", "#2b2b2d", "#416180", "#7a7a7d", "#1d2d3d", "#5d5d60", "#2c455d", "#424244", "#6b8fb0", "#8d8d90", "#39536e", "#9aa8b6"],
    v: {
      "--tk-page": "#f2f2f3", "--tk-page-pad": "0px", "--tk-shell-pad": "30px",
      "--tk-shell-bd": "1px solid #1d1f20", "--tk-shell-sh": "none",
      "--tk-pnl": "transparent", "--tk-tile": "transparent", "--tk-btn": "transparent",
      "--tk-hero": "transparent", "--tk-hero-fx": "none",
      "--tk-hero-bd": "1px solid #b7b7ba", "--tk-hero-sh": "none",
      "--tk-hero-pad": "22px 24px 20px", "--tk-hero-mb": "18px",
      "--tk-bd": "#b7b7ba", "--tk-bd2": "rgba(29,31,32,.16)",
      "--tk-tx": "#2b2b2d", "--tk-tx-strong": "#1d1f20", "--tk-mut": "#5d5d60", "--tk-fnt": "#7a7a7d",
      "--tk-acc": "#5980a6", "--tk-onacc": "#f2f2f3", "--tk-link": "#416180",
      "--tk-trk": "#e7e7ea", "--tk-hover": "#eef6ff", "--tk-zebra": "#eef6ff",
      "--tk-ok": "#416180", "--tk-warn": "#1d1f20", "--tk-card": "#fafafb",
      "--tk-rad": "0px", "--tk-rad2": "0px", "--tk-bar-rad": "0px",
      "--tk-col-rad": "0", "--tk-cell-rad": "0px",
      "--tk-axis": "1px solid #b7b7ba", "--tk-hd-rule": "rgba(29,31,32,.16)",
      "--tk-hd-c": "#1d1f20", "--tk-hd-tf": "uppercase", "--tk-hd-ls": ".14em",
      "--tk-kick-ls": ".3em", "--tk-title-ls": ".005em",
      "--tk-title-w": "600", "--tk-num-w": "600", "--tk-fs": "14px",
      "--tk-font": "'Barlow',system-ui,sans-serif",
      "--tk-fonth": "'Barlow Condensed',system-ui,sans-serif",
      "--tk-fontd": "'Barlow Condensed',system-ui,sans-serif", "--tk-orn": "#5980a6"
    }
  }
};

const ORDER = ["aware", "glass-dark", "glass-light", "skeuo-dark", "skeuo-light", "fancy",
  "medieval", "medieval-night", "art-deco", "art-deco-night", "riso", "industry"];

const SKIN_LIST = ORDER.map(function (id) {
  return { id: id, label: SKINS[id].label, swatch: SKINS[id].swatch };
});
const PALETTES = {};
ORDER.forEach(function (id) { PALETTES[id] = SKINS[id].pal; });

/* ================================================================== detect */
/* Two scenarios only, per the brief:
     · Fancy-a-Story is the active Obsidian theme AND its Art Deco or Medieval
       skin is on -> take that skin, matched to light / dark mode.
     · anything else -> Industry.
   The matching is deliberately loose (it looks at the theme name, the classes
   Style Settings writes onto <body>, and the Style Settings blob itself) so a
   rename on the theme's side degrades to the Industry default rather than
   breaking.  Adjust the two patterns below if FAS changes its class names. */

const FAS_THEME = /fancy/i;               /* "Fancy a Story" in appearance settings */
const FAS_DECO = /art[-_\s]?deco/i;
const FAS_MED = /medieval/i;

function styleSettingsBlob() {
  const bits = [];
  try {
    if (typeof document !== "undefined") {
      bits.push(document.body.className || "");
      bits.push(document.documentElement.className || "");
    }
  } catch (e) { /* ignore */ }
  try {
    const ss = app.plugins && app.plugins.plugins && app.plugins.plugins["obsidian-style-settings"];
    const cfg = ss && (ss.settingsManager && ss.settingsManager.settings);
    if (cfg) {
      Object.keys(cfg).forEach(function (k) {
        const v = cfg[k];
        if (v === true || v === 1) bits.push(k);
        else if (typeof v === "string") bits.push(k + " " + v);
      });
    }
  } catch (e) { /* ignore */ }
  return bits.join(" ");
}

function isDarkMode() {
  try { return document.body.classList.contains("theme-dark"); } catch (e) { return false; }
}

function detectSkin(fallback) {
  const plain = fallback || "industry";
  try {
    const theme = String((app.customCss && app.customCss.theme) || "");
    if (!FAS_THEME.test(theme)) return plain;
    const hay = theme + " " + styleSettingsBlob();
    const dark = isDarkMode();
    if (FAS_DECO.test(hay)) return dark ? "art-deco-night" : "art-deco";
    if (FAS_MED.test(hay)) return dark ? "medieval-night" : "medieval";
    return plain;
  } catch (e) { return plain; }
}

/* --------------------------------------------------------------- structure */

const STRUCTURE = `
.tk{ color:var(--tk-tx); font-family:var(--tk-font); font-size:var(--tk-fs,14px); line-height:1.5; }
.tk *{ box-sizing:border-box; }
.tk button{ font-family:inherit; }
.tk-page{ width:100%; max-width:var(--tk-max,none); margin:0 auto; padding:var(--tk-page-pad,0); }
.tk-shell{ position:relative; padding:var(--tk-shell-pad,0); border-radius:var(--tk-rad);
  background:var(--tk-page,transparent); border:var(--tk-shell-bd,0); box-shadow:var(--tk-shell-sh,none); }
.tk-inner{ position:relative; z-index:1; }

/* hero */
.tk-hero{ position:relative; overflow:visible; margin-bottom:var(--tk-hero-mb,18px); }
.tk-hero-fx{ position:absolute; inset:-30% -6% auto -6%; height:190%; pointer-events:none;
  background:var(--tk-hero-fx,none); opacity:.9; border-radius:var(--tk-rad); }
.tk-hero-in{ position:relative; z-index:1; padding:var(--tk-hero-pad); background:var(--tk-hero);
  border:var(--tk-hero-bd); border-radius:var(--tk-rad); box-shadow:var(--tk-hero-sh,none);
  backdrop-filter:var(--tk-blur,none); text-align:var(--tk-hero-al,left); }
.tk-head-row{ display:flex; align-items:flex-start; gap:22px; flex-wrap:wrap; }
.tk-head-row > .who{ flex:1; min-width:250px; }
.tk-kick{ font-family:var(--tk-fonth); font-size:10px; letter-spacing:var(--tk-kick-ls,.22em);
  text-transform:uppercase; color:var(--tk-mut); font-weight:600; }
.tk-titlerow{ display:flex; align-items:baseline; gap:16px; flex-wrap:wrap;
  justify-content:var(--tk-hero-jc,flex-start); margin:8px 0 5px; }
.tk-title{ font-family:var(--tk-fontd); font-size:clamp(27px,3.2vw,44px); font-weight:var(--tk-title-w,700);
  letter-spacing:var(--tk-title-ls,-.02em); line-height:1.04; color:var(--tk-tx-strong,var(--tk-tx)); }
.tk-wkmark{ font-family:var(--tk-fonth); font-size:11px; letter-spacing:.2em; text-transform:uppercase;
  color:var(--tk-acc); border:1px solid var(--tk-bd); border-radius:var(--tk-rad2); padding:4px 10px;
  font-variant-numeric:tabular-nums; white-space:nowrap; }
.tk-sub{ color:var(--tk-mut); font-size:13.5px; font-style:var(--tk-sub-i,normal); }
.tk-hero-ctl{ display:flex; flex-direction:column; align-items:flex-end; gap:10px; }
.tk-seg{ display:inline-flex; border:1px solid var(--tk-bd2); border-radius:var(--tk-rad2); overflow:hidden; }
.tk-seg button{ font-family:var(--tk-fonth); font-size:10px; font-weight:600; cursor:pointer;
  padding:5px 11px; border:none; color:var(--tk-mut); background:transparent;
  letter-spacing:.1em; text-transform:uppercase; }
.tk-seg button.on{ color:var(--tk-onacc); background:var(--tk-acc); }

/* stat tiles */
.tk-tiles{ display:grid; grid-template-columns:repeat(auto-fit,minmax(148px,1fr)); gap:10px;
  margin-top:22px; text-align:left; }
.tk-tile{ position:relative; overflow:hidden; padding:13px 14px 12px; border-radius:var(--tk-rad2);
  background:var(--tk-tile); border:1px solid var(--tk-bd2); box-shadow:var(--tk-tile-sh,none); }
.tk-tile .cap{ position:absolute; left:0; top:0; width:100%; height:2px; opacity:.85; }
.tk-tile i{ display:block; font-style:normal; font-family:var(--tk-fonth); font-size:9px;
  letter-spacing:.16em; text-transform:uppercase; color:var(--tk-fnt); font-weight:700; }
.tk-tile b{ display:block; font-family:var(--tk-fonth); font-size:26px; font-weight:var(--tk-num-w,700);
  letter-spacing:-.015em; line-height:1.15; margin-top:6px; color:var(--tk-tx-strong,var(--tk-tx));
  font-variant-numeric:tabular-nums; }
.tk-tile em{ display:block; font-style:var(--tk-sub-i,normal); font-size:11.5px; color:var(--tk-mut); margin-top:3px; }
.tk-meter{ position:relative; height:3px; border-radius:2px; background:var(--tk-trk);
  margin-top:11px; overflow:hidden; }
.tk-meter i{ position:absolute; left:0; top:0; bottom:0; border-radius:2px; display:block; }

/* panel rows */
.tk-row3{ display:grid; grid-template-columns:repeat(auto-fit,minmax(330px,1fr));
  gap:var(--tk-gap,16px); margin-bottom:var(--tk-gap,16px); }
.tk-row2{ display:grid; grid-template-columns:repeat(auto-fit,minmax(460px,1fr));
  gap:var(--tk-gap,16px); margin-bottom:var(--tk-gap,16px); }
.tk-full{ margin-bottom:var(--tk-gap,16px); }
.tk-full:last-child{ margin-bottom:0; }
.tk-panel{ padding:var(--tk-pnl-pad,18px 19px 17px); border-radius:var(--tk-rad); background:var(--tk-pnl);
  border:1px solid var(--tk-bd); box-shadow:var(--tk-sh); backdrop-filter:var(--tk-blur,none); min-width:0; }

/* panel header — new markup */
.tk-ph{ display:flex; align-items:center; gap:10px; margin-bottom:15px; flex-wrap:wrap; }
.tk-ph .mk{ font-family:var(--tk-fonth); font-size:11.5px; color:var(--tk-orn); line-height:1;
  letter-spacing:.1em; flex:0 0 auto; }
.tk-ph h3{ margin:0; font-family:var(--tk-fonth); font-size:12px; font-weight:700;
  letter-spacing:var(--tk-hd-ls,.04em); text-transform:var(--tk-hd-tf,none); color:var(--tk-hd-c,var(--tk-tx)); }
.tk-ph .rule{ flex:1; min-width:12px; height:1px; background:var(--tk-hd-rule,var(--tk-bd2)); }
.tk-ph .note{ font-size:11px; color:var(--tk-fnt); white-space:nowrap; }

/* legacy panel header — still used by the hub */
.tk-panel > h3{ margin:0 0 3px; font-family:var(--tk-fonth); font-size:12px; font-weight:700;
  letter-spacing:var(--tk-hd-ls,.03em); text-transform:var(--tk-hd-tf,none);
  color:var(--tk-hd-c,var(--tk-tx)); display:flex; align-items:center; gap:9px; }
.tk-panel > h3 .dot{ width:7px; height:7px; border-radius:99px; flex:0 0 auto; }
.tk-panel > h3:after{ content:''; flex:1; height:1px; background:var(--tk-hd-rule,transparent); }
.tk-panel > p.n{ margin:0 0 14px; font-size:12px; color:var(--tk-fnt); font-style:var(--tk-sub-i,normal); }
.tk-grid{ display:grid; grid-template-columns:repeat(12,1fr); gap:var(--tk-gap,14px); }
.s12{grid-column:span 12} .s8{grid-column:span 8} .s7{grid-column:span 7}
.s6{grid-column:span 6} .s5{grid-column:span 5} .s4{grid-column:span 4}
@media (max-width:1000px){ .s8,.s7,.s6,.s5,.s4{grid-column:span 12} }

/* donut */
.tk-dw{ display:flex; gap:20px; align-items:center; flex-wrap:wrap; }
.tk-donut{ position:relative; flex:0 0 auto; }
.tk-dmid{ position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
.tk-dmid b{ font-family:var(--tk-fonth); font-size:31px; font-weight:var(--tk-num-w,700); line-height:1;
  color:var(--tk-tx-strong,var(--tk-tx)); font-variant-numeric:tabular-nums; }
.tk-dmid i{ font-style:var(--tk-sub-i,normal); font-size:11px; color:var(--tk-mut); margin-top:5px; }
.tk-legend{ flex:1; min-width:150px; display:flex; flex-direction:column; gap:7px; }
.tk-lg{ display:flex; align-items:center; gap:9px; font-size:12.5px; }
.tk-lg .sw{ width:10px; height:10px; border-radius:var(--tk-cell-rad,3px); flex:0 0 auto; }
.tk-lg .nm{ flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.tk-lg .vl{ color:var(--tk-mut); font-variant-numeric:tabular-nums; font-size:12px; }

/* aligned bar rows */
.tk-bars{ display:grid; grid-template-columns:minmax(96px,1.15fr) minmax(120px,3fr) max-content;
  column-gap:14px; row-gap:10px; align-items:center; font-size:12.5px; }
.tk-bar{ display:contents; }
.tk-bar .lb{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0; }
.tk-bar .tk-track2{ position:relative; height:16px; border-radius:var(--tk-bar-rad,99px);
  background:var(--tk-trk); box-shadow:var(--tk-inset,none); overflow:hidden; min-width:0; }
.tk-bar .fl{ position:absolute; inset:0 auto 0 0; border-radius:var(--tk-bar-rad,99px); opacity:.24; }
.tk-bar .fd{ position:absolute; inset:0 auto 0 0; border-radius:var(--tk-bar-rad,99px); box-shadow:var(--tk-bar-sh,none); }
.tk-bar .vl{ font-variant-numeric:tabular-nums; color:var(--tk-mut); font-size:11.5px; white-space:nowrap; text-align:right; }

/* day columns */
.tk-days{ display:flex; gap:9px; align-items:flex-end; }
.tk-day{ flex:1; display:flex; flex-direction:column; align-items:center; gap:6px; min-width:0; }
.tk-col{ width:100%; height:132px; display:flex; flex-direction:column; justify-content:flex-end;
  border-bottom:var(--tk-axis,none); }
.tk-stack{ position:relative; width:100%; border-radius:var(--tk-col-rad,7px 7px 3px 3px); overflow:hidden;
  background:var(--tk-trk); border:1px solid var(--tk-bd2); }
.tk-stack i{ position:absolute; left:0; right:0; bottom:0; display:block; box-shadow:var(--tk-bar-sh,none); }
.tk-dl{ font-family:var(--tk-fonth); font-size:10px; letter-spacing:.1em; text-transform:uppercase;
  color:var(--tk-mut); font-weight:600; }
.tk-dv{ font-size:11px; color:var(--tk-fnt); font-variant-numeric:tabular-nums; }

/* timeline */
.tk-ax{ position:relative; height:15px; margin-left:46px; margin-right:60px; margin-bottom:5px; }
.tk-ax span{ position:absolute; font-size:10px; color:var(--tk-fnt); font-variant-numeric:tabular-nums; }
.tk-tr{ display:flex; align-items:center; gap:8px; margin-bottom:5px; }
.tk-tday{ width:38px; flex:0 0 38px; font-family:var(--tk-fonth); font-size:10px; letter-spacing:.1em;
  text-transform:uppercase; color:var(--tk-mut); text-align:right; font-weight:600; }
.tk-ttot{ width:52px; flex:0 0 52px; font-size:11px; color:var(--tk-fnt); font-variant-numeric:tabular-nums; }
.tk-track{ position:relative; flex:1; height:24px; border-radius:var(--tk-bar-rad,7px); background:var(--tk-trk);
  border:1px solid var(--tk-bd2); box-shadow:var(--tk-inset,none); overflow:hidden; }
.tk-tick{ position:absolute; top:0; bottom:0; width:1px; background:var(--tk-bd); opacity:.5; }
.tk-tick.maj{ opacity:.85; }
.tk-blk{ position:absolute; top:3px; bottom:3px; border-radius:var(--tk-cell-rad,3px); min-width:2px;
  box-shadow:var(--tk-bar-sh,none); }
.tk-blk.undone{ opacity:.32; }
.tk-open{ position:absolute; top:0; bottom:0; width:0; border-left:2px dashed var(--tk-warn); }

/* tables */
.tk-wrap{ overflow-x:auto; }
table.tk-t{ width:100%; border-collapse:collapse; font-size:12.5px; }
/* fixed layout keeps every column on screen; the first one absorbs the slack */
table.tk-t.fixed{ table-layout:fixed; }
table.tk-t.fixed th,table.tk-t.fixed td{ overflow:hidden; }
table.tk-t th.day,table.tk-t td.day{ padding-left:4px; padding-right:4px; text-align:center; }
table.tk-t th{ font-family:var(--tk-fonth); font-size:9px; letter-spacing:.13em; text-transform:uppercase;
  color:var(--tk-fnt); font-weight:700; text-align:left; padding:0 8px 9px;
  border-bottom:1px solid var(--tk-bd); white-space:nowrap; }
table.tk-t td{ padding:7px 8px; border-bottom:1px solid var(--tk-bd2); vertical-align:middle; }
table.tk-t tr:hover td{ background:var(--tk-hover); }
.tk-cell{ display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px;
  border-radius:var(--tk-cell-rad,6px); font-size:11px; line-height:1; }
.tk-cell.done{ color:var(--tk-onacc); box-shadow:var(--tk-bar-sh,none); }
.tk-cell.missed{ border:1px dashed var(--tk-bd); color:var(--tk-fnt); }
.tk-cell.cancelled{ border:1px solid var(--tk-bd); color:var(--tk-fnt); }
.tk-cell.absent{ color:var(--tk-fnt); opacity:.35; }
.tk-pill{ display:inline-block; padding:1px 9px; border-radius:99px; font-size:11px; font-weight:600;
  font-variant-numeric:tabular-nums; background:var(--tk-tile); border:1px solid var(--tk-bd2); color:var(--tk-mut); }
.tk-mini{ position:relative; height:6px; border-radius:99px; background:var(--tk-trk); min-width:62px;
  box-shadow:var(--tk-inset,none); overflow:hidden; }
.tk-mini i{ position:absolute; left:0; top:0; bottom:0; border-radius:99px; display:block; }

/* metric cards */
.tk-mc{ display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:11px; }
.tk-card{ padding:12px 13px 11px; border-radius:var(--tk-rad2); background:var(--tk-tile);
  border:1px solid var(--tk-bd2); box-shadow:var(--tk-tile-sh,none); }
.tk-card h4{ margin:0; font-family:var(--tk-fonth); font-size:9px; letter-spacing:.14em;
  text-transform:uppercase; color:var(--tk-fnt); font-weight:700; }
.tk-card b{ display:block; font-family:var(--tk-fonth); font-size:23px; font-weight:var(--tk-num-w,700);
  letter-spacing:-.015em; margin:6px 0 2px; font-variant-numeric:tabular-nums; }
.tk-card em{ font-style:var(--tk-sub-i,normal); font-size:11px; color:var(--tk-mut); }
.tk-spark{ display:flex; align-items:flex-end; gap:3px; height:30px; margin-top:10px; }
.tk-spark i{ flex:1; border-radius:2px 2px 1px 1px; min-height:2px; display:block; }

/* heat matrix — the wash is a separate layer so fading it never fades the
   label sitting on top of it */
.tk-heat{ display:grid; gap:4px; }
.tk-heat .hd{ font-family:var(--tk-fonth); font-size:9px; letter-spacing:.1em; text-transform:uppercase;
  color:var(--tk-fnt); text-align:center; font-weight:700; }
.tk-heat .rl{ font-size:12px; color:var(--tk-mut); padding-right:8px; overflow:hidden;
  text-overflow:ellipsis; white-space:nowrap; text-align:right; align-self:center; }
.tk-heat .hc{ position:relative; overflow:hidden; height:26px; border-radius:var(--tk-cell-rad,6px);
  display:flex; align-items:center; justify-content:center; font-size:10.5px;
  font-variant-numeric:tabular-nums; background:var(--tk-trk); }
.tk-heat .hc .fill{ position:absolute; inset:0; border-radius:inherit; }
.tk-heat .hc .txt{ position:relative; z-index:1; font-weight:600; }

/* controls */
.tk-ctrl{ display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-bottom:14px; }
.tk-ctrl input[type=text]{ flex:1; min-width:170px; padding:7px 11px; font-size:12.5px; color:var(--tk-tx);
  background:var(--tk-tile); border:1px solid var(--tk-bd2); border-radius:var(--tk-rad2);
  box-shadow:var(--tk-inset,none); font-family:inherit; outline:none; }
.tk-btn{ font-family:var(--tk-fonth); font-size:10.5px; font-weight:600; cursor:pointer; padding:5px 10px;
  border-radius:var(--tk-rad2); border:1px solid var(--tk-bd2); color:var(--tk-mut);
  background:var(--tk-btn); box-shadow:var(--tk-tile-sh,none); letter-spacing:.08em;
  text-transform:uppercase; white-space:nowrap; }
.tk-btn:hover{ color:var(--tk-tx); border-color:var(--tk-acc); }
.tk-btn.on{ background:var(--tk-acc); color:var(--tk-onacc); border-color:var(--tk-acc); }
.tk-btn:active{ box-shadow:var(--tk-inset,none); transform:translateY(1px); }
.tk-btn.big{ font-size:12px; padding:9px 16px; }
.tk-btn.danger{ color:var(--tk-warn); border-color:var(--tk-warn); }
.tk-btn[disabled]{ opacity:.45; cursor:default; }
.tk-lbl{ font-size:11px; color:var(--tk-fnt); white-space:nowrap; }

/* ledger */
.tk-sec{ margin-bottom:11px; border-radius:var(--tk-rad2); overflow:hidden; border:1px solid var(--tk-bd2); }
.tk-sec > summary{ cursor:pointer; list-style:none; display:flex; align-items:center; gap:11px;
  padding:10px 13px; background:var(--tk-tile); }
.tk-sec > summary::-webkit-details-marker{ display:none; }
.tk-sec .swatch{ width:4px; height:18px; border-radius:99px; flex:0 0 auto; }
.tk-sec .swatch.mark{ width:auto; min-width:13px; height:auto; background:none !important;
  text-align:center; font-family:var(--tk-fonth); font-weight:600; line-height:1; }
.tk-sec h4{ margin:0; font-family:var(--tk-fonth); font-size:13px; font-weight:700; flex:1;
  color:var(--tk-tx-strong,var(--tk-tx)); }
.tk-sec .meta{ font-size:11px; color:var(--tk-fnt); font-variant-numeric:tabular-nums; }
.tk-rows{ display:grid; grid-template-columns:42px 92px 54px minmax(160px,1fr) max-content;
  column-gap:10px; align-items:baseline; }
.tk-row{ display:contents; }
.tk-row > *{ padding:6px 0; }
.tk-row > :first-child{ padding-left:13px; border-radius:var(--tk-rad2) 0 0 var(--tk-rad2); }
.tk-row > :last-child{ padding-right:13px; border-radius:0 var(--tk-rad2) var(--tk-rad2) 0; }
.tk-row.odd > *{ background:var(--tk-zebra,rgba(128,128,128,.055)); }
.tk-row:hover > *{ background:var(--tk-hover); }
.tk-row .d{ font-size:10px; letter-spacing:.08em; text-transform:uppercase; color:var(--tk-fnt); font-weight:600; }
.tk-row .t{ font-variant-numeric:tabular-nums; font-size:11.5px; color:var(--tk-mut); }
.tk-row .u{ font-size:11px; color:var(--tk-fnt); font-variant-numeric:tabular-nums; }
.tk-row .u.r{ text-align:right; }
.tk-row .n{ min-width:0; overflow-wrap:anywhere; }
.tk-row .n a{ color:var(--tk-link); text-decoration:none; cursor:pointer; }
.tk-row .n a:hover{ text-decoration:underline; }
.tk-row.sub .n{ padding-left:22px; }
.tk-row.is-done .n{ color:var(--tk-mut); }
.tk-row.is-cancelled .n{ color:var(--tk-fnt); text-decoration:line-through; }
.tk-mark{ margin-right:7px; }
.tk-chip{ display:inline-block; margin-left:7px; padding:0 7px; border-radius:99px; font-size:10.5px;
  background:var(--tk-trk); color:var(--tk-mut); border:1px solid var(--tk-bd2); white-space:nowrap; }
@media (max-width:760px){
  .tk-rows{ grid-template-columns:36px minmax(100px,1fr) max-content; }
  .tk-row .t,.tk-row .u:not(:last-child){ display:none; }
}

/* skin picker */
.tk-skins{ display:flex; gap:5px; align-items:center; flex-wrap:wrap; justify-content:flex-end;
  max-width:230px; flex:0 0 auto; }
.tk-sw{ width:18px; height:18px; padding:0; border-radius:var(--tk-rad2); cursor:pointer;
  border:1px solid var(--tk-bd); opacity:.55; transition:opacity .12s; }
.tk-sw:hover{ opacity:1; }
.tk-sw.on{ opacity:1; box-shadow:0 0 0 2px var(--tk-acc); }
.tk-empty{ text-align:center; padding:34px 20px; color:var(--tk-mut); font-size:13px; }
.tk-msg{ font-size:12.5px; color:var(--tk-ok); }
.tk-err{ font-size:12.5px; color:var(--tk-warn); }
.tk-foot{ display:flex; flex-wrap:wrap; gap:9px; align-items:center; margin-top:16px; padding-top:13px;
  border-top:1px solid var(--tk-bd2); }

/* ==========================================================================
   HOST RESET
   The report renders inside a note, so Obsidian's own table / details / form
   styling reaches it and wins on specificity — that is where the stray zebra
   rows and washed-out cell text came from.  These rules are deliberately
   heavier than the ones above and carry !important on the properties the skin
   must own; they are still scoped, so nothing leaks back into your notes.
   ========================================================================== */
.tk table.tk-t{ background:transparent !important; margin:0; box-shadow:none; }
.tk table.tk-t thead,.tk table.tk-t tbody,.tk table.tk-t tr{ background:transparent !important; }
.tk table.tk-t th,.tk table.tk-t td{ background:transparent !important;
  border-left:0; border-right:0; border-top:0; }
/* re-assert the intended colours at the same weight, or the reset above would
   hand them back to the host theme */
.tk table.tk-t th{ color:var(--tk-fnt); border-bottom:1px solid var(--tk-bd); }
.tk table.tk-t td{ color:var(--tk-tx); border-bottom:1px solid var(--tk-bd2); }
.tk table.tk-t tbody tr:hover > td{ background:var(--tk-hover) !important; }
.tk details.tk-sec{ background:transparent; margin-block:0; }
.tk details.tk-sec > summary{ background:var(--tk-tile); color:var(--tk-tx); }
.tk details.tk-sec > summary::marker,
.tk details.tk-sec > summary::-webkit-details-marker{ content:""; display:none; }

/* ornaments */
.tk-frame{ position:absolute; inset:11px; border:1px solid var(--tk-orn); opacity:.55; pointer-events:none; }
.tk-frame.in{ inset:16px; opacity:.4; }
.tk-corner{ position:absolute; color:var(--tk-orn); pointer-events:none; z-index:1; }
.tk-reg{ position:absolute; width:13px; height:13px; color:var(--tk-acc); pointer-events:none; z-index:2; }
.tk-rule{ display:flex; align-items:center; gap:14px; margin:0 0 20px; color:var(--tk-orn); }
.tk-rule:before,.tk-rule:after{ content:''; flex:1; height:1px;
  background:linear-gradient(90deg,transparent,currentColor); }
.tk-rule:after{ background:linear-gradient(90deg,currentColor,transparent); }
.tk-rule span{ font-size:15px; letter-spacing:.3em; font-family:var(--tk-fonth); }
`;

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

const LEGACY = { "fancy-a-story": "fancy" };
function normalise(id) {
  if (SKINS[id]) return id;
  if (LEGACY[id] && SKINS[LEGACY[id]]) return LEGACY[id];
  return "industry";
}

/* Turn a skin's variable map into the `.tk{ … }` block the report injects.
   `opts` carries the two layout knobs so density and width ride along with
   the rest of the theme instead of needing their own stylesheet. */
function vars(id, opts) {
  opts = opts || {};
  const dense = opts.density === "compact";
  return Object.assign({}, BASE, SKINS[normalise(id)].v, {
    "--tk-gap": dense ? "10px" : "16px",
    "--tk-pnl-pad": dense ? "13px 14px 12px" : "18px 19px 17px",
    "--tk-max": opts.fullWidth === false ? "900px" : "none"
  });
}

function skinCss(id, scope, opts) {
  id = normalise(id);
  ensureFont(id);
  const v = vars(id, opts);
  const decl = Object.keys(v).map(function (k) { return k + ":" + v[k] + ";"; }).join("");
  return scopeCss(STRUCTURE + "\n.tk{" + decl + "}\n", scope);
}

function palette(id) { return SKINS[normalise(id)].pal; }
function flags(id) {
  const s = SKINS[normalise(id)];
  return { id: normalise(id), ornate: !!s.ornate, med: !!s.med, deco: !!s.deco, ind: !!s.ind,
    riso: normalise(id) === "riso" };
}
/* kept for callers written against the old two-skin world */
function isFancy(id) { return flags(id).ornate; }
function isMedieval(id) { return flags(id).ornate; }

return {
  SKIN_LIST: SKIN_LIST, SKINS: SKINS, ORDER: ORDER, PALETTES: PALETTES, BASE: BASE,
  skinCss: skinCss, vars: vars, palette: palette, flags: flags,
  isFancy: isFancy, isMedieval: isMedieval, normalise: normalise, scopeCss: scopeCss,
  detectSkin: detectSkin, isDarkMode: isDarkMode, ensureFont: ensureFont
};
