/* Datacore-shaped globals for the browser preview. Same fake vault as the node
   harness; the point of this one is layout and hit testing. */
(function () {
  var h = preact.h, Fragment = preact.Fragment, render = preact.render;
  window.h = h; window.Fragment = Fragment;

  var PAPERS = [
    { path: "Papers/Attention Is All You Need.md", fm: {
      author: ["A. Vaswani", "N. Shazeer", "N. Parmar"],
      affiliation: ["Google Brain", "Google Research"],
      venue: "NeurIPS", year: 2017, citations: 188791, tier: "S+++",
      status: "reading", pages: 15, progress: 9, highlights: 41, figure: 3,
      tags: ["paper", "transformer", "attention"], paper: "[[attention.pdf]]",
      "builds-on": ["[[Neural Machine Translation]]"], related: ["[[Layer Normalization]]"],
      claim: "Attention alone, no recurrence." } },
    { path: "Papers/Layer Normalization.md", fm: {
      author: ["J. Ba", "J. Kiros", "G. Hinton"], affiliation: ["University of Toronto"],
      venue: "arXiv", year: 2016, citations: 9000, tier: "A",
      tags: ["paper", "transformer", "attention"], paper: "[[layernorm.pdf]]" } },
    { path: "Papers/Neural Machine Translation.md", fm: {
      author: ["D. Bahdanau"], affiliation: ["Jacobs University"], year: 2015,
      citations: 30000, tags: ["paper", "attention"] } },
    { path: "Papers/Deep Residual Learning.md", fm: {
      author: ["K. He"], affiliation: ["MSRA"], venue: "CVPR", year: 2016,
      citations: 200000, tags: ["paper", "vision"], status: "planned" } },
    { path: "Papers/An Image Is Worth 16x16 Words.md", fm: {
      author: ["A. Dosovitskiy"], affiliation: ["Google"], year: 2021,
      citations: 40000, tags: ["paper", "vision"], status: "planned" } },
    { path: "Papers/A Paper With No Venue.md", fm: { author: ["X. Nobody"], tags: ["paper", "vision"] } },
    { path: "Papers/Adam.md", fm: {
      author: ["D. Kingma"], affiliation: ["OpenAI"], venue: "ICLR", year: 2015,
      citations: 150000, tags: ["paper", "optimisation"], status: "planned" } },
    { path: "Papers/Batch Normalization.md", fm: {
      author: ["S. Ioffe"], affiliation: ["Google"], venue: "ICML", year: 2015,
      citations: 50000, tags: ["paper", "optimisation"] } },
  ];
  var byPath = {}; PAPERS.forEach(function (p) { byPath[p.path] = p; });
  var fakeFile = function (p) {
    return { path: p, name: p.split("/").pop(), extension: p.split(".").pop(),
      stat: { mtime: 1700000000000, size: 1000 } };
  };

  window.app = {
    metadataCache: {
      getCache: function (p) { return byPath[p] ? { frontmatter: byPath[p].fm, tags: [] } : null; },
      getFirstLinkpathDest: function (link) {
        var bare = String(link).replace(/\.md$/, "");
        for (var i = 0; i < PAPERS.length; i++) {
          if (PAPERS[i].path.replace(/\.md$/, "").endsWith(bare)) return fakeFile(PAPERS[i].path);
        }
        if (/\.pdf$/i.test(link)) return fakeFile("PDFs/" + link);
        return null;
      },
    },
    vault: {
      getAbstractFileByPath: function (p) { return byPath[p] ? fakeFile(p) : null; },
      readBinary: function () { return Promise.resolve(new ArrayBuffer(8)); },
      adapter: { exists: function () { return Promise.resolve(false); } },
    },
    workspace: { openLinkText: function () { window.__opened.push([].slice.call(arguments)); },
      getActiveFile: function () { return null; } },
    fileManager: { processFrontMatter: function () { return Promise.resolve(); } },
  };
  window.__opened = [];

  var modules = {};
  function requireFile(rel) {
    if (modules[rel]) return modules[rel];
    var code = window.__MODULES__[rel];
    if (!code) return Promise.reject(new Error("no module " + rel));
    var fn = new Function("dc", "app", "h", "Fragment", "return (async () => { " + code + " })();");
    modules[rel] = fn(dc, window.app, h, Fragment);
    return modules[rel];
  }

  var dc = window.dc = {
    require: requireFile,
    useState: preactHooks.useState, useEffect: preactHooks.useEffect,
    useLayoutEffect: preactHooks.useLayoutEffect, useMemo: preactHooks.useMemo,
    useCallback: preactHooks.useCallback, useRef: preactHooks.useRef,
    useReducer: preactHooks.useReducer, useContext: preactHooks.useContext,
    useIndexUpdates: function () { return 0; },
    useCurrentPath: function () { return "Notes/Drawers.md"; },
    useCurrentFile: function () { return null; },
    useQuery: function () { return PAPERS.map(function (p) { return { $path: p.path }; }); },
  };

  /* The preview pane serves this page as a data: URL and never reloads it, so
     switching view or skin is a function call rather than a query string. */
  window.mount = function (which, design, leaf) {
    which = which || "drawers"; design = design || "medieval"; leaf = leaf || "scroll";
    return requireFile("Meta/Obsidian/_datacore/paper/drawers.jsx").then(function (drawers) {
      return requireFile("Meta/Obsidian/_datacore/paper/views.jsx").then(function (views) {
        var C = which === "drawers" ? drawers.Drawers
          : which === "constellation" ? views.Constellation
          : which === "pinboard" ? views.Pinboard : views.ContactSheet;
        var host = document.getElementById("mount");
        render(null, host);          // tear the old one down so state resets
        host.innerHTML = "";
        render(h(C, { design: design, tag: ["paper"], leaf: leaf }), host);
        document.getElementById("probe").textContent =
          "mounted: " + which + " / " + design + " / " + leaf;
        return "mounted " + which + " " + design + " " + leaf;
      });
    }).catch(function (e) {
      document.getElementById("probe").textContent = "MOUNT FAILED: " + (e && e.stack || e);
      return "FAILED: " + (e && e.message || e);
    });
  };
  window.mount("drawers", "medieval", "scroll");

  /* What is actually under the pointer at the middle of each leaf? This is the
     question the node harness cannot ask. */
  window.probeLeaves = function () {
    var out = [];
    document.querySelectorAll(".pvd-leaf").forEach(function (el, i) {
      var r = el.getBoundingClientRect();
      var x = r.left + r.width / 2, y = r.top + r.height / 2;
      var hit = document.elementFromPoint(x, y);
      out.push({
        i: i,
        box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
        onTop: hit ? (hit.className && hit.className.baseVal !== undefined
          ? hit.className.baseVal : hit.className) || hit.tagName : null,
        reachesLeaf: !!(hit && (hit === el || el.contains(hit))),
      });
    });
    return out;
  };
  /* Open one paper and report the shape of the overlay: are the two slabs
     centred, is the page fitted to the height, does RELATED carry only the
     relations that are actually in frontmatter. */
  window.probeOverlay = function () {
    var veil = document.querySelector(".pv-veil");
    if (!veil) return "no overlay";
    var read = veil.querySelector(".pv-read");
    var face = veil.querySelector(".pv-read-face");
    var marg = veil.querySelector(".pv-read-margin");
    var vr = veil.getBoundingClientRect(), rr = read.getBoundingClientRect();
    var fr = face.getBoundingClientRect(), mr = marg.getBoundingClientRect();
    var box = function (r) { return [Math.round(r.width), Math.round(r.height)]; };
    return {
      veil: box(vr), read: box(rr),
      readPct: [Math.round(rr.width / vr.width * 100), Math.round(rr.height / vr.height * 100)],
      face: box(fr), margin: box(mr),
      gapLeft: Math.round(rr.left - vr.left),
      gapRight: Math.round(vr.right - rr.right),
      slackLeft: Math.round(fr.left - rr.left),
      slackRight: Math.round(rr.right - mr.right),
      pageFillsHeight: Math.abs(fr.height - rr.height) < 2,
      titleInMargin: !!marg.querySelector(".pv-read-title"),
      titleInFace: !!face.querySelector(".pv-read-title"),
      relatedWhys: Array.prototype.map.call(veil.querySelectorAll(".pv-mini-why"),
        function (e) { return e.textContent; }),
      addButtons: veil.querySelectorAll(".pv-mini-add").length,
      twins: veil.querySelectorAll(".pv-twin").length,
      tags: Array.prototype.map.call(veil.querySelectorAll(".pv-tag"),
        function (e) { return e.textContent; }),
    };
  };
  window.queueText = function () {
    return Array.prototype.map.call(document.querySelectorAll(".pvd-corner-label"),
      function (e) { return e.textContent; }).join(" | ");
  };
  window.clickLeaf = function (i) {
    var el = document.querySelectorAll(".pvd-leaf")[i || 0];
    if (!el) return "no leaf";
    var r = el.getBoundingClientRect();
    var x = r.left + r.width / 2, y = r.top + r.height / 2;
    var top = document.elementFromPoint(x, y);
    if (!top) return "nothing at " + x + "," + y;
    ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach(function (t) {
      top.dispatchEvent(new MouseEvent(t, {
        bubbles: true, cancelable: true, clientX: x, clientY: y, detail: t === "click" ? 1 : 0,
      }));
    });
    return { hitClass: top.className, queue: window.queueText() };
  };
})();
