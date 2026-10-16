import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { tidyDrops } from "@/components/builder/template-blocks";
import type { BlockItem } from "@/lib/builder/blocks";
import { sectionToElements } from "@/lib/builder/elements";
import { kitOf } from "@/lib/builder/template-kit";
import type { TemplatePackage, TemplateSection } from "@/lib/builder/template-package";

const block = (type: string, props: Record<string, unknown> = {}): BlockItem => ({ type, props: { id: `${type}-${Math.random()}`, ...props } });
const types = (items: BlockItem[]) => items.map((b) => b.type);
const keep = (b: BlockItem) => b;

describe("drops on a template site", () => {
  it("moves a page section dropped inside a design piece out beside the section it was dropped on", () => {
    const hero = block("Hero");
    const inner = block("Box", { items: [block("DText"), hero] });
    const page = [block("Box", { items: [block("DText")] }), block("Box", { items: [inner] }), block("Box")];
    const next = tidyDrops(page, keep)!;
    expect(types(next)).toEqual(["Box", "Box", "Hero", "Box"]);
    expect(next[2]).toEqual(hero);
    expect(JSON.stringify(next[1])).not.toContain('"Hero"');
  });

  it("leaves content blocks where they were dropped, and pages without drops untouched", () => {
    const heading = block("Heading");
    const page = [block("Box", { items: [heading] }), block("Hero")];
    expect(tidyDrops(page, keep)).toBeNull();
    // A page section inside a native Section is the visitor's choice, not a stray drop into a design.
    expect(tidyDrops([block("Section", { content: [block("Features")] })], keep)).toBeNull();
  });

  it("turns a dropped template section into design pieces, wherever it landed", () => {
    const pieces = block("Box", { items: [block("DText")] });
    const toPieces = (b: BlockItem) => (b.type === "TemplateSection:hero" ? pieces : b);
    const page = [block("Box", { items: [block("TemplateSection:hero")] }), block("TemplateSection:hero")];
    const next = tidyDrops(page, toPieces)!;
    expect(types(next)).toEqual(["Box", "Box", "Box"]);
    expect(JSON.stringify(next)).not.toContain("TemplateSection");
  });
});

describe("decorative layers", () => {
  it("are flagged when a section is taken apart, so they don't catch drops", () => {
    const section = {
      id: "s",
      label: "S",
      fields: [],
      defaults: {},
      repeaters: [],
      tree: { t: "section", a: { className: "vt:relative" }, c: [{ t: "div", a: { className: "vt:absolute vt:inset-0 vt:bg-black/40" } }, { t: "div", a: { className: "vt:absolute vt:top-0" }, c: [{ t: "p", c: ["Badge"] }] }] },
    } as unknown as TemplateSection;
    const root = sectionToElements(section);
    const [overlay, badge] = root.props.items as BlockItem[];
    expect(overlay!.props.decor).toBe(true);
    // Positioned but holding content: an ordinary group.
    expect(badge!.props.decor).toBeUndefined();
  });
});

describe("native blocks matching a template", () => {
  it("take the design's heading and text styles but the colour of where they're placed", () => {
    const pkg = JSON.parse(readFileSync("public/builder-templates/aurelia-advisory/v1/template.json", "utf8")) as TemplatePackage;
    const css = readFileSync("public/builder-templates/aurelia-advisory/v1/theme.css", "utf8");
    const kit = kitOf(pkg, css)!;
    // The hero headline is white in the design (it sits on a dark band); its size and font stay, its colour goes.
    expect(kit.h1).toContain("vt:text-display");
    expect(kit.h1).not.toContain("vt:text-surface-container-lowest");
    expect(kit.text).not.toMatch(/vt:text-surface-variant/);
    // Labels and buttons keep their accent colours.
    expect(kit.label).toContain("vt:text-primary");
    expect(kit.button).toContain("vt:bg-primary-container");
  });
});
