import { dc, requireFile, h, render, win } from "./env.mjs";
import { act } from "preact/test-utils";

const P = "Meta/Obsidian/_datacore/paper/drawers.jsx";
const { Drawers } = await requireFile(P);

const root = document.createElement("div");
document.body.appendChild(root);

let fails = 0;
const ok = (label, cond, extra = "") => {
  console.log(`${cond ? "  ok  " : "  FAIL"}  ${label}${extra ? "  — " + extra : ""}`);
  if (!cond) fails++;
};

const settle = async (ms = 0) => {
  await act(async () => { await new Promise((r) => setTimeout(r, ms)); });
};

await act(async () => {
  render(h(Drawers, { design: "medieval", tag: ["paper"] }), root);
});
await settle(30);

const $ = (s) => root.querySelector(s);
const $$ = (s) => Array.from(root.querySelectorAll(s));

console.log("\n== mount");
ok("a chest rendered", !!$(".pvd-stack"));
ok("drawers exist", $$(".pvd-drawer").length > 0, `${$$(".pvd-drawer").length} drawers`);
ok("one drawer is open", $$(".pvd-drawer.is-open").length === 1);
ok("leaves are in the open drawer", $$(".pvd-leaf").length > 0, `${$$(".pvd-leaf").length} leaves`);

const queueLabel = () => $$(".pvd-corner-label").map((e) => e.textContent).join(" | ");
console.log("     corner:", queueLabel());

console.log("\n== left click a leaf");
const leaf = $(".pvd-leaf");
const click = async (el, init = {}) => {
  await act(async () => {
    el.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true, detail: 1, ...init }));
    await new Promise((r) => setTimeout(r, 0));
  });
};
await click(leaf);
await settle(20);
console.log("     corner:", queueLabel());
ok("QUEUE count is 1 after one click", /QUEUE 1\b/.test(queueLabel()));
ok("the leaf is stamped QUEUED", $$(".pvd-stamp").length >= 1);

console.log("\n== second leaf");
const leaf2 = $$(".pvd-leaf")[1];
if (leaf2) { await click(leaf2); await settle(20); }
console.log("     corner:", queueLabel());
ok("QUEUE count is 2 after two clicks", /QUEUE 2\b/.test(queueLabel()));

console.log("\n== open the queue overlay");
await click($(".pvd-tray-btn"));
await settle(20);
ok("the queue overlay opened", !!$(".pvd-veil.is-queue"));
ok("it does not say 'nothing waiting'", !/nothing waiting/.test(root.textContent),
  ($(".pvd-veil-pos")?.textContent ?? "").trim());
ok("a queue card is showing", !!$(".pvd-qcard"));

console.log("\n== escape closes it, right-click shuts the drawer");
await act(async () => {
  win.document.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  window.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await new Promise((r) => setTimeout(r, 0));
});
await settle(10);
ok("queue overlay closed", !$(".pvd-veil.is-queue"));

const openDrawer = $(".pvd-drawer.is-open");
await act(async () => {
  openDrawer.dispatchEvent(new win.MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 0));
});
await settle(20);
ok("right-click leaves the chest shut", $$(".pvd-drawer.is-open").length === 0,
  `${$$(".pvd-drawer.is-open").length} still open`);

console.log("\n== the reading panel");
{
  // reopen the transformer drawer and double-click Attention
  const front = $$(".pvd-front").find((f) => /transformer/i.test(f.textContent));
  await click(front);
  await settle(30);
  const att = $$(".pvd-leaf").find((l) => /Attention/.test(l.textContent));
  await click(att, { detail: 2 });
  await settle(30);

  ok("the panel opened", !!$(".pv-veil"));
  ok("nothing after the abstract but RELATED", $$(".pv-field").length === 0,
    `${$$(".pv-field").length} field rows`);
  ok("no coffee ring in the panel", $$(".pv-stain").length === 0);
  ok("RELATED is there", $$(".pv-mini").length > 0, `${$$(".pv-mini").length} related`);
  ok("its captions are the frontmatter relations",
    $$(".pv-mini-why").map((e) => e.textContent).join(",") === "builds on,related",
    $$(".pv-mini-why").map((e) => e.textContent).join(","));
  ok("one pair is mirror twins", $$(".pv-twin").length === 1);
  ok("the citation count is in the eyebrow", /cited/i.test($(".pv-eyebrow").textContent),
    $(".pv-eyebrow").textContent.trim());

  // the + queues and does not open
  const wasTitle = $(".pv-read-title").textContent;
  const adds = $$(".pv-mini-add").length;
  await click($(".pv-mini-add"));
  await settle(20);
  ok("+ leaves the panel on the same paper", $(".pv-read-title").textContent === wasTitle);
  ok("+ removes itself once queued", $$(".pv-mini-add").length === adds - 1);

  // right-click anywhere closes it
  await act(async () => {
    $(".pv-read-margin").dispatchEvent(
      new win.MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 0));
  });
  await settle(20);
  ok("right-click closes the panel", !$(".pv-veil"));
  ok("and does not shut the drawer under it", $$(".pvd-drawer.is-open").length === 1);
}

console.log("\n== words that should not appear");
ok("no 'unpublished' anywhere", !/unpublished/i.test(root.textContent));
ok("no 'drawn down' anywhere", !/drawn down/i.test(root.textContent));

console.log(`\n${fails === 0 ? "ALL PASS" : fails + " FAILURE(S)"}\n`);
process.exit(fails ? 1 : 0);
