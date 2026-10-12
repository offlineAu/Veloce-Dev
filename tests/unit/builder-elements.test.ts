import { readFileSync } from "node:fs";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Render } from "@puckeditor/core";
import { describe, expect, it, vi } from "vitest";
import { builderConfig } from "@/components/builder/config";
import { renderNode } from "@/components/builder/node-tree";
import { sectionToElements } from "@/lib/builder/elements";
import { mapBlocks, type BlockItem } from "@/lib/builder/blocks";
import { sectionDefaults, type TemplatePackage } from "@/lib/builder/template-package";

vi.mock("@/content/builder-templates", () => ({ isKnownVersion: () => true, findImported: () => ({ versions: [1], published: [1] }), showDrafts: () => true }));

const noir = JSON.parse(readFileSync("public/builder-templates/noir-needle/v1/template.json", "utf8")) as TemplatePackage;

/**
 * Markup reduced to what decides the layout and what people read: tags, classes and text. (Attributes such as id
 * and aria-* are applied after mount on pieces, and the editor adds data attributes, so they're left out.)
 */
function shape(html: string): string {
  return html
    .replace(/<(\w+)((?:\s+[\w:-]+(?:="[^"]*")?)*)\s*(\/?)>/g, (_m, tag: string, attrs: string, self: string) => {
      const cls = attrs.match(/\sclass="([^"]*)"/)?.[1]?.split(/\s+/).filter(Boolean).sort().join(" ");
      return `<${tag}${cls ? ` class="${cls}"` : ""}${self ? "/" : ""}>`;
    })
    .replace(/\s+/g, " ")
    .replace(/> </g, "><")
    .trim();
}

const locked = (section: TemplatePackage["pages"][number]["sections"][number]) => {
  const { values, items } = sectionDefaults(section);
  return renderToStaticMarkup(createElement(Fragment, null, renderNode(section.tree, { values, items, puck: { isEditing: false, metadata: {} } })));
};

// The page root adds the theme wrapper and style tags; compare the pieces alone.
const bareConfig = { ...builderConfig, root: undefined };
const pieces = (block: BlockItem) =>
  renderToStaticMarkup(createElement(Render, { config: bareConfig, data: { root: { props: {} }, content: [block] }, metadata: {} } as never));

describe("Edit layout: a section taken apart looks the same", () => {
  for (const page of noir.pages) {
    for (const section of page.sections) {
      it(`${page.title} · ${section.label}`, () => {
        // Render wraps the page in its root drop zone (<div>); the section itself is inside.
        const out = shape(pieces(sectionToElements(section))).replace(/^((?:<link\/>)*)<div>(.*)<\/div>$/, "$1$2");
        expect(out).toBe(shape(locked(section)));
      });
    }
  }
});

describe("taking a section apart", () => {
  const grid = noir.pages[0]!.sections.find((s) => s.repeaters.length > 1 && s.label.startsWith("Curated"))!;

  it("keeps what the visitor changed and turns list items into ordinary blocks", () => {
    const heading = grid.fields.find((f) => f.label === "Heading")!.id;
    const cards = grid.repeaters.find((r) => r.label === "Cards")!;
    const block = sectionToElements(grid, { [heading]: "My archive" }, { [cards.id]: cards.defaults.slice(0, 2) });
    const html = pieces(block);
    expect(html).toContain("My archive");
    expect((html.match(/View Piece Dossier/g) ?? []).length).toBe(2);
  });

  it("makes links, images, text and icons into their own pieces, with fresh ids", () => {
    const block = sectionToElements(grid);
    const types = new Map<string, number>();
    const ids = new Set<string>();
    mapBlocks([block], (b) => {
      types.set(b.type, (types.get(b.type) ?? 0) + 1);
      ids.add(String(b.props.id));
      return b;
    });
    expect([...types.keys()]).toEqual(expect.arrayContaining(["Box", "DText", "DImage", "DLink", "DIcon"]));
    const total = [...types.values()].reduce((a, b) => a + b, 0);
    expect(ids.size).toBe(total);
  });
});
