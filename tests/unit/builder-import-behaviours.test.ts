import { describe, expect, it } from "vitest";
import { importTemplate } from "@/lib/builder/import";
import type { ElementNode, TreeNode } from "@/lib/builder/template-package";

/* A hand-written page with the kinds of scripted parts the Kestrel trades template has. */
const PAGE = `<!doctype html><html><head><style>
html{scroll-behavior:smooth;scroll-padding-top:88px}
body{overflow-x:hidden;color:#111}
:root{--accent:#ffc21a}
[data-reveal]{opacity:0;transition-delay:calc(var(--d,0) * 1ms)}
[data-reveal].in{opacity:1}
.mobile-nav{display:none}.mobile-nav.open{display:block}
.faq li.open .panel{grid-template-rows:1fr}
.typing{display:none}.typing.show{display:inline-flex}
.bubble{opacity:0}.bubble.show{opacity:1}
.wall-col{animation:wall-up var(--dur,46s) linear infinite}
@keyframes wall-up{to{transform:translateY(calc(var(--shift,0px) * -1))}}
</style></head><body>
<header><nav class="spot-nav" id="spot-nav"><a href="#a">A</a><a href="#b">B</a><a href="#faq">FAQ</a></nav>
<button class="menu-btn" aria-expanded="false" aria-controls="mobile-nav" aria-label="Open menu">≡</button>
<nav class="mobile-nav" id="mobile-nav"><a href="#a">A</a></nav></header>
<section id="a"><h1>Hero</h1><div class="wall"><div class="wall-col up"><div class="wall-set"><img src="https://img.test/1.jpg" alt=""></div></div></div>
<p data-reveal style="--d:150">Shown on scroll</p><div class="price">from <b data-count="180" data-prefix="$">$180</b></div></section>
<section id="b"><h2>How</h2><div class="phone"><span class="typing"><i></i></span><p class="bubble">Hi</p></div></section>
<section id="faq"><h2>Questions</h2><ul class="faq"><li><button aria-expanded="false">One?<span class="pm">+</span></button><div class="panel"><p>Yes.</p></div></li><li><button aria-expanded="false">Two?<span class="pm">+</span></button><div class="panel"><p>No.</p></div></li></ul></section>
<section id="book"><form id="book-form"><input id="b-name" name="name"><button type="submit">Send</button></form><div class="success" id="book-success" role="status"><p>Thanks</p></div></section>
<script>
const $=(s)=>document.querySelector(s);
document.querySelectorAll("[data-reveal]").forEach(e=>e.classList.add("in"));
$(".menu-btn").onclick=()=>$("#mobile-nav").classList.toggle("open");
document.querySelectorAll(".faq li").forEach(li=>li.classList.toggle("open"));
$(".typing").classList.add("show"); $(".bubble").classList.add("show");
document.querySelectorAll(".spot-nav a").forEach(a=>a.classList.toggle("active", true));
col.style.setProperty("--shift", "10px"); col.style.setProperty("--dur", "4s"); el.style.setProperty("--d", "1");
</script></body></html>`;

const offline = async () => ({ ok: false, status: 0, text: async () => "", arrayBuffer: async () => new ArrayBuffer(0) });

const isEl = (n: TreeNode): n is ElementNode => typeof n === "object" && "t" in n;
function* nodes(n: ElementNode): Generator<ElementNode> {
  yield n;
  for (const c of n.c ?? []) if (isEl(c)) yield* nodes(c);
}

describe("importing a hand-written page's interactions", async () => {
  const r = await importTemplate(
    { pages: [{ dir: "home", html: PAGE }] },
    { slug: "kt", name: "K", websiteType: "BUSINESS", version: 1, keepOrder: true, fetcher: offline as never, assetBase: "/x", hints: [{ selector: ".wall-col.up", set: { "data-vt-marquee": "y up 24 pause" } }, { selector: ".typing", set: { "data-vt-transient": "" } }, { selector: ".phone", set: { "data-vt-seq": "400 900" } }, { selector: ".faq .pm", set: { "data-vt-alt": "−" } }] },
  );
  const all = r.pkg.pages[0]!.sections.flatMap((s) => [...nodes(s.tree)]);
  const withAttr = (a: string) => all.filter((n) => n.a && a in n.a);

  it("recognises reveals, count-ups, a menu button, an accordion, scroll-spy and a form", () => {
    expect(withAttr("data-vt-reveal")).toHaveLength(1);
    expect(withAttr("data-vt-reveal")[0]!.a!.style).toEqual({ "--vt-d": "150" });
    // The count-up sits on the block around the inline number.
    expect(withAttr("data-vt-count").map((n) => n.t)).toEqual(["div"]);
    expect(withAttr("data-vt-toggle")[0]!.a!["data-vt-toggle"]).toBe("mobile-nav close-links");
    expect(withAttr("data-vt-accordion")[0]!.a!["data-vt-accordion"]).toBe("single");
    expect(withAttr("data-vt-spy").map((n) => n.a!.id)).toEqual(["spot-nav"]);
    expect(withAttr("data-vt-form")[0]!.a!["data-vt-form"]).toBe("book-success");
  });

  it("applies the template's hints, and writes no copies of a marquee", () => {
    expect(withAttr("data-vt-marquee")[0]!.a!["data-vt-marquee"]).toBe("y up 24 pause");
    expect(all.filter((n) => typeof n.a?.className === "string" && n.a.className.includes("vt-wall-set"))).toHaveLength(1);
    expect(withAttr("data-vt-alt")).toHaveLength(2);
    expect(withAttr("data-vt-transient")).toHaveLength(1);
  });

  it("rewrites the design's CSS to the runtime's states, names and settings", () => {
    const css = r.css;
    expect(css).toMatch(/\[data-vt-state~=("|)open\1\]/);
    // The runtime's state, or the class a captured page left on an element no interaction runs.
    expect(css).toMatch(/\[data-vt-reveal\]:is\(\.vt-in,\[data-vt-state~=("|)in\1\]\)/);
    // Forced "revealed" fallbacks wait for the runtime; the typing dots never get one.
    expect(css).toContain(":not([data-vt-motion]) [data-vt-reveal]");
    expect(css).not.toMatch(/:not\(\[data-vt-motion\]\)\s*\.vt-typing/);
    expect(css).toContain("--vt-shift");
    expect(css).toContain("--vt-dur");
    expect(css).toContain("--vt-smooth:1");
    expect(css).toContain("scroll-margin-top:88px");
    expect(css).toContain("overflow-x:clip");
    expect(css).not.toMatch(/\[data-reveal\]/);
  });

  it("names and sorts the sections", () => {
    const s = r.pkg.pages[0]!.sections;
    expect(s.map((x) => x.kind)).toContain("faq");
    expect(s.every((x) => x.rawLabel !== undefined)).toBe(true);
  });
});

describe("importing without hints (an upload in the developer panel)", async () => {
  const html = PAGE.replace("</style>", ".wall:hover .wall-col{animation-play-state:paused}\n.bento .card{opacity:0;transition-delay:calc(var(--d,0) * 1ms)}.bento.in .card{opacity:1}\n</style>")
    .replace("</section>\n<section id=\"b\">", '<div class="bento"><div class="card">1</div><div class="card">2</div></div></section>\n<section id="b">')
    .replace("<script>", '<script>\ndocument.querySelector(".bento").classList.add("in");');
  const r = await importTemplate({ pages: [{ dir: "home", html }] }, { slug: "kt", name: "K", websiteType: "BUSINESS", version: 1, keepOrder: true, fetcher: offline as never, assetBase: "/x" });
  const all = r.pkg.pages[0]!.sections.flatMap((s) => [...nodes(s.tree)]);

  it("finds an endless scroll from keyframes that slide by a variable the script sets", () => {
    const wall = all.filter((n) => n.a?.["data-vt-marquee"]);
    expect(wall.map((n) => n.a!["data-vt-marquee"])).toEqual(["y up 24 pause"]);
  });

  it("reveals what the script revealed by adding a class, staggering children it delayed", () => {
    const bento = all.find((n) => typeof n.a?.className === "string" && n.a.className.split(" ").includes("vt-bento"));
    expect(bento?.a?.["data-vt-reveal"]).toBe("stagger:120 from:center");
    // A typing indicator is never revealed for good.
    expect(all.filter((n) => typeof n.a?.className === "string" && n.a.className.includes("vt-typing") && n.a["data-vt-reveal"] !== undefined)).toHaveLength(0);
  });
});

describe("importing a page captured after its script ran", async () => {
  // As the developer panel captures it: the script's markup is there, with its own copies and split text.
  const html = `<!doctype html><html><head><style>
.roll .ch::after{content:attr(data-c)}.room:hover .roll .ch{transform:translateY(-100%)}
.flip.play .fc{color:transparent}
[data-split] .w>span{transform:translateY(105%)}[data-split].in .w>span{transform:none}
</style></head><body>
<section><h2 data-split class="in"><span class="w"><span style="--i:0">Shop</span></span> <span class="w"><span style="--i:1">by</span></span> <span class="w"><span style="--i:2">room</span></span></h2>
<a class="room" href="#"><h3><span class="roll" aria-hidden="true"><span class="ch" data-c="L" style="--c:0">L</span><span class="ch" data-c="i" style="--c:1">i</span><span class="ch" data-c="v" style="--c:2">v</span></span></h3></a>
<h2 class="flip"><span class="wd"><span class="fc" data-c="N" style="--fd:0s">N</span><span class="fc" data-c="e" style="--fd:.1s">e</span><span class="fc" data-c="w" style="--fd:.2s">w</span></span></h2>
<div class="tags"><span>Kitchen</span><span>Toilets</span><span>Stormwater</span></div>
<figure class="shot"><img class="a" loading="lazy" data-src="https://img.test/mug.jpg" alt="Mug"></figure>
<div class="wall"><div class="col"><div class="set"><p>A</p></div><div class="set clone" aria-hidden="true"><p>A</p></div></div></div></section>
<script>document.querySelectorAll(".flip").forEach(h=>h.classList.add("play")); x.classList.add("clone");</script>
</body></html>`;
  const r = await importTemplate({ pages: [{ dir: "home", html }] }, { slug: "cap", name: "C", websiteType: "BUSINESS", version: 1, keepOrder: true, fetcher: offline as never, assetBase: "/x" });
  const all = r.pkg.pages[0]!.sections.flatMap((s) => [...nodes(s.tree)]);
  const byTag = (t: string) => all.filter((n) => n.t === t);

  it("folds script-split text back into plain text, with the builder's own effect", () => {
    const [split, flip] = byTag("h2");
    expect(split!.a?.["data-vt-split"]).toBe("words");
    expect(flip!.a?.["data-vt-flip"]).toBe("");
    expect(byTag("h3")[0]!.a?.["data-vt-roll"]).toBe("");
    expect(byTag("h3")[0]!.c?.every((c) => typeof c === "string" || !isEl(c))).toBe(true);
  });

  it("uses a lazy-loaded image's address (data-src) when it has no src", () => {
    const img = byTag("img")[0]!;
    expect(img.b?.src).toBeDefined();
    expect(r.report).not.toMatch(/no address/);
  });

  it("leaves ordinary spans alone, and drops the copies a script made", () => {
    const tags = all.find((n) => typeof n.a?.className === "string" && n.a.className.includes("vt-tags"));
    // Still three spans (made an editable list), with no text effect.
    expect(Object.keys(tags?.a ?? {}).filter((k) => k.startsWith("data-vt-"))).toEqual([]);
    expect(JSON.stringify(tags)).toMatch(/"t":"span"/);
    expect(all.filter((n) => typeof n.a?.className === "string" && n.a.className.split(" ").includes("vt-set"))).toHaveLength(1);
    // The heading is one editable text again ("Shop by room"), not a span per word.
    const heading = byTag("h2")[0]!;
    expect(heading.c).toHaveLength(1);
    const field = heading.c![0] as { f?: string };
    expect(r.pkg.pages[0]!.sections[0]!.defaults[field.f!]).toBe("Shop by room");
  });
});

