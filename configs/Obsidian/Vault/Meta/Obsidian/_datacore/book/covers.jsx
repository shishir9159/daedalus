// ════════════════════════════════════════════════════════════════════════════
//  covers.jsx  —  the largest cover there is for a book
//  Location: Meta/Obsidian/_datacore/book/covers.jsx
//
//  Chosen by measuring candidates, not by trusting any one provider:
//
//    - Amazon needs an ASIN; for a print book that is the ISBN-10, which a
//      978- ISBN-13 gives up for free. A missing ASIN answers 200 with a 1x1
//      placeholder pixel, so the only honest test is decoding the bytes.
//    - m.media-amazon.com is the current CDN; images-amazon.com the legacy one.
//    - Apple Books' artwork is often 1400-3000 px, better than Amazon's.
//
//  So: a ranked candidate list, each downloaded and its real pixel size read
//  out of the bytes, the largest kept, and a stop once one is clearly enough.
//
//  Used by book/populate.jsx. Downloads need requestUrl or Node (desktop).
//
//  NOTE: never declare a local named `h` in this file — it is the JSX pragma.
// ════════════════════════════════════════════════════════════════════════════

const core = await dc.require("Meta/Obsidian/_datacore/populate/core.jsx");

// ── Apple ───────────────────────────────────────────────────────────────────
/**
 * iTunes / Apple Books lookup (sends CORS headers). artworkUrl100 ends in
 * /100x100bb.jpg; asking for a larger box returns the source image, never
 * upscaled. Measured: 3000x3000bb.jpg → 1400x2076 (native), 2000x2000bb.jpg →
 * 1349x2000.
 */
async function appleCandidates({ isbn13, title, author }) {
  let json = null;
  if (isbn13) {
    json = await core.netJson(`https://itunes.apple.com/lookup?isbn=${isbn13}&entity=ebook`, { retries: 1 });
  }
  if (!json?.results?.length && title) {
    const term = encodeURIComponent(core.squish(`${title} ${author ?? ""}`));
    json = await core.netJson(`https://itunes.apple.com/search?term=${term}&entity=ebook&limit=5`, { retries: 1 });
  }
  const hits = json?.results ?? [];
  if (!hits.length) return [];

  // searched by name: only a close title match is trusted
  const want = core.normTitle(title);
  const pick = isbn13 && hits.length === 1
    ? hits[0]
    : hits.find((hit) => want && core.normTitle(hit.trackName).startsWith(want.slice(0, 24))) ?? null;
  if (!pick?.artworkUrl100) return [];

  const art = pick.artworkUrl100;
  const box = (n) => art.replace(/\/\d+x\d+[a-z-]*\.(jpg|png)$/i, `/${n}x${n}bb.jpg`);
  return [box(3000), box(2000)];
}

// ── Amazon ──────────────────────────────────────────────────────────────────
/**
 * The P/{ASIN} path is the old product-image endpoint and still the best
 * cover URL there is. Measured on 0262039249:
 *   .01.MAIN._SCRM_.jpg   1536x2116  ← the winner
 *   .01._SCLZZZZZZZ_.jpg   363x500   (the legacy small asset)
 * _SCRM_ leads; the rest are for ASINs where it 404s.
 */
function amazonCandidates(asin) {
  if (!asin) return [];
  const cdn = "https://m.media-amazon.com/images/P/";
  const legacy = "https://images-na.ssl-images-amazon.com/images/P/";
  return [
    `${cdn}${asin}.01.MAIN._SCRM_.jpg`,
    `${cdn}${asin}.01._SCLZZZZZZZ_.jpg`,
    `${legacy}${asin}.01.MAIN._SCRM_.jpg`,
  ];
}

// ── Google Books ────────────────────────────────────────────────────────────
/**
 * imageLinks are thumbnails, but zoom=0 serves full size and &fife=w1600
 * forces a width. edge=curl paints a fake page curl, so it goes.
 */
function googleCandidates(volume) {
  const links = volume?.volumeInfo?.imageLinks ?? {};
  const base = links.extraLarge || links.large || links.medium || links.small
    || links.thumbnail || links.smallThumbnail;
  const out = [];
  if (base) {
    const full = base.replace(/^http:/, "https:").replace(/&edge=curl/g, "").replace(/([?&])zoom=\d+/, "$1zoom=0");
    out.push(full, `${full}&fife=w1600`);
  }
  if (volume?.id) {
    out.push(`https://books.google.com/books/publisher/content?id=${volume.id}&printsec=frontcover&img=1&zoom=0&source=gbs_api`);
  }
  return out;
}

// ── Open Library ────────────────────────────────────────────────────────────
/** default=false makes a missing cover 404 rather than answer a blank image. */
function openLibraryCandidates({ isbn13, isbn10, olCoverId }) {
  const out = [];
  if (olCoverId) out.push(`https://covers.openlibrary.org/b/id/${olCoverId}-L.jpg?default=false`);
  for (const i of [isbn13, isbn10]) {
    if (i) out.push(`https://covers.openlibrary.org/b/isbn/${i}-L.jpg?default=false`);
  }
  return out;
}

// ── the chooser ─────────────────────────────────────────────────────────────
/**
 * Download each candidate, read its real size, keep the biggest. Stages are
 * lazy and ranked by measured quality — Amazon, Apple, Google, Open Library
 * (which tops out near 500 px) — so a hit on Amazon costs nothing else.
 *
 * @returns {Promise<null | {url, buffer, width, height, ext, bytes, tried} | {failed, tried}>}
 */
async function resolveCover(ctx) {
  const { minWidth = 260, minBytes = 3000, goodEnoughHeight = 1200 } = core.CONFIG.book;

  const stages = [
    () => amazonCandidates(ctx.asin),
    () => appleCandidates(ctx),
    () => googleCandidates(ctx.googleVolume),
    () => openLibraryCandidates(ctx),
  ];

  let best = null;
  const tried = [];
  const seen = new Set();

  for (const stage of stages) {
    for (const url of core.uniq(await stage())) {
      if (seen.has(url)) continue;
      seen.add(url);

      // image hosts send no CORS headers: requestUrl or Node only
      const res = await core.netGet(url, { crossOrigin: true, binary: true, timeout: core.CONFIG.net.timeoutMs });
      if (!res?.arrayBuffer || res.status >= 400) {
        tried.push([url, res ? `HTTP ${res.status}` : "blocked"]);
        continue;
      }

      const bytes = res.arrayBuffer.byteLength;
      const size = core.imageSize(res.arrayBuffer);
      // A missing ASIN still answers 200 with a placeholder pixel.
      if (!size || bytes < minBytes || (size.width && size.width < minWidth)) {
        tried.push([url, size ? `${size.width}x${size.height} (${bytes}B)` : "not an image"]);
        continue;
      }
      tried.push([url, `${size.width}x${size.height}`]);

      const area = (size.width || 1) * (size.height || 1);
      if (!best || area > best.width * best.height) {
        best = { url, buffer: res.arrayBuffer, width: size.width, height: size.height, ext: size.ext, bytes };
      }
      if (best.height >= goodEnoughHeight) return { ...best, tried };   // no point paying for more
    }
  }

  if (best) return { ...best, tried };
  return tried.length ? { failed: true, tried } : null;
}

return { resolveCover, appleCandidates, amazonCandidates, googleCandidates, openLibraryCandidates };
