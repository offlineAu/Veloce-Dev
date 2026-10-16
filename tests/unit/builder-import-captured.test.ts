import { describe, expect, it } from "vitest";
import { importTemplate } from "@/lib/builder/import";
import { behavioursOf, parseBehaviour } from "@/lib/builder/behaviours";
import type { ElementNode, TreeNode } from "@/lib/builder/template-package";

/*
 * A hand-written page as a bake leaves it (its script has run): a dashboard's card grid, a segmented control with one
 * choice pressed, rows that differ only in a class or an icon, a room shown with `.on` that no interaction runs, a
 * tab list whose panels the runtime switches, a count-up caught before it counted, a heading mark from a data
 * attribute, a menu shown with `.on`, a navigating button, and an <output>.
 */
const PAGE = `<!doctype html><html><head><style>
:root{--paper:#f7efec;--ink:#1d1a17;--surface:#ffffff;--serif:"Cormorant Garamond",Georgia,serif;--sans:"Manrope",system-ui}
body{background:var(--paper);color:var(--ink);font-family:var(--sans)}
h1,h2{font-family:var(--serif)}
.grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr))}
.seg button[aria-pressed="true"]{color:#fff}
.neg{color:#b33}
.layer{visibility:hidden}.layer.on{visibility:visible}
.tabs-panels > .on{display:block}
.head[data-mark]::before{content:attr(data-mark)}
.sheet{transform:translateX(-100%)}.sheet.on{transform:none}
#needs button{display:flex}
.calc output{color:teal}
</style></head><body>
<nav class="top"><a href="#" data-path="home" aria-current="page">Home</a><a href="#" data-path="approvals">Approvals 3</a><a href="#" data-path="files">Files</a></nav>
<main class="grid" id="grid">
  <section class="card"><h2>Revenue</h2><div class="seg"><button type="button" aria-pressed="true">Month</button><button type="button" aria-pressed="false">Quarter</button><button type="button" aria-pressed="false">Year</button></div></section>
  <section class="card"><h2>Cash</h2><table><tbody><tr><td>Money in</td><td>184</td></tr><tr><td>Wages</td><td class="neg">-92</td></tr><tr><td>Tax</td><td class="neg">-40</td></tr></tbody></table></section>
</main>
<section class="tour"><div class="head" data-mark="Walk-through"><h2>Walk through</h2></div>
  <div class="walk"><div class="layer on"><p>Street</p></div><div class="layer"><p>Hall</p></div></div>
  <div class="facts"><div><b data-n="607">412</b><span>m² block</span></div></div>
  <ul class="tabs" id="tabs"><li><button>One</button></li><li><button>Two</button></li></ul>
  <div class="tabs-panels" id="tab-panels"><div class="on"><p>First</p></div><div><p>Second</p></div></div>
</section>
<section class="menu"><button aria-expanded="false" aria-controls="sheet" aria-label="Menu">≡</button><aside class="sheet" id="sheet"><p>Menu</p></aside>
  <ul id="needs"><li><button type="button" data-path="approvals"><svg><use href="#i-check"></use></svg><b>Approve V-04</b></button></li><li><button type="button" data-path="files"><svg><use href="#i-tile"></use></svg><b>Choose a tile</b></button></li><li><button type="button" data-path="files"><svg><use href="#i-pay"></use></svg><b>Pay invoice</b></button></li></ul>
  <div class="calc"><output>$120,000</output></div>
</section>
<script>document.querySelector(".layer").classList.add("on"); document.querySelectorAll(".tabs-panels > div").forEach((d) => d.classList.toggle("on")); document.querySelector(".sheet").classList.toggle("on");</script>
</body></html>`;

const offline = async () => ({ ok: false, status: 0, text: async () => "", arrayBuffer: async () => new ArrayBuffer(0) });
const isEl = (n: TreeNode): n is ElementNode => typeof n === "object" && "t" in n;
function* nodes(n: ElementNode): Generator<ElementNode> {
  yield n;
  for (const c of n.c ?? []) {
    if (isEl(c)) yield* nodes(c);
    else if (typeof c === "object" && "item" in c) yield* nodes(c.item);
  }
}
const cls = (n: ElementNode) => String(n.a?.className ?? "");

describe("importing a captured hand-written page", async () => {
  const r = await importTemplate(
    { pages: [{ dir: "home", html: PAGE }] },
    { slug: "cp", name: "C", websiteType: "WEB_APP", version: 1, keepOrder: true, fetcher: offline as never, assetBase: "/x", hints: [{ selector: "#tabs", set: { "data-vt-tabs": "tab-panels" } }] },
  );
  const page = r.pkg.pages[0]!;
  const sections = page.sections;
  const all = sections.flatMap((s) => [...nodes(s.tree)]);
  const css = r.css;

  it("keeps a grid of cards whole, so its cards still line up", () => {
    const grid = sections.find((s) => cls(s.tree).includes("vt-grid"));
    expect(grid).toBeDefined();
    expect(all.filter((n) => n.t === "section" && cls(n).includes("vt-card"))).toHaveLength(2);
  });

  it("makes lists only of items that look alike", () => {
    // A pressed choice, red figures and different icons would all come out like the first item.
    const repeated = sections.flatMap((s) => s.repeaters.map((x) => x.itemLabel));
    expect(repeated).not.toContain("Button");
    expect(all.filter((n) => n.t === "td" && cls(n).includes("vt-neg"))).toHaveLength(2);
    expect(all.filter((n) => n.t === "use").map((n) => n.a?.href)).toEqual(["#i-check", "#i-tile", "#i-pay"]);
    expect(all.filter((n) => n.t === "button" && n.a?.["aria-pressed"] === "true")).toHaveLength(1);
  });

  it("keeps a state the capture left where no interaction sets it, and leaves it to the runtime where one does", () => {
    const layers = all.filter((n) => cls(n).includes("vt-layer"));
    expect(cls(layers[0]!)).toContain("vt-on");
    const panels = all.find((n) => n.a?.id === "tab-panels")!;
    expect((panels.c ?? []).filter(isEl).some((p) => cls(p).includes("vt-on"))).toBe(false);
    expect(css).toMatch(/\.vt-layer:is\(\.vt-on,\[data-vt-state~=("|)on\1\]\)/);
  });

  it("counts up to the number the script counts to", () => {
    const section = sections.find((s) => [...nodes(s.tree)].some((n) => cls(n).includes("vt-facts")))!;
    const b = [...nodes(section.tree)].find((n) => n.t === "b")!;
    const field = (b.c ?? []).find((c): c is { f: string } => typeof c === "object" && "f" in c)!;
    expect(section.defaults[field.f]).toBe("607");
  });

  it("keeps data attributes the stylesheet uses, as design data", () => {
    expect(all.find((n) => cls(n).includes("vt-head"))!.a!["data-vt-x-mark"]).toBe("Walk-through");
    expect(css).toContain("attr(data-vt-x-mark)");
    expect(css).toContain("[data-vt-x-mark]");
  });

  it("opens a menu with the state its design shows it by", () => {
    expect(all.find((n) => n.a && "data-vt-toggle" in n.a)!.a!["data-vt-toggle"]).toBe("sheet on");
  });

  it("styles buttons that became page links, and stand-ins for unsupported tags, by the design's rules", () => {
    const links = all.filter((n) => n.t === "a" && cls(n).includes("vt-as-button"));
    expect(links).toHaveLength(3);
    expect(css).toContain(":is(button,.vt-as-button)");
    expect(all.some((n) => n.t === "span" && cls(n).includes("vt-as-output"))).toBe(true);
    expect(css).toContain(":is(output,.vt-as-output)");
  });

  it("takes the theme from what the page paints, and leaves its headings to its stylesheet", () => {
    expect(r.pkg.theme.bg).toBe("#f7efec");
    expect(r.pkg.theme.fontHeading).toContain("Cormorant Garamond");
    expect(r.pkg.handWritten).toBe(true);
    // A badge count isn't part of a page's name.
    expect(page.title).toBe("Home");
  });
});

describe("design data attributes and menus that show with .on", () => {
  it("accepts short plain text as design data, and doesn't count it as an interaction", () => {
    expect(parseBehaviour("data-vt-x-mark", "Walk-through")).toBe("Walk-through");
    expect(parseBehaviour("data-vt-x-mark", "<b>")).toBeNull();
    expect(behavioursOf({ "data-vt-x-mark": "Suburbs", "data-vt-reveal": "" })).toEqual({ reveal: "" });
  });

  it("knows the toggle's on option", () => {
    expect(parseBehaviour("data-vt-toggle", "sheet close-links on")).toBe("sheet close-links on");
    expect(parseBehaviour("data-vt-toggle", "sheet sideways")).toBeNull();
  });
});
