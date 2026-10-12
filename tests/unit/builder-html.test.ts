import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Render } from "@puckeditor/core";
import { describe, expect, it, vi } from "vitest";
import { builderConfig } from "@/components/builder/config";
import { mapBlocks, type BlockItem } from "@/lib/builder/blocks";
import { KEEP_TYPE, keptBlocks, replaceBlock, restoreKept, serializeElements } from "@/lib/builder/element-html";
import { sectionToElements } from "@/lib/builder/elements";
import type { TemplatePackage } from "@/lib/builder/template-package";
import { htmlToPieces, MAX_ELEMENTS } from "@/server/builder/html-pieces";

vi.mock("@/content/builder-templates", () => ({ isKnownVersion: () => true, findImported: () => ({ versions: [1], published: [1] }), showDrafts: () => true }));

const noir = JSON.parse(readFileSync("public/builder-templates/noir-needle/v1/template.json", "utf8")) as TemplatePackage;
const bareConfig = { ...builderConfig, root: undefined };
const render = (blocks: BlockItem[]) =>
  renderToStaticMarkup(createElement(Render, { config: bareConfig, data: { root: { props: {} }, content: blocks }, metadata: {} } as never));
// Tags, sorted classes and text (ids and other attributes are set after mount on pieces).
const shape = (html: string) =>
  html
    .replace(/<(\w+)((?:\s+[\w:-]+(?:="[^"]*")?)*)\s*(\/?)>/g, (_m, tag: string, attrs: string, self: string) => {
      const cls = attrs.match(/\sclass="([^"]*)"/)?.[1]?.split(/\s+/).filter(Boolean).sort().join(" ");
      return `<${tag}${cls ? ` class="${cls}"` : ""}${self ? "/" : ""}>`;
    })
    .replace(/\s+/g, " ")
    .replace(/> </g, "><")
    .trim();

const fromHtml = (html: string) => {
  const r = htmlToPieces(html);
  if (!r.ok) throw new Error(r.error);
  return r.blocks;
};

describe("Edit HTML round trip: pieces → HTML → pieces look the same", () => {
  for (const page of noir.pages) {
    for (const section of page.sections) {
      it(`${page.title} · ${section.label}`, () => {
        const block = sectionToElements(section);
        const html = serializeElements([block]);
        expect(html).not.toContain("vt:");
        expect(shape(render(fromHtml(html)))).toBe(shape(render([block])));
      });
    }
  }
});

describe("Edit HTML", () => {
  it("shows readable HTML and stores prefixed classes", () => {
    const [b] = fromHtml(`<section class="md:grid-cols-3 grid vt-material-symbols-outlined"><h2 class="text-xl">Hi <em class="italic">there</em></h2></section>`);
    expect(b).toMatchObject({ type: "Box", props: { tag: "section", className: "vt:md:grid-cols-3 vt:grid vt-material-symbols-outlined" } });
    const html = serializeElements([b!]);
    expect(html).toContain('<section class="md:grid-cols-3 grid vt-material-symbols-outlined">');
    expect(html).toContain('<h2 class="text-xl">Hi <em class="italic">there</em></h2>');
  });

  it("drops scripts, event handlers and javascript: links", () => {
    const blocks = fromHtml(`<div onclick="alert(1)"><script>alert(1)</script><a href="javascript:alert(1)">x</a><img src="x" onerror="alert(1)"><iframe src="http://evil"></iframe></div>`);
    const json = JSON.stringify(blocks);
    expect(json).not.toMatch(/alert|onclick|onerror|javascript|evil|script/i);
    expect(render(blocks)).not.toMatch(/alert|javascript/);
  });

  it("refuses too much HTML", () => {
    expect(htmlToPieces("<p>x</p>".repeat(8000))).toMatchObject({ ok: false });
    expect(htmlToPieces("<i></i>".repeat(MAX_ELEMENTS + 1))).toMatchObject({ ok: false });
    expect(htmlToPieces("   ")).toMatchObject({ ok: false });
  });

  it("keeps builder blocks inside the HTML where their markers are", () => {
    const heading: BlockItem = { type: "Heading", props: { id: "Heading-1", text: "Mine", level: "h2" } };
    const box: BlockItem = { type: "Box", props: { id: "Box-1", tag: "div", className: "vt:p-4", items: [heading, { type: "DText", props: { id: "DText-1", tag: "p", className: "", text: "Text", runs: [] } }] } };
    const html = serializeElements([box]);
    expect(html).toContain("<!--block:Heading-1-->");

    const back = fromHtml(html.replace("<p>Text</p>", "<p>Edited</p>").replace("<!--block:Heading-1-->", "<!--block:Heading-1--><!--block:unknown-->"));
    const kinds: string[] = [];
    mapBlocks(back, (b) => (kinds.push(b.type), b));
    expect(kinds).toContain(KEEP_TYPE);
    const restored = restoreKept(back, keptBlocks([box]));
    const out = JSON.stringify(restored);
    expect(out).toContain('"text":"Mine"');
    expect(out).toContain("Edited");
    expect(out).not.toContain(KEEP_TYPE);
  });

  it("replaces one block, anywhere, by several", () => {
    const tree: BlockItem[] = [{ type: "Box", props: { id: "a", items: [{ type: "DText", props: { id: "b" } }, { type: "DText", props: { id: "c" } }] } }];
    const next = replaceBlock(tree, "b", [{ type: "DText", props: { id: "x" } }, { type: "DText", props: { id: "y" } }]);
    expect((next[0]!.props.items as BlockItem[]).map((b) => b.props.id)).toEqual(["x", "y", "c"]);
  });
});
