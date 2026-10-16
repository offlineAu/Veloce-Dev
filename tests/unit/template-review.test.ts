import { beforeEach, describe, expect, it, vi } from "vitest";
import { templateReview } from "@/server/builder/template-review";

const mocks = vi.hoisted(() => ({ findFirst: vi.fn(), local: true }));
vi.mock("@/server/db", () => ({ db: { builderTemplateVersion: { findFirst: mocks.findFirst } } }));
vi.mock("@/content/builder-templates", () => ({
  findImported: (slug: string) => slug === "repo-template" ? { slug, versions: [1, 3, 6], published: [3] } : undefined,
  currentVersion: () => 6,
  showDrafts: () => mocks.local,
}));

beforeEach(() => { mocks.findFirst.mockReset(); mocks.local = true; });

describe("template review version selection", () => {
  it("selects an older uploaded version and its own publication status/report", async () => {
    mocks.findFirst.mockResolvedValue({ version: 3, status: "PUBLISHED", report: "v3 report" });
    expect(await templateReview("homeware", true, "3")).toEqual({ slug: "homeware", version: 3, published: true, report: "v3 report", canPublish: true });
    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { template: { slug: "homeware" }, version: 3 } }));
  });

  it("preserves latest-version behavior for existing links", async () => {
    mocks.findFirst.mockResolvedValue({ version: 6, status: "DRAFT", report: "latest" });
    expect(await templateReview("homeware", true)).toMatchObject({ version: 6, published: false });
    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { template: { slug: "homeware" } }, orderBy: { version: "desc" } }));
  });

  it("never reads uploaded review information without a developer session", async () => {
    expect(await templateReview("homeware", false, "3")).toBeUndefined();
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("does not substitute the latest version for a missing one", async () => {
    mocks.findFirst.mockResolvedValue(null);
    expect(await templateReview("homeware", true, "99")).toBeUndefined();
    expect(await templateReview("repo-template", true, "99")).toBeUndefined();
  });

  it.each(["", "0", "-1", "1.5", "1e2", "NaN", " 3", "03", "9007199254740992"])("rejects malformed version %j before accessing storage", async (version) => {
    expect(await templateReview("homeware", true, version)).toBeUndefined();
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("selects historical repository versions and keeps publication restricted to the CLI", async () => {
    expect(await templateReview("repo-template", false, "3")).toMatchObject({ version: 3, published: true, canPublish: false });
    expect(await templateReview("repo-template", true, "1")).toMatchObject({ version: 1, published: false, canPublish: false });
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("restricts repository draft review in production to developers", async () => {
    mocks.local = false;
    expect(await templateReview("repo-template", false, "1")).toBeUndefined();
    expect(await templateReview("repo-template", true, "1")).toMatchObject({ version: 1, canPublish: false });
  });
});
