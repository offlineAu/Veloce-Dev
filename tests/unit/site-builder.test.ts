import { afterEach, describe, expect, it, vi } from "vitest";
import { withFreshIds, type BlockItem } from "@/lib/builder/blocks";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { MAX_HTML_BYTES } from "@/lib/builder/sanitize-limits";
import { sanitizeHtmlOnServer as sanitizeHtml } from "@/server/builder/sanitize-html";
import { MAX_SITE_BYTES, siteDraftSchema } from "@/schemas/site-draft";
import { STARTER_TEMPLATES } from "@/components/builder/templates";
import { loadDraft, loadTemplates, saveDraft } from "@/components/builder/storage";

const page = (content: BlockItem[]) => ({ data: { root: { props: { title: "T" } }, content } });

describe("server HTML sanitiser", () => {
  it("strips scripts, event handlers and javascript: URLs but keeps layout and styles", () => {
    const out = sanitizeHtml(`<style>.a{color:red}</style><div class="a" onclick="x()">Hi<img src="x" onerror="alert(1)"><a href="javascript:alert(1)">go</a></div><script>alert(1)</script>`);
    expect(out).toContain("<style>.a{color:red}</style>");
    expect(out).toContain('<div class="a">Hi');
    expect(out).not.toMatch(/onclick|onerror|javascript:|<script/i);
  });

  it("keeps embed iframes and caps the size", () => {
    expect(sanitizeHtml('<iframe src="https://www.youtube.com/embed/x" allowfullscreen></iframe>')).toContain("<iframe");
    expect(sanitizeHtml("a".repeat(MAX_HTML_BYTES + 100)).length).toBeLessThanOrEqual(MAX_HTML_BYTES);
  });
});

describe("siteDraftSchema", () => {
  it("accepts known blocks (including nested ones) and sanitises Custom HTML", async () => {
    const r = await siteDraftSchema.safeParseAsync(
      page([{ type: "Section", props: { id: "s", content: [{ type: "CustomHtml", props: { id: "h", html: "<b onclick=x>hi</b>" } }] } }]),
    );
    expect(r.success).toBe(true);
    // A draft from the single-page builder is upgraded to a one-page site.
    expect(r.data!.data.version).toBe(2);
    const nested = (r.data!.data.pages[0]!.data.content[0]!.props.content as BlockItem[])[0]!;
    expect(nested.props.html).toBe("<b>hi</b>");
  });

  it("rejects unknown block types, even nested", async () => {
    const r = await siteDraftSchema.safeParseAsync(page([{ type: "Section", props: { content: [{ type: "Evil", props: {} }] } }]));
    expect(r.success).toBe(false);
  });

  it("rejects designs over the size cap", async () => {
    const r = await siteDraftSchema.safeParseAsync(page([{ type: "Text", props: { text: "x".repeat(MAX_SITE_BYTES) } }]));
    expect(r.success).toBe(false);
  });

  it("every starter template is a valid draft", async () => {
    for (const t of STARTER_TEMPLATES) {
      expect((await siteDraftSchema.safeParseAsync({ templateId: t.id, data: t.build() })).success, t.id).toBe(true);
    }
  });
});

describe("withFreshIds", () => {
  it("gives every block, including nested ones, a new unique id", () => {
    const src: BlockItem[] = [{ type: "Columns", props: { id: "c", col1: [{ type: "Text", props: { id: "t" } }] } }];
    const a = withFreshIds(src);
    const b = withFreshIds(src);
    expect(a[0]!.props.id).not.toBe("c");
    expect(a[0]!.props.id).not.toBe(b[0]!.props.id);
    expect((a[0]!.props.col1 as BlockItem[])[0]!.props.id).not.toBe("t");
  });
});

describe("builder storage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("falls back quietly when the browser refuses storage", () => {
    const refusing = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => {} };
    vi.stubGlobal("window", { localStorage: refusing });
    expect(loadDraft()).toBeNull();
    expect(loadTemplates()).toEqual([]);
    expect(saveDraft({ doc: { version: 2, pages: [] } as never })).toBe(false);
  });

  it("ignores corrupt saved data", () => {
    vi.stubGlobal("window", { localStorage: { getItem: () => "{not json", setItem: () => {}, removeItem: () => {} } });
    expect(loadDraft()).toBeNull();
  });
});

describe("server bundle", () => {
  // jsdom (pulled in by isomorphic-dompurify) fails to load in Vercel functions and took every inquiry down with it.
  it("server code never imports a DOM library or the browser-only sanitiser", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(name)) files.push(full);
      }
    };
    ["src/server", "src/schemas", "src/app/api"].forEach(walk);
    const offenders = files.filter((f) => /from "(jsdom|isomorphic-dompurify|dompurify|@\/lib\/builder\/sanitize)"/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
