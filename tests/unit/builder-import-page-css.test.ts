import { describe, expect, it } from "vitest";
import { parsePage } from "@/lib/builder/import/ir";
import { cssClasses, cssImageUrls, scopePageCss, scriptClasses, tokensFromPageCss } from "@/lib/builder/import/page-css";
import { Report } from "@/lib/builder/import/report";
import { splitSections } from "@/lib/builder/import/sections";

const scope = (css: string, states: string[] = [], asset: (u: string) => string | undefined = () => undefined) => {
  const report = new Report();
  const out = scopePageCss(css, { slug: "t", classes: cssClasses(css), scriptStates: new Set(states), asset, report });
  return { out, report: report.toMarkdown("t") };
};

describe("hand-written template stylesheets", () => {
  it("scopes every selector to the template root and prefixes the design's classes", () => {
    const { out } = scope(":root{--ink:#111} html{scroll-behavior:smooth} body>header .nav a:hover,.btn.alt{color:var(--ink)} *,*::before{box-sizing:border-box} [href$=\".pdf\"]{x:y}");
    expect(out.startsWith("@layer components {")).toBe(true);
    expect(out).toContain('[data-vt="t"]{--ink:#111}');
    // Page-level settings on the root become the runtime's (smooth in-page scrolling).
    expect(out).toContain('[data-vt="t"]{--vt-smooth:1}');
    expect(out).toContain('[data-vt="t"] header .vt-nav a:hover');
    expect(out).toContain('[data-vt="t"] .vt-btn.vt-alt');
    expect(out).toContain('[data-vt="t"] *');
    // A dot inside an attribute value isn't a class.
    expect(out).toContain('[data-vt="t"] [href$=".pdf"]');
  });

  it("prefixes keyframes, keeps safe data images, downloads https ones and drops the rest", () => {
    const { out, report } = scope(
      "@import url(https://evil.test/x.css);@keyframes spin{to{transform:rotate(1turn)}}.a{animation:spin 1s linear}" +
        ".b{background:url(data:image/svg+xml,%3Csvg%3E)}.c{background:url(https://img.test/a.jpg)}.d{background:url(http://img.test/b.jpg)}" +
        ".e{width:expression(alert(1))}@font-face{font-family:X;src:url(https://fonts.test/x.woff2)}",
      [],
      (u) => (u === "https://img.test/a.jpg" ? "/build/t/t/v1/img/a.webp" : undefined),
    );
    expect(out).toContain("@keyframes vt-t-spin");
    expect(out).toContain("animation:vt-t-spin 1s linear");
    expect(out).toContain("url(data:image/svg+xml,%3Csvg%3E)");
    expect(out).toContain('url("/build/t/t/v1/img/a.webp")');
    expect(out).not.toMatch(/evil\.test|http:\/\/img|expression|fonts\.test/);
    expect(report).toMatch(/@import/);
    expect(cssImageUrls(".c{background:url('https://img.test/a.jpg')}.d{background:url(http://x)}")).toEqual(["https://img.test/a.jpg"]);
  });

  it("applies states a script would reveal on scroll, and reports the ones it toggles", () => {
    const states = [...scriptClasses(['el.classList.add("in"); b.classList.toggle("open", x); c.classList.add(\'show\')'])];
    expect(states.sort()).toEqual(["in", "open", "show"]);
    const { out, report } = scope(".bento .card{opacity:0}.bento.in .card{opacity:1}.menu.open{display:block}", states);
    // The revealed state follows the hidden one, so it wins; "open" (a menu) stays closed.
    expect(out.indexOf('[data-vt="t"] .vt-bento .vt-card{opacity:1}')).toBeGreaterThan(out.indexOf("opacity:0"));
    expect(out).not.toContain('[data-vt="t"] .vt-menu{display:block}');
    expect(report).toMatch(/`open`/);
  });

  it("reads the theme's colours and fonts from :root", () => {
    expect(tokensFromPageCss(':root{--accent:#FFC21A;--ink:#111;--font-head:"Barlow Condensed",system-ui,sans-serif;--ease:cubic-bezier(0,0,1,1)}')).toEqual({
      colors: { accent: "#ffc21a", ink: "#111111" },
      fontFamily: { head: ["Barlow Condensed"] },
      usage: {},
    });
  });

  it("reads the heading font, body font and body colours the page itself sets", () => {
    const css = ':root{--paper:#f7efec;--ink:#1d1a17;--surface:#ffffff;--serif:"Cormorant Garamond",Georgia,serif;--sans:"Manrope",system-ui}body{background:var(--paper);color:var(--ink);font-family:var(--sans)}h1,h2{font-family:var(--serif)}';
    expect(tokensFromPageCss(css)).toMatchObject({
      fontFamily: { heading: ["Cormorant Garamond", "Georgia"], body: ["Manrope"] },
      usage: { bodyBg: "paper", bodyText: "ink" },
    });
  });

  it("knows Tailwind pages from hand-written ones", () => {
    const r = new Report();
    expect(parsePage('<script src="https://cdn.tailwindcss.com"></script><body><section>x</section></body>', r).usesTailwind).toBe(true);
    expect(parsePage("<style>.a{}</style><script>go()</script><body><section>x</section></body>", r)).toMatchObject({ usesTailwind: false, scripts: ["go()"] });
  });
});

describe("splitting a page into sections", () => {
  it("keeps a bar with one row inside as a section, not as the page around everything", () => {
    const r = new Report();
    const page = parsePage(
      '<body class="page"><div class="topbar"><div class="wrap">Call us</div></div><header>H</header><section><h2>Prices</h2></section><footer>F</footer></body>',
      r,
    );
    const { frame, sections } = splitSections(page.body, r);
    expect(frame).toEqual(["page"]);
    expect(sections.map((s) => s.label)).toEqual(["Topbar", "Header", "Prices", "Footer"]);
  });

  it("still opens up real page wrappers", () => {
    const r = new Report();
    const page = parsePage('<body><div class="app"><div class="layout"><header>H</header><main><section><h2>A</h2></section><section><h2>B</h2></section></main><footer>F</footer></div></div></body>', r);
    const { frame, sections } = splitSections(page.body, r);
    expect(frame).toEqual(["app", "layout"]);
    expect(sections.map((s) => s.label)).toEqual(["Header", "A", "B", "Footer"]);
  });
});
