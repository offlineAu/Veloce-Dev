import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/dev/templates/route";
import { readAsset } from "@/server/builder/template-registry";

const mocks = vi.hoisted(() => ({ authenticated: true, findFirst: vi.fn(), upload: vi.fn() }));
vi.mock("@/server/security/dev-session", () => {
  class DevAuthError extends Error {}
  return { DevAuthError, requireDevSession: async () => { if (!mocks.authenticated) throw new DevAuthError(); return { name: "Tester" }; } };
});
vi.mock("@/server/builder/upload-service", () => ({ uploadTemplate: mocks.upload }));
vi.mock("@/server/security/request", () => ({ clientKey: async () => "test" }));
vi.mock("@/server/security/rate-limit", () => ({ allow: async () => true }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/db", () => ({ db: { builderTemplateVersion: { findFirst: mocks.findFirst } } }));

beforeEach(() => { mocks.authenticated = true; mocks.findFirst.mockReset(); mocks.upload.mockReset(); });

describe("private template HTML source", () => {
  it("requires a developer session before reading or uploading source", async () => {
    mocks.authenticated = false;
    expect((await GET(new Request("https://example.com/api/dev/templates?slug=local&version=1"))).status).toBe(401);
    expect((await POST(new Request("https://example.com/api/dev/templates", { method: "POST" }))).status).toBe(401);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("returns retained source with private cache headers", async () => {
    const pages = [{ fileName: "home.html", html: "<main>Original HTML</main>" }];
    mocks.findFirst.mockResolvedValue({ package: { name: "Local", websiteType: "BUSINESS", description: "Test" }, assets: [{ bytes: Buffer.from(JSON.stringify({ pages })) }] });
    const res = await GET(new Request("https://example.com/api/dev/templates?slug=local&version=1"));
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toMatchObject({ ok: true, name: "Local", pages });
  });

  it("handles older versions without stored source", async () => {
    mocks.findFirst.mockResolvedValue({ package: { name: "Old" }, assets: [] });
    expect(await (await GET(new Request("https://example.com/api/dev/templates?slug=old&version=1"))).json()).toMatchObject({ ok: true, pages: [] });
  });

  it("never serves original HTML or source images through the public asset reader", async () => {
    expect(await readAsset("local", 1, "source/design.json", { includeDrafts: true })).toBeNull();
    expect(await readAsset("local", 1, "source/assets/images/a.png", { includeDrafts: true })).toBeNull();
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });
  it("passes previous remote images and local source files to the new draft import", async () => {
    const photo = Buffer.from("previous photo");
    const local = Buffer.from("local source");
    mocks.findFirst.mockResolvedValue({ assets: [{ path: "img/existing.webp", bytes: photo }, { path: "source/assets/hero.png", bytes: local }] });
    mocks.upload.mockResolvedValue({ ok: true, slug: "local", version: 2 });
    const body = new FormData();
    body.set("slug", "local"); body.set("baseVersion", "1"); body.set("name", "Local");
    body.append("files", new File(["<main>Edited</main>"], "home.html", { type: "text/html" }));
    expect((await POST(new Request("https://example.com/api/dev/templates", { method: "POST", headers: { origin: "https://example.com" }, body }))).status).toBe(200);
    expect(mocks.upload.mock.calls[0]![0].storedImageFiles.get("img/existing.webp")).toEqual(photo);
    expect(mocks.upload.mock.calls[0]![0].assets).toEqual([{ path: "hero.png", bytes: local }]);
  });

});
