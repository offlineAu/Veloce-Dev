import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mapBlocks, type BlockItem } from "@/lib/builder/blocks";
import { normalizePackage } from "@/lib/builder/section-labels";
import { docFromTemplate } from "@/lib/builder/template-doc";
import type { TemplatePackage } from "@/lib/builder/template-package";
import { upgradeFromTemplate } from "@/lib/builder/template-upgrade";

const pkg = normalizePackage(JSON.parse(readFileSync("tests/fixtures/kestrel-template.json", "utf8")) as TemplatePackage);
const count = (content: BlockItem[], attr: string) => {
  let n = 0;
  mapBlocks(content, (b) => (attr in ((b.props.attrs ?? {}) as object) && n++, b));
  return n;
};

describe("sites made before their template had interactions", () => {
  it("get the template's interactions, keeping their own changes", () => {
    const doc = docFromTemplate(pkg, "pieces");
    const home = doc.pages[0]!;
    const before = count(home.data.content, "data-vt-marquee");
    expect(before).toBe(3);
    // As saved before interactions: none of them, a raw section name, a stale state, and the visitor's own text.
    home.data.content = mapBlocks(home.data.content, (b) => {
      const attrs = { ...((b.props.attrs ?? {}) as Record<string, unknown>) };
      for (const k of Object.keys(attrs)) if (k.startsWith("data-vt-")) delete attrs[k];
      if (b.props.tag === "button" && String(b.props.className).includes("menu-btn")) attrs["aria-expanded"] = "false";
      return { ...b, props: { ...b.props, attrs, ...(b.props.name === "Hero" ? { name: "HERO" } : {}) } };
    });
    home.data.content[3] = { ...home.data.content[3]!, props: { ...home.data.content[3]!.props, className: `${home.data.content[3]!.props.className} my-own-class` } };
    expect(count(home.data.content, "data-vt-marquee")).toBe(0);

    const up = upgradeFromTemplate(doc, pkg)!;
    const content = up.pages[0]!.data.content;
    expect(count(content, "data-vt-marquee")).toBe(3);
    expect(count(content, "data-vt-accordion")).toBe(1);
    expect(count(content, "aria-expanded")).toBe(0);
    expect(String(content[3]!.props.className)).toContain("my-own-class");
    // Nothing left to add the second time.
    expect(upgradeFromTemplate(up, pkg)).toBeNull();
  });

  it("finds parts by their look when the site's sections no longer line up with the template", () => {
    const doc = docFromTemplate(pkg, "pieces");
    const home = doc.pages[0]!;
    // An older site: no interactions, the hero renamed and wrapped in an extra group.
    home.data.content = mapBlocks(home.data.content, (b) => {
      const attrs = { ...((b.props.attrs ?? {}) as Record<string, unknown>) };
      for (const k of Object.keys(attrs)) if (k.startsWith("data-vt-")) delete attrs[k];
      return { ...b, props: { ...b.props, attrs } };
    });
    const hero = home.data.content.findIndex((b) => b.props.name === "Hero");
    home.data.content[hero] = { type: "Box", props: { id: "Box-wrap", tag: "div", className: "", items: [{ ...home.data.content[hero]!, props: { ...home.data.content[hero]!.props, name: "My hero" } }] } };
    const up = upgradeFromTemplate(doc, pkg)!;
    expect(count(up.pages[0]!.data.content, "data-vt-marquee")).toBe(3);
  });

  it("leaves sites made from another template alone", () => {
    const doc = docFromTemplate(pkg, "pieces");
    expect(upgradeFromTemplate({ ...doc, templateRef: { slug: "noir-needle", version: 1 } }, pkg)).toBeNull();
  });
});
