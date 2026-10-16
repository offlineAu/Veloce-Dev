import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/server/db", () => ({ db: {} }));
vi.mock("server-only", () => ({}));
import { makeComponent } from "@/lib/builder/components";
import type { SiteDoc } from "@/lib/builder/site-doc";
import { normalizeStyles, stylesCss, textStyleClasses, webFontsUsed } from "@/lib/builder/site-styles";
import { docFromTemplate } from "@/lib/builder/template-doc";
import { siteDraftSchema } from "@/schemas/site-draft";

describe("site styles", () => {
  it("keeps valid tokens and styles, and drops anything that could carry CSS", () => {
    const s = normalizeStyles({
      tokens: { "--vt-color-primary": "#e11d48", "--vt-font-headline": "Fraunces", "--vt-text-display": "4.5rem", "--vt-color-x": "red;}body{display:none", "--vt-font-y": "Comic Sans", "--evil": "#fff" },
      colors: [{ id: "brand", name: "Brand", value: "oklch(0.6 0.2 30)" }, { id: "bad", name: "Bad", value: "url(x)" }, { id: "brand", name: "Dup", value: "#000" }],
      text: [{ id: "h1", name: "Heading 1", className: "vt:text-5xl vt:font-bold" }, { id: "x", name: "X", className: "vt:p-4 <script>" }],
    })!;
    expect(s.tokens).toEqual({ "--vt-color-primary": "#e11d48", "--vt-font-headline": "Fraunces", "--vt-text-display": "4.5rem" });
    expect(s.colors).toEqual([{ id: "brand", name: "Brand", value: "oklch(0.6 0.2 30)" }]);
    expect(s.text!.map((t) => t.id)).toEqual(["h1"]);
  });

  it("writes scoped CSS with font stacks, and lists the web fonts to load", () => {
    const s = { tokens: { "--vt-font-headline": "Fraunces", "--vt-color-primary": "#e11d48" }, colors: [{ id: "brand", name: "Brand", value: "#123456" }] };
    expect(stylesCss(s, "noir-needle")).toBe(`[data-vt="noir-needle"]{--vt-font-headline:'Fraunces', Georgia, serif;--vt-color-primary:#e11d48;--vs-brand:#123456}`);
    expect(stylesCss(s, "bad scope}")).toBe("");
    expect(webFontsUsed(s, ["'Inter', system-ui, sans-serif", "Georgia, serif"])).toEqual(["Fraunces", "Inter"]);
    expect(textStyleClasses({ text: [{ id: "h1", name: "H1", className: "vt:text-5xl" }] }, "h1")).toBe("vt:text-5xl");
  });
});

describe("submitted designs with styles and components", () => {
  const pkg = JSON.parse(readFileSync("public/builder-templates/noir-needle/v1/template.json", "utf8"));
  const base = (): SiteDoc => docFromTemplate(pkg, "pieces");
  const check = async (doc: SiteDoc) => {
    const r = await siteDraftSchema.safeParseAsync({ templateId: "noir-needle", data: doc });
    return r.success ? "ok" : r.error.issues[0]!.message;
  };

  it("accepts styles, text styles on pieces, and components", async () => {
    const doc = base();
    const first = doc.pages[0]!.data.content[1]!;
    const { main, def } = makeComponent(first, "c-abcd1234", "Hero");
    doc.pages[0]!.data.content[1] = { ...main, props: { ...main.props, textStyle: "h1" } };
    doc.components = { "c-abcd1234": def };
    doc.styles = { text: [{ id: "h1", name: "Heading 1", className: "vt:text-5xl" }], colors: [{ id: "brand", name: "Brand", value: "#123456" }] };
    expect(await check(doc)).toBe("ok");
  });

  it("refuses malformed component data on pieces", async () => {
    const doc = base();
    const first = doc.pages[0]!.data.content[1]!;
    doc.pages[0]!.data.content[1] = { ...first, props: { ...first.props, component: { id: "not valid" } } };
    expect(await check(doc)).toMatch(/component not allowed/);
  });
});
