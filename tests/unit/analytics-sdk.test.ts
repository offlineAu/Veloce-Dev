import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CaptureResult } from "posthog-js";
const mocks = vi.hoisted(() => ({ visitor: vi.fn(), capture: vi.fn(), allow: vi.fn() }));
vi.mock("@/server/analytics/consent", () => ({ currentVisitor: mocks.visitor }));
vi.mock("@/server/analytics/capture", () => ({ scheduleAnalytics: (task: () => unknown) => task(), captureBrowser: mocks.capture }));
vi.mock("@/server/security/request", () => ({ clientKey: async () => "fixture-key" }));
vi.mock("@/server/security/rate-limit", () => ({ allow: mocks.allow }));
import { sanitizeSdkEvent } from "@/lib/analytics/sdk";
import { POST } from "@/app/api/analytics/e/route";
const event = (properties: object = {}, name = "$pageview"): CaptureResult => ({ uuid: crypto.randomUUID(), event: name, properties: { page: "/", distinct_id: "sdk-anonymous", ...properties } });
const request = (data: unknown, origin = "https://veloce.example") => new Request("https://veloce.example/api/analytics/e", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(data) });
beforeEach(() => { vi.clearAllMocks(); mocks.visitor.mockResolvedValue({ id: "server-consent-id" }); mocks.allow.mockResolvedValue(true); });
afterEach(() => vi.restoreAllMocks());
describe("SDK privacy filters", () => {
  it("drops events before consent and all unsupported SDK features", () => {
    expect(sanitizeSdkEvent(event(), false)).toBeNull();
    for (const name of ["$autocapture", "$snapshot", "$exception", "$identify", "$feature_flag_called"]) expect(sanitizeSdkEvent(event({}, name), true)).toBeNull();
    expect(sanitizeSdkEvent(event({ page: "/admin/analytics" }), true)).toBeNull();
  });
  it("retains the SDK ingestion token required by before_send validation", () => {
    expect(sanitizeSdkEvent(event({ token: "public-project-token" }), true)?.properties.token).toBe("public-project-token");
  });
  it("removes automatically captured URLs, IPs, titles, form contents and person properties", () => {
    const sanitized = sanitizeSdkEvent({ ...event({ $current_url: "https://site/?ref=secret", $referrer: "https://site/?email=private@example.com", $ip: "127.0.0.1", $browser: "raw-browser", $set: { email: "private@example.com" }, email: "private@example.com", page: "/refer/[token]" }), $set: { email: "private@example.com" } }, true);
    expect(sanitized?.properties).toEqual({ page: "/refer/[token]", distinct_id: "sdk-anonymous" });
    expect(JSON.stringify(sanitized)).not.toMatch(/secret|private@example|127.0.0.1/);
  });
});
describe("consent-checked first-party SDK ingestion", () => {
  it("uses the signed server identity and strips untrusted browser properties again", async () => {
    const data = event({ sessionId: crypto.randomUUID(), $current_url: "https://site/?secret=private", email: "private@example.com" });
    expect((await POST(request(data))).status).toBe(200);
    expect(mocks.capture).toHaveBeenCalledWith("server-consent-id", "$pageview", { page: "/", sessionId: data.properties.sessionId }, data.uuid);
  });
  it("accepts the SDK transport batch envelope without forwarding its key or metadata", async () => {
    const data = event();
    expect((await POST(request({ api_key: "public-project-token", batch: [data] }))).status).toBe(200);
    expect(mocks.capture).toHaveBeenCalledWith("server-consent-id", "$pageview", { page: "/" }, data.uuid);
    expect((await POST(request({ batch: Array.from({ length: 21 }, () => event()) }))).status).toBe(400);
  });
  it("accepts SDK beacon base64 form encoding", async () => {
    const data = event({}, "$pageleave");
    const response = await POST(new Request("https://veloce.example/api/analytics/e", { method: "POST", headers: { origin: "https://veloce.example", "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ data: Buffer.from(JSON.stringify(data)).toString("base64") }).toString() }));
    expect(response.status).toBe(200); expect(mocks.capture).toHaveBeenCalledOnce();
  });
  it("rejects cross-origin requests, missing consent, invalid routes and forged conversions", async () => {
    expect((await POST(request(event(), "https://other.example"))).status).toBe(403);
    mocks.visitor.mockResolvedValue(null); expect((await POST(request(event()))).status).toBe(403);
    mocks.visitor.mockResolvedValue({ id: "server-id" });
    expect((await POST(request(event({ page: "/build/preview/secret" })))).status).toBe(400);
    expect((await POST(request(event({}, "inquiry_submitted")))).status).toBe(400);
    expect(mocks.capture).not.toHaveBeenCalled();
  });
});
