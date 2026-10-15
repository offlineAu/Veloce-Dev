import { Fragment, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { renderNode } from "@/components/builder/node-tree";
import { backgroundUrl, bgImage } from "@/lib/builder/bg-image";
import { sectionToElements } from "@/lib/builder/elements";
import type { ElementNode, TemplateSection } from "@/lib/builder/template-package";

const PHOTO = "/builder-templates/shop/v1/img/abc.webp";

describe("background photos", () => {
  it("finds the photo in an inline style, quoted or not", () => {
    expect(backgroundUrl("background-image: url('https://x.test/a.jpg')")).toBe("https://x.test/a.jpg");
    expect(backgroundUrl('color: red; background: center / cover url("https://x.test/b.jpg") no-repeat')).toBe("https://x.test/b.jpg");
    expect(backgroundUrl("background-image:url(https://x.test/c.jpg)")).toBe("https://x.test/c.jpg");
    expect(backgroundUrl("color: red")).toBeUndefined();
    expect(backgroundUrl(undefined)).toBeUndefined();
  });

  it("only turns safe addresses into a CSS value", () => {
    expect(bgImage(PHOTO)).toBe(`url("${PHOTO}")`);
    expect(bgImage("https://x.test/a.jpg")).toBe('url("https://x.test/a.jpg")');
    for (const bad of ["", "javascript:alert(1)", "http://x.test/a.jpg", "//x.test/a.jpg", 'https://x.test/a.jpg") ; color: red', "https://x.test/a b.jpg", "data:image/png;base64,AAA"]) {
      expect(bgImage(bad), bad).toBeUndefined();
    }
  });

  const tree: ElementNode = { t: "div", a: { className: "vt:bg-cover", style: { color: "red" } }, b: { bg: "i1" }, c: [{ f: "t1" }] };

  it("renders a bound background as the element's background image", () => {
    const html = renderToStaticMarkup(createElement(Fragment, null, renderNode(tree, { values: { i1: PHOTO, t1: "Hello" }, items: {}, puck: { isEditing: false, metadata: {} } })));
    expect(html).toBe(`<div class="vt:bg-cover" style="color:red;background-image:url(&quot;${PHOTO}&quot;)">Hello</div>`);
    const unsafe = renderToStaticMarkup(createElement(Fragment, null, renderNode(tree, { values: { i1: "javascript:x", t1: "Hello" }, items: {}, puck: { isEditing: false, metadata: {} } })));
    expect(unsafe).not.toContain("background");
  });

  it("keeps the photo when a section is taken apart into design pieces", () => {
    const section = { id: "s", label: "S", tree, fields: [], defaults: { i1: PHOTO, t1: "Hello" }, repeaters: [] } as unknown as TemplateSection;
    const piece = sectionToElements(section);
    expect(piece.type).toBe("Box");
    expect(piece.props.bg).toBe(PHOTO);
  });
});
