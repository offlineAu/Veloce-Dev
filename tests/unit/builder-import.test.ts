import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Fragment, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { FetchLike } from "@/lib/builder/import/assets";
import { rewriteClass } from "@/lib/builder/import/classes";
import { importTemplate, type ImportResult } from "@/lib/builder/import";
import { readTailwindConfig, tokensFromConfig } from "@/lib/builder/import/theme";
import { Report } from "@/lib/builder/import/report";
import { docFromTemplate } from "@/lib/builder/template-doc";
import type { ElementNode } from "@/lib/builder/template-package";
import type { SiteDoc } from "@/lib/builder/site-doc";
import { renderNode } from "@/components/builder/node-tree";

// The validator only reads template versions listed in the manifest: list the fixture's.
vi.mock("@/content/builder-templates", () => ({
  isKnownVersion: (slug: string, version: number) => slug === "mini" && version === 1,
  findImported: (slug: string) => (slug === "mini" ? { slug, versions: [1], published: [] } : undefined),
}));

const FIXTURE = path.join(__dirname, "../fixtures/stitch-mini");

let png: Buffer;
const fetched: string[] = [];
/** Google Fonts, gstatic and image hosts, offline. "missing.jpg" fails, to exercise the placeholder. */
const fetcher: FetchLike = async (url) => {
  fetched.push(url);
  const ok = (body: string | Buffer) => ({
    ok: true,
    status: 200,
    text: async () => body.toString(),
    arrayBuffer: async () => {
      const b = Buffer.from(body);
      return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
    },
  });
  if (url.startsWith("https://fonts.googleapis.com/css2")) {
    const family = new URL(url).searchParams.get("family")!.split(":")[0];
    if (family?.startsWith("Material")) {
      return ok(`@font-face { font-family: 'Material Symbols Outlined'; src: url(https://fonts.gstatic.com/icons.woff2) format('woff2'); }\n.material-symbols-outlined { font-family: 'Material Symbols Outlined'; font-feature-settings: 'liga'; }`);
    }
    return ok(`/* cyrillic */\n@font-face { font-family: 'Outfit'; src: url(https://fonts.gstatic.com/outfit-cyr.woff2) format('woff2'); }\n/* latin */\n@font-face { font-family: 'Outfit'; src: url(https://fonts.gstatic.com/outfit-latin.woff2) format('woff2'); }`);
  }
  if (url.startsWith("https://fonts.gstatic.com/")) return ok(Buffer.from("woff2"));
  if (url.endsWith("missing.jpg")) return { ok: false, status: 404, text: async () => "", arrayBuffer: async () => new ArrayBuffer(0) };
  return ok(png);
};

let result: ImportResult;
let root: string;

beforeAll(async () => {
  png = await sharp({ create: { width: 40, height: 30, channels: 3, background: "#884422" } }).png().toBuffer();
  const pages = readdirSync(FIXTURE)
    .filter((d) => d.startsWith("mini_studio"))
    .map((dir) => ({ dir, html: readFileSync(path.join(FIXTURE, dir, "code.html"), "utf8") }));
  result = await importTemplate(
    { pages, designMd: readFileSync(path.join(FIXTURE, "mini_design/DESIGN.md"), "utf8") },
    { slug: "mini", name: "Mini", websiteType: "BUSINESS", version: 1, fetcher },
  );
  // Write the package where the server-side validator will look for it.
  root = mkdtempSync(path.join(tmpdir(), "tpl-"));
  const dir = path.join(root, "builder-templates/mini/v1");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "template.json"), JSON.stringify(result.pkg));
  writeFileSync(path.join(dir, "theme.css"), result.css);
  const store = await import("@/server/builder/template-store");
  store.setTemplateRootForTests(root);
});

describe("importer: pages and theme", () => {
  it("orders pages like the navigation, home first, and links between them", () => {
    expect(result.pkg.pages.map((p) => [p.key, p.title])).toEqual([["", "Home"], ["artists", "Artists"]]);
    const json = JSON.stringify(result.pkg);
    expect(json).toContain('"tpl:artists"');
    expect(result.report).toMatch(/“journal” point to a page that isn't in the export/);
  });

  it("reads the Tailwind config as data and lets DESIGN.md win", () => {
    expect(result.pkg.theme).toMatchObject({ scheme: "dark", accent: "#e9c349", bg: "#141312", fg: "#e6e1df", radius: "0.5rem", buttonRadius: "0.125rem" });
    expect(result.pkg.theme.fontHeading).toBe('"Playfair Display", serif');
    expect(result.pkg.notes).toContain("Gold is reserved");
  });

  it("never executes the config: code in it is refused", () => {
    const report = new Report();
    expect(readTailwindConfig("tailwind.config = { theme: (() => { throw 1 })() }", report)).toBeNull();
    expect(tokensFromConfig(readTailwindConfig('tailwind.config = { theme: { extend: { colors: { x: "red;}body{" } } } }', report), report).colors).toEqual({});
  });
});

describe("importer: sections and fields", () => {
  const home = () => result.pkg.pages[0]!;

  it("splits pages into labelled sections and leaves out script-only (hidden) ones", () => {
    expect(home().sections.map((s) => s.label)).toEqual(["Header", "Editorial Hero", "Portfolio Grid", "Footer"]);
    expect(result.report).toContain("Skipped");
  });

  it("makes text, images and links editable, labelled by meaning", () => {
    const hero = home().sections[1]!;
    const byLabel = Object.fromEntries(hero.fields.map((f) => [f.label, hero.defaults[f.id]]));
    expect(byLabel).toMatchObject({ Label: "Now booking", Heading: "Ink", "Heading 2": "as art", Text: "Fine-line work in a private studio." });
    expect(byLabel["“Meet the artists” link"]).toBe("tpl:artists"); // a navigating <button> became a page link
    expect(Object.values(hero.defaults).some((v) => /^\/builder-templates\/mini\/v1\/img\/[0-9a-f]{16}\.webp$/.test(v))).toBe(true);
  });

  it("turns repeated cards into a list with every card's content", () => {
    const grid = home().sections[2]!;
    expect(grid.repeaters).toHaveLength(1);
    const list = grid.repeaters[0]!;
    expect(list.label).toBe("Cards");
    const heading = list.fields.find((f) => f.label === "Heading")!.id;
    expect(list.defaults.map((d) => d[heading])).toEqual(["Rose", "Fern", "Moth"]);
    expect(list.fields.map((f) => f.kind)).toEqual(expect.arrayContaining(["image", "text"]));
  });

  it("removes scripts, handlers and javascript: links, and keeps icons as decoration", () => {
    const json = JSON.stringify(result.pkg);
    expect(json).not.toMatch(/onclick|onClick|<script|javascript:|go\(\)/);
    expect(json).toContain('"arrow_forward"');
    expect(result.report).toMatch(/inline event handlers removed/);
  });
});

describe("importer: assets and stylesheet", () => {
  it("bundles latin fonts only, subsets the icon font, and downloads images", () => {
    const files = [...result.files.keys()];
    expect(files.filter((f) => f.startsWith("fonts/"))).toHaveLength(2); // Outfit latin + icons, not cyrillic
    expect(fetched.some((u) => u.includes("icon_names=arrow_forward"))).toBe(true);
    expect(files).toContain("img/placeholder.webp");
    expect(result.report).toMatch(/couldn't be downloaded/);
    expect(JSON.stringify(result.pkg)).not.toContain("lh3.googleusercontent.com");
  });

  it("compiles prefixed utilities scoped to the template, with no global variables", () => {
    expect(result.css).toMatch(/\[data-vt="?mini"?\]/);
    expect(result.css).toContain(".vt\\:bg-primary");
    expect(result.css).toContain("--vt-color-primary");
    expect(result.css).not.toMatch(/:root/);
    expect(result.css).toContain(".vt-material-symbols-outlined");
    expect(result.css).toContain("/builder-templates/mini/v1/fonts/");
  });

  it("translates v3 class names v4 renamed", () => {
    const ctx = { custom: new Set<string>(), radiusDefault: true };
    expect(rewriteClass("shadow", ctx)).toBe("vt:shadow-sm");
    expect(rewriteClass("md:hover:!rounded", ctx)).toBe("vt:md:hover:rounded-DEFAULT!");
    expect(rewriteClass("bg-[url(a:b)]", ctx)).toBe("vt:bg-[url(a:b)]");
    expect(rewriteClass("-mt-20", ctx)).toBe("vt:-mt-20");
  });
});

describe("rendering imported sections", () => {
  const html = (tree: ElementNode, values: Record<string, string> = {}, items = {}) =>
    renderToStaticMarkup(createElement(Fragment, null, renderNode(tree, { values, items, puck: { isEditing: false, metadata: {} } })));

  it("renders the section with the visitor's values", () => {
    const hero = result.pkg.pages[0]!.sections[1]!;
    const headingId = hero.fields.find((f) => f.label === "Heading")!.id;
    const out = html(hero.tree, { ...hero.defaults, [headingId]: "Changed" });
    expect(out).toContain(">Changed <span");
    expect(out).toContain('class="vt:');
  });

  it("refuses script, handlers and unsafe links even in a hand-edited package", () => {
    const evil: ElementNode = {
      t: "div",
      a: { onClick: "x()", className: "a" },
      c: [{ t: "script", c: ["alert(1)"] }, { t: "a", a: { href: "javascript:alert(1)" }, c: ["x"] }, { t: "iframe", a: { src: "http://evil" } }, { t: "a", b: { href: "l1" }, c: ["y"] }],
    };
    const out = html(evil, { l1: "javascript:alert(2)" });
    expect(out).not.toMatch(/script|onclick|javascript|iframe/i);
  });
});

describe("validating submitted designs that use an imported template", () => {
  const check = async (doc: SiteDoc) => (await import("@/server/builder/design-validation")).checkDesignSections(doc);
  const site = () => docFromTemplate(result.pkg);
  const firstSection = (doc: SiteDoc) => doc.pages[0]!.data.content[1]!;

  it("accepts a site made from the template, with page links resolved to page ids", async () => {
    const doc = site();
    expect(await check(doc)).toBeNull();
    const values = firstSection(doc).props.values as Record<string, string>;
    expect(Object.values(values)).toContain(`page:${doc.pages[1]!.id}`);
  });

  it("rejects unknown sections, unknown fields, unsafe links and foreign images", async () => {
    const tamper = (fn: (props: Record<string, unknown>) => void) => {
      const doc = site();
      fn(firstSection(doc).props);
      return check(doc);
    };
    expect(await tamper((p) => (p.sectionId = "nope"))).toMatch(/no longer available/);
    expect(await tamper((p) => ((p.values as Record<string, string>).zz9 = "x"))).toMatch(/unknown field/);
    const hero = result.pkg.pages[0]!.sections[1]!;
    const link = hero.fields.find((f) => f.kind === "link")!.id;
    const image = hero.fields.find((f) => f.kind === "image")!.id;
    expect(await tamper((p) => ((p.values as Record<string, string>)[link] = "javascript:alert(1)"))).toMatch(/link address not allowed/);
    expect(await tamper((p) => ((p.values as Record<string, string>)[image] = "/builder-templates/other/v1/x.webp"))).toMatch(/image address not allowed/);
  });

  it("rejects a template version that isn't listed, and tampered page frames", async () => {
    const doc = site();
    expect(await check({ ...doc, templateRef: { slug: "mini", version: 9 } })).toMatch(/no longer available/);
    const framed = site();
    framed.pages[0]!.data.root.props!.frame = "evil-class";
    expect(await check(framed)).toMatch(/couldn't read/);
  });

  it("caps lists", async () => {
    const doc = site();
    const grid = doc.pages[0]!.data.content[2]!;
    const items = grid.props.items as Record<string, Record<string, string>[]>;
    const [id, list] = Object.entries(items)[0]!;
    items[id] = Array.from({ length: 30 }, () => ({ ...list[0] }));
    expect(await check(doc)).toMatch(/too many/);
  });
});
