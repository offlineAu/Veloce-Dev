import { describe, expect, it, vi } from "vitest";
import { parseClass, readStyle, scalesFromCss, showClasses, storeClasses, writeStyle, type Scales } from "@/lib/builder/class-groups";
import { pieceClasses } from "@/lib/builder/elements";
import { missingFrom, themeFromCss } from "@/lib/builder/theme-vars";
import { validClasses } from "@/server/builder/css-service";

vi.mock("@/server/db", () => ({ db: {} }));

const css = "[data-vt=x]{--vt-color-primary:#f2ca50;--vt-color-surface-dim:#111;--vt-text-display:4rem;--vt-text-display--line-height:1;--vt-font-headline:Newsreader;--vt-radius-card:12px}";
const s: Scales = scalesFromCss(css);
const set = (c: string) => new Set(c.split(" "));

describe("class groups", () => {
  it("reads the design's scales", () => {
    expect(s.colors.map((c) => c.name)).toEqual(["primary", "surface-dim"]);
    expect(s.textSizes).toContain("display");
    expect(s.textSizes).not.toContain("display--line-height");
    expect(s.fonts).toEqual(["headline"]);
    expect(s.radii).toContain("card");
  });

  it("parses variants, keeping colons inside brackets", () => {
    expect(parseClass("vt:md:hover:p-4")).toMatchObject({ variants: ["md", "hover"], utility: "p-4" });
    expect(parseClass("vt:bg-[url(a:b)]")).toMatchObject({ variants: [], utility: "bg-[url(a:b)]" });
    expect(parseClass("p-4")).toBeNull();
  });

  it("tells text size, colour and alignment apart", () => {
    const v = readStyle("vt:text-display vt:text-primary vt:text-center vt:font-headline vt:font-bold", s);
    expect(v).toMatchObject({ textSize: "display", color: "primary", textAlign: "center", font: "headline", weight: "bold" });
  });

  it("changes one group and keeps every other class, including state variants", () => {
    const before = "vt:flex vt:gap-4 vt:p-8 vt:hover:bg-primary vt:bg-surface-dim vt:md:text-xl vt:text-sm vt-material-symbols";
    const after = writeStyle(before, s, "bg", "primary");
    expect(set(after)).toEqual(set("vt:flex vt:gap-4 vt:p-8 vt:hover:bg-primary vt:bg-primary vt:md:text-xl vt:text-sm vt-material-symbols"));
    // Text size shows what larger screens get, and one new value applies to every screen.
    expect(readStyle(before, s).textSize).toBe("xl");
    expect(set(writeStyle(before, s, "textSize", "2xl"))).toEqual(set("vt:flex vt:gap-4 vt:p-8 vt:hover:bg-primary vt:bg-surface-dim vt:text-2xl vt-material-symbols"));
  });

  it("splits p-N when one axis changes", () => {
    expect(readStyle("vt:p-8", s)).toMatchObject({ padX: "8", padY: "8" });
    expect(set(writeStyle("vt:p-8", s, "padY", "24"))).toEqual(set("vt:px-8 vt:py-24"));
    expect(set(writeStyle("vt:px-6 vt:pt-4 vt:pb-2", s, "padY", "10"))).toEqual(set("vt:px-6 vt:py-10"));
  });

  it("sets columns that stack on phones and round-trips", () => {
    let c = writeStyle("vt:flex vt:flex-col vt:gap-6", s, "arrange", "grid");
    c = writeStyle(c, s, "columns", 3);
    c = writeStyle(c, s, "stackOnPhones", true);
    expect(set(c)).toEqual(set("vt:grid vt:gap-6 vt:grid-cols-1 vt:md:grid-cols-3"));
    expect(readStyle(c, s)).toMatchObject({ arrange: "grid", columns: 3, stackOnPhones: true });
    // A design's own lg: columns read as the larger-screen value.
    expect(readStyle("vt:grid vt:grid-cols-1 vt:lg:grid-cols-4", s)).toMatchObject({ columns: 4, stackOnPhones: true });
  });

  it("rows can wrap to a column on phones", () => {
    const c = writeStyle(writeStyle("vt:block", s, "arrange", "row"), s, "stackOnPhones", true);
    expect(set(c)).toEqual(set("vt:flex vt:flex-col vt:md:flex-row"));
    expect(readStyle(c, s)).toMatchObject({ arrange: "row", stackOnPhones: true });
  });

  it("hides on phones without losing the layout", () => {
    const c = writeStyle("vt:grid vt:grid-cols-2", s, "visibility", "hide-phones");
    expect(set(c)).toEqual(set("vt:hidden vt:md:grid vt:grid-cols-2"));
    expect(readStyle(c, s)).toMatchObject({ arrange: "grid", visibility: "hide-phones", columns: 2 });
    expect(set(writeStyle(c, s, "visibility", "all"))).toEqual(set("vt:grid vt:grid-cols-2"));
    expect(readStyle(writeStyle("vt:flex", s, "visibility", "phones-only"), s).visibility).toBe("phones-only");
  });

  it("width presets", () => {
    const c = writeStyle("vt:max-w-[1200px] vt:px-4", s, "width", "narrow");
    expect(set(c)).toEqual(set("vt:px-4 vt:w-full vt:max-w-2xl vt:mx-auto"));
    expect(readStyle(c, s).width).toBe("narrow");
    expect(readStyle("vt:max-w-[1200px]", s).width).toBe("custom");
  });

  it("corners and shadow", () => {
    expect(readStyle("vt:rounded-card", s).rounded).toBe("card");
    expect(readStyle("vt:rounded-t-lg", s).rounded).toBe("custom");
    expect(writeStyle("vt:rounded-t-lg vt:shadow-lg", s, "rounded", "full")).toBe("vt:shadow-lg vt:rounded-full");
    expect(writeStyle("vt:shadow", s, "shadow", undefined)).toBe("");
  });

  it("raw classes are shown without the prefix and stored with it", () => {
    expect(showClasses("vt:md:p-4 vt-material-symbols-outlined")).toBe("md:p-4 vt-material-symbols-outlined");
    expect(storeClasses("md:p-4 vt-material-symbols-outlined <script>")).toEqual({ className: "vt:md:p-4 vt-material-symbols-outlined", refused: ["<script>"] });
  });
});

describe("extra classes", () => {
  it("collects piece classes from every level, prefixed ones only", () => {
    const content = [
      { type: "Section", props: { id: "s", items: [{ type: "Box", props: { id: "b", className: "vt:p-4 vt:grid", items: [{ type: "DText", props: { id: "t", className: "vt:text-xl", runs: [{ text: "a", className: "vt:italic" }] } }] } }] } },
      { type: "Heading", props: { id: "h", className: "vt:ignored" } },
    ];
    expect(pieceClasses(content as never)).toEqual(["vt:grid", "vt:italic", "vt:p-4", "vt:text-xl"]);
  });

  it("only compiles what the template lacks, from its own theme", () => {
    const tpl = ".vt\\:p-4{padding:1rem}[data-vt=x]{--vt-color-primary:#f2ca50;--vt-spacing:.25rem}";
    expect(missingFrom(tpl, ["vt:p-4", "vt:grid-cols-5"])).toEqual(["vt:grid-cols-5"]);
    expect(themeFromCss(tpl)).toContain("--color-primary: #f2ca50;");
  });

  it("refuses class names that aren't ours", () => {
    expect(validClasses(["vt:p-4", "p-4", "vt:x}<style>", 3, "vt:p-4"])).toEqual(["vt:p-4"]);
  });
});
