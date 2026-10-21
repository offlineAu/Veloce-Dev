import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ grant: vi.fn(), study: vi.fn(), blob: vi.fn() }));
vi.mock("@/server/portfolio/access", () => ({ CASE_FILE: /^[a-z0-9-]{1,80}\.webp$/, CASE_SLUG: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, currentCaseGrant: mock.grant, PRIVATE_HEADERS: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" } }));
vi.mock("@/server/db", () => ({ db: { privateCaseStudy: { findUnique: mock.study } } }));
vi.mock("@vercel/blob", () => ({ get: mock.blob }));
import { GET } from "@/app/api/private/[slug]/[file]/route";
const request = new Request("https://example.test/api/private/demo/photo.webp");
const context = (slug = "demo", file = "photo.webp") => ({ params: Promise.resolve({ slug, file }) });
beforeEach(() => { vi.resetAllMocks(); });
describe("private image delivery", () => {
  it("denies direct requests before accessing private storage", async () => {
    mock.grant.mockResolvedValue(null);
    const response = await GET(request, context());
    expect(response.status).toBe(404); expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mock.study).not.toHaveBeenCalled(); expect(mock.blob).not.toHaveBeenCalled();
  });
  it("validates paths and requires membership in the authorized case manifest", async () => {
    expect((await GET(request, context("..", "photo.webp"))).status).toBe(404);
    expect((await GET(request, context("demo", "../original.webp"))).status).toBe(404);
    mock.grant.mockResolvedValue({ id: "grant" }); mock.study.mockResolvedValue({ images: [{ file: "allowed.webp" }] });
    expect((await GET(request, context())).status).toBe(404); expect(mock.blob).not.toHaveBeenCalled();
  });
  it("serves only authorized preview bytes without a public storage redirect or cache", async () => {
    mock.grant.mockResolvedValue({ id: "grant" }); mock.study.mockResolvedValue({ images: [{ file: "photo.webp" }] });
    mock.blob.mockResolvedValue({ stream: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode("watermarked-preview")); controller.close(); } }) });
    const response = await GET(request, context());
    expect(await response.text()).toBe("watermarked-preview");
    expect(mock.blob).toHaveBeenCalledWith("portfolio-private/demo/photo.webp", { access: "private", useCache: false });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("location")).toBeNull();
    mock.grant.mockResolvedValue(null); expect((await GET(request, context())).status).toBe(404);
  });
});
