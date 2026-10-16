import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
const mocks = vi.hoisted(() => ({
  visitor: vi.fn(), create: vi.fn(), update: vi.fn(), allow: vi.fn(), dev: vi.fn(), cookieGet: vi.fn(), cookieSet: vi.fn(), cookieDelete: vi.fn(),
  tasks: [] as (() => Promise<unknown>)[],
}));
vi.mock("@/server/db", () => ({ db: { analyticsVisitor: { findUnique: mocks.visitor, create: mocks.create, update: mocks.update } } }));
vi.mock("next/server", () => ({ after: (task: () => Promise<unknown>) => { mocks.tasks.push(task); } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.cookieGet, set: mocks.cookieSet, delete: mocks.cookieDelete }) }));
vi.mock("@/server/security/rate-limit", () => ({ allow: mocks.allow }));
vi.mock("@/server/security/request", () => ({ clientKey: async () => "hashed-test-client" }));
vi.mock("@/server/security/dev-session", () => ({ readDevSession: mocks.dev }));
vi.mock("@/server/security/hash", () => ({ hmac: (value: string) => createHmac("sha256", "analytics-test-secret").update(value).digest("hex").slice(0, 32) }));
import { normalizedPage, analyticsContextSchema, campaignLabel } from "@/lib/analytics/shared";
import { PRIVACY_NOTICE_VERSION } from "@/lib/legal";
import { signVisitor, verifiedVisitor } from "@/server/analytics/consent";
import { conversion, eventUuid, unlinkedReference, submissionTracking } from "@/server/analytics/capture";
import { POST } from "@/app/api/analytics/route";
const id = "a9b27ca6-c194-4554-a1fa-cdb8bc3fc832";
const reference = "b9b27ca6-c194-4554-a1fa-cdb8bc3fc832";
const active = () => ({ id, reference, noticeVersion: PRIVACY_NOTICE_VERSION, consentAt: new Date(), expiresAt: new Date(Date.now() + 86400_000), revokedAt: null, identifiedAt: null, deletionRequestedAt: null });
const request = (body: object, origin = "https://veloce.example") => new Request("https://veloce.example/api/analytics", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
async function flush() { for (const task of mocks.tasks.splice(0)) await task(); }
const payloads = () => vi.mocked(fetch).mock.calls.map(([, options]) => JSON.parse(options!.body as string));
beforeEach(() => {
  vi.resetAllMocks(); mocks.tasks.length = 0;
  vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("ANALYTICS_ENABLED", "true"); vi.stubEnv("POSTHOG_PROJECT_KEY", "test-project-key"); vi.stubEnv("POSTHOG_REGION", "eu");
  mocks.dev.mockResolvedValue(null); mocks.allow.mockResolvedValue(true);
  mocks.cookieGet.mockReturnValue({ value: signVisitor(id) }); mocks.visitor.mockResolvedValue(active());
  mocks.create.mockResolvedValue(active()); mocks.update.mockResolvedValue(active());
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("analytics boundaries", () => {
  it("redacts referral tokens and excludes private, API, asset and unknown routes", () => {
    expect(normalizedPage("/refer/private-token")).toBe("/refer/[token]");
    expect(normalizedPage("/services/web-design")).toBe("/services/web-design");
    for (const path of ["/build/preview/secret", "/build/t/example/v1/home", "/api/analytics", "/unknown", "/?ref=secret"]) expect(normalizedPage(path)).toBeUndefined();
    expect(campaignLabel("newsletter_october")).toBe("newsletter_october");
    for (const label of ["email@example.com", "https://secret.example", "spaces here", "x".repeat(81)]) expect(campaignLabel(label)).toBeUndefined();
  });
  it("drops malformed optional context instead of breaking a business form", () => {
    expect(analyticsContextSchema.parse({ link: "yes", first: { landingPage: "/secret" } })).toBeUndefined();
    expect(analyticsContextSchema.parse({ link: false, email: "private@example.com" })).toEqual({ link: false });
  });
  it("rejects tampered signed identities", () => {
    expect(verifiedVisitor(signVisitor(id))).toBe(id);
    expect(verifiedVisitor(signVisitor(id).replace(id, reference))).toBeUndefined();
    expect(verifiedVisitor(`${signVisitor(id)}.extra`)).toBeUndefined();
  });
  it("requires same-origin writes before any consent changes", async () => {
    expect((await POST(request({ action: "allow", noticeVersion: PRIVACY_NOTICE_VERSION }, "https://other.example"))).status).toBe(403);
    expect(mocks.allow).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled();
  });
  it("sets a secure HTTP-only cookie only after explicit acceptance", async () => {
    mocks.cookieGet.mockReturnValue(undefined);
    const response = await POST(request({ action: "allow", noticeVersion: PRIVACY_NOTICE_VERSION }));
    expect(response.status).toBe(204);
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.cookieSet).toHaveBeenCalledWith("veloce_analytics", signVisitor(id), expect.objectContaining({ httpOnly: true, secure: true, sameSite: "lax" }));
    expect(fetch).not.toHaveBeenCalled();
  });
  it("resume/status never creates consent or a new identity", async () => {
    mocks.cookieGet.mockReturnValue(undefined);
    expect((await POST(request({ action: "status" }))).status).toBe(403);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it.each(["development", "test"])("excludes %s", async mode => {
    vi.stubEnv("NODE_ENV", mode);
    expect((await POST(request({ action: "allow", noticeVersion: PRIVACY_NOTICE_VERSION }))).status).toBe(403);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("excludes previews, disabled collection, and developer sessions", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    expect((await POST(request({ action: "status" }))).status).toBe(403);
    vi.stubEnv("VERCEL_ENV", "production"); vi.stubEnv("ANALYTICS_ENABLED", "false");
    expect((await POST(request({ action: "status" }))).status).toBe(403);
    vi.stubEnv("ANALYTICS_ENABLED", "true"); mocks.dev.mockResolvedValue({ name: "Developer" });
    expect((await POST(request({ action: "status" }))).status).toBe(403);
  });
  it("does not capture without consent, after withdrawal, after expiry or with an old notice", async () => {
    const body = { action: "capture", event: "page_viewed", uuid: crypto.randomUUID(), properties: { page: "/" } };
    for (const changes of [{ revokedAt: new Date() }, { expiresAt: new Date(0) }, { noticeVersion: "old" }, { deletionRequestedAt: new Date() }]) {
      mocks.visitor.mockResolvedValue({ ...active(), ...changes });
      expect((await POST(request(body))).status).toBe(403);
    }
    expect(mocks.tasks).toHaveLength(0);
  });
  it("strips private fields before sending allowlisted browser events", async () => {
    expect((await POST(request({ action: "capture", event: "page_viewed", uuid: crypto.randomUUID(), properties: { page: "/refer/[token]", email: "private@example.com", token: "secret", $current_url: "https://site/?ref=secret" } }))).status).toBe(204);
    expect(fetch).not.toHaveBeenCalled(); await flush();
    expect(payloads()[0].properties).toMatchObject({ page: "/refer/[token]", distinct_id: id, $geoip_disable: true });
    expect(JSON.stringify(payloads())).not.toMatch(/private@example|secret|current_url/);
    expect(vi.mocked(fetch).mock.calls[0]![0]).toBe("https://eu.i.posthog.com/capture/");
  });
  it("rejects forged conversions and unsafe paths at the public collector", async () => {
    for (const body of [
      { action: "capture", event: "inquiry_submitted", uuid: crypto.randomUUID(), properties: { page: "/" } },
      { action: "capture", event: "page_viewed", uuid: crypto.randomUUID(), properties: { page: "/build/preview/secret" } },
    ]) expect((await POST(request(body))).status).toBe(400);
    expect(mocks.tasks).toHaveLength(0);
  });
  it("withdraws server consent and clears cookies even when collection is disabled", async () => {
    vi.stubEnv("ANALYTICS_ENABLED", "false");
    expect((await POST(request({ action: "withdraw" }))).status).toBe(204);
    expect(mocks.update).toHaveBeenCalledWith({ where: { id }, data: { revokedAt: expect.any(Date) } });
    expect(mocks.cookieDelete).toHaveBeenCalledWith("veloce_analytics");
  });
  it("optional tracking failures do not become submission failures", async () => {
    mocks.visitor.mockRejectedValue(new Error("private database detail"));
    expect(await submissionTracking({ link: true })).toBeUndefined();
    expect(await submissionTracking(undefined)).toBeUndefined();
  });
  it("enforces rate limits and returns generic failure responses", async () => {
    mocks.allow.mockResolvedValue(false);
    expect((await POST(request({ action: "status" }))).status).toBe(429);
    mocks.allow.mockRejectedValue(new Error("private detail"));
    const response = await POST(request({ action: "status" }));
    expect(response.status).toBe(503); expect(await response.text()).not.toContain("private");
  });
});
describe("server conversion delivery", () => {
  const input = { event: "inquiry_submitted" as const, key: "lead-fixture", visitorId: id, context: { link: false, sessionId: "a9b27ca6-c194-4554-a1fa-cdb8bc3fc833" }, form: "inquiry" };
  it("isolates unchecked conversions from browsing and session history", async () => {
    conversion(input); await flush();
    expect(payloads()).toHaveLength(1);
    expect(payloads()[0]).toMatchObject({ event: "inquiry_submitted", properties: { distinct_id: unlinkedReference(input.key), journey_linked: false } });
    expect(payloads()[0].properties.$session_id).toBeUndefined();
    expect(payloads()[0].properties.$anon_distinct_id).toBeUndefined();
  });
  it("links checked requests using opaque references and stable IDs on repeated delivery", async () => {
    for (let i = 0; i < 2; i++) { conversion({ ...input, linkedAt: new Date() }); await flush(); }
    const events = payloads();
    expect(events[0]).toMatchObject({ event: "$identify", properties: { distinct_id: reference, $anon_distinct_id: id, $set: { lead_reference: reference } } });
    expect(events[1]).toMatchObject({ event: "inquiry_submitted", properties: { distinct_id: reference, journey_linked: true } });
    expect(events[1].uuid).toBe(events[3].uuid);
    expect(events[0].uuid).toBe(events[2].uuid);
    expect(eventUuid("booking_confirmed:one-lead")).not.toBe(eventUuid("booking_confirmed:another-lead"));
  });
  it("checks withdrawal again when deferred work executes", async () => {
    conversion(input); mocks.visitor.mockResolvedValue({ ...active(), revokedAt: new Date() }); await flush();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("contains network failures and does not log submitted data", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("private provider response"));
    conversion(input); await expect(flush()).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith("[analytics] delivery failed");
  });
});
