import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { findImported } from "@/content/builder-templates";
import { findSample, SAMPLE_SITES, screenPath, showcaseSamples, type SampleSite } from "@/content/samples";
import { isWellFormedToken } from "@/lib/token";

describe("sample websites", () => {
  it("have unique, well-formed tokens and point at imported template versions", () => {
    expect(new Set(SAMPLE_SITES.map((s) => s.token)).size).toBe(SAMPLE_SITES.length);
    for (const s of SAMPLE_SITES) {
      expect(isWellFormedToken(s.token), s.token).toBe(true);
      expect(findImported(s.slug)?.versions, s.slug).toContain(s.version);
      expect(findSample(s.token)).toBe(s);
    }
    expect(findSample("not-a-sample-token-at-all")).toBeUndefined();
  });

  it("link to the preview and use thumbnails that exist on disk", () => {
    for (const s of showcaseSamples(SAMPLE_SITES, true)) {
      expect(s.href).toBe(`/build/preview/${s.token}`);
      for (const url of [s.thumbnail, ...s.pages.map((p) => p.thumbnail).filter(Boolean)]) {
        expect(existsSync(path.join(process.cwd(), "public", url!)), url).toBe(true);
      }
    }
  });

  it("skip unknown templates and versions, and unpublished versions outside development", () => {
    const base = SAMPLE_SITES[0]!;
    const fake: SampleSite[] = [
      { ...base, token: "unknownTemplate0001", slug: "no-such-template" },
      { ...base, token: "unknownVersion00001", version: 999 },
    ];
    expect(showcaseSamples(fake, true)).toEqual([]);

    const t = findImported(base.slug)!;
    const published = t.published.includes(base.version);
    expect(showcaseSamples([base], false).length).toBe(published ? 1 : 0);
    expect(showcaseSamples([base], true).length).toBe(1);
  });

  it("use the captured landing screens when they exist, and the template thumbnails otherwise", () => {
    const base = SAMPLE_SITES[0]!;
    const home = screenPath(base, "");
    expect(home).toBe(`/images/samples/${base.slug}-v${base.version}-home.webp`);
    expect(showcaseSamples([base], true, (f) => f === home)[0]!.thumbnail).toBe(home);
    expect(showcaseSamples([base], true, () => false)[0]!.thumbnail).toMatch(new RegExp(`^/builder-templates/${base.slug}/v${base.version}/`));
  });

  it("have a captured landing screen for every page (npm run samples:screens)", () => {
    for (const s of SAMPLE_SITES) {
      for (const p of findImported(s.slug)!.pages) {
        const file = screenPath(s, p.key);
        expect(existsSync(path.join(process.cwd(), "public", file)), file).toBe(true);
      }
    }
  });
});
