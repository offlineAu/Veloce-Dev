import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addPage, deletePage, docFromPage, duplicatePage, migrateDoc, movePage, newDoc, renamePage, uniquePath, withTheme, PATH_RE, type SiteDoc,
} from "@/lib/builder/site-doc";
import { THEME_PRESETS } from "@/lib/builder/theme";
import { siteDraftSchema } from "@/schemas/site-draft";
import { loadDraft, loadTemplates } from "@/components/builder/storage";

const v1 = { root: { props: { title: "Old", accent: "#2f6b4f", font: "classic" } }, content: [{ type: "Heading", props: { id: "h", text: "Hi" } }] };

describe("site documents", () => {
  it("upgrades a single-page draft, keeping its colour and font", () => {
    const doc = migrateDoc(v1)!;
    expect(doc.version).toBe(2);
    expect(doc.pages).toHaveLength(1);
    expect(doc.pages[0]).toMatchObject({ path: "/", title: "Home" });
    expect(doc.theme.accent).toBe("#2f6b4f");
    expect(doc.theme.fontHeading).toContain("Georgia");
    expect(migrateDoc(doc)).toEqual(doc);
    expect(migrateDoc({ nope: true })).toBeNull();
  });

  it("gives every page a unique, valid address", () => {
    let doc = newDoc();
    doc = addPage(doc, "About us").doc;
    doc = addPage(doc, "About us").doc;
    doc = addPage(doc, "Ünïcode & Café!").doc;
    expect(doc.pages.map((p) => p.path)).toEqual(["/", "/about-us", "/about-us-2", "/unicode-cafe"]);
    expect(doc.pages.every((p) => PATH_RE.test(p.path))).toBe(true);
    expect(uniquePath(doc.pages, "")).toBe("/page");
  });

  it("renames, duplicates next to the original, moves and deletes pages; the home page stays", () => {
    let doc: SiteDoc = addPage(newDoc(), "Work").doc;
    const work = doc.pages[1]!.id;
    doc = renamePage(doc, work, "Projects");
    expect(doc.pages[1]).toMatchObject({ title: "Projects", path: "/projects" });
    const dup = duplicatePage(doc, work);
    expect(dup.doc.pages.map((p) => p.title)).toEqual(["Home", "Projects", "Projects copy"]);
    doc = movePage(dup.doc, dup.id, -1);
    expect(doc.pages[1]!.id).toBe(dup.id);
    expect(deletePage(doc, doc.pages[0]!.id)).toBe(doc); // home can't be deleted
    expect(deletePage(doc, work).pages).toHaveLength(2);
  });

  it("applies a theme change to every page", () => {
    const noir = THEME_PRESETS.find((p) => p.id === "noir")!.theme;
    const doc = withTheme(addPage(newDoc(), "B").doc, noir);
    expect(doc.pages.every((p) => (p.data.root.props?.theme as { accent: string }).accent === noir.accent)).toBe(true);
  });

  it("server accepts multi-page sites and rejects broken ones", () => {
    const doc = addPage(docFromPage(v1), "Contact").doc;
    expect(siteDraftSchema.safeParse({ data: doc }).success).toBe(true);
    const dupPaths = { ...doc, pages: doc.pages.map((p) => ({ ...p, path: "/" })) };
    expect(siteDraftSchema.safeParse({ data: dupPaths }).success).toBe(false);
    const badPath = { ...doc, pages: [doc.pages[0]!, { ...doc.pages[1]!, path: "/../etc" }] };
    expect(siteDraftSchema.safeParse({ data: badPath }).success).toBe(false);
    const tooMany = { ...doc, pages: Array.from({ length: 13 }, (_, i) => ({ ...doc.pages[0]!, id: `p${i}`, path: i ? `/p${i}` : "/" })) };
    expect(siteDraftSchema.safeParse({ data: tooMany }).success).toBe(false);
    // A design built on an imported template that doesn't exist is refused.
    const ghost = { ...doc, templateRef: { slug: "ghost", version: 1 }, pages: [{ ...doc.pages[0]!, data: { ...doc.pages[0]!.data, content: [{ type: "DesignSection", props: { sectionId: "x" } }] } }] };
    expect(siteDraftSchema.safeParse({ data: ghost }).error?.issues[0]?.message).toMatch(/no longer available/);
  });
});

describe("browser storage upgrades", () => {
  afterEach(() => vi.unstubAllGlobals());
  const storage = (items: Record<string, unknown>) => ({
    localStorage: { getItem: (k: string) => (k in items ? JSON.stringify(items[k]) : null), setItem: () => {}, removeItem: () => {} },
  });

  it("restores a draft saved by the single-page builder", () => {
    vi.stubGlobal("window", storage({ "veloce.builder.draft.v1": { data: v1, templateId: "business", updatedAt: 1 } }));
    const d = loadDraft()!;
    expect(d.templateId).toBe("business");
    expect(d.doc.pages[0]!.data.content).toHaveLength(1);
  });

  it("upgrades saved templates and drops unreadable ones", () => {
    vi.stubGlobal("window", storage({ "veloce.builder.templates.v1": [{ id: "a", name: "Mine", data: v1, createdAt: 1 }, { id: "b", name: "Junk", data: 5, createdAt: 1 }] }));
    expect(loadTemplates().map((t) => [t.name, t.doc.version])).toEqual([["Mine", 2]]);
  });
});
