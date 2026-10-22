import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { totpCode } from "@/server/security/totp";
import { hashPassword } from "@/server/security/password";
const mocks = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn(), allow: vi.fn(), owner: vi.fn(), lead: vi.fn(), intro: vi.fn(), appointments: vi.fn(), session: vi.fn(), register: vi.fn(), revoke: vi.fn(), consume: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.get, set: mocks.set, delete: mocks.delete }) }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
vi.mock("@/server/security/request", () => ({ clientKey: async () => "fixture-key" }));
vi.mock("@/server/security/rate-limit", () => ({ allow: mocks.allow }));
vi.mock("@/server/db", () => ({ db: { securitySession: { findUnique: mocks.session, create: mocks.register, updateMany: mocks.revoke }, rateLimit: { create: mocks.consume }, lead: { count: mocks.lead }, referralIntroduction: { count: mocks.intro }, appointment: { findMany: mocks.appointments } } }));
import { encodeOwnerSession, isOwner, validOwnerSession, OWNER_SESSION_SECONDS } from "@/server/admin/session";
import { ownerLogin, ownerLogout } from "@/app/admin/analytics/actions";
import { getBusinessReport, getTrafficReport, previousWindow, reportDays, reportWindow, trafficQueries } from "@/server/analytics/report";
const password = "fixture-owner-password";
const hash = hashPassword(password);
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("ANALYTICS_OWNER_PASSWORD_HASH", hash);
  vi.stubEnv("ANALYTICS_OWNER_SESSION_SECRET", "owner-fixture-secret-".repeat(3));
  vi.stubEnv("POSTHOG_PROJECT_ID", "42"); vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "private-query-key");
  vi.stubEnv("POSTHOG_REGION", "eu");
  mocks.allow.mockResolvedValue(true);
  mocks.session.mockResolvedValue({ kind: "owner", expiresAt: new Date(Date.now() + 60_000), revokedAt: null });
  mocks.register.mockResolvedValue({}); mocks.revoke.mockResolvedValue({ count: 1 }); mocks.consume.mockResolvedValue({});
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ results: [] })));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const form = (value: string) => { const data = new FormData(); data.set("password", value); return data; };
describe("dedicated analytics owner access", () => {
  it("rejects expired, tampered, malformed and developer cookies", async () => {
    const token = encodeOwnerSession(Date.now() + 10_000);
    expect(validOwnerSession(token)).toBe(true);
    for (const invalid of [token + ".extra", token + "x", "dev-cookie", encodeOwnerSession(Date.now() - 1), "9999999999999.bad"]) expect(validOwnerSession(invalid)).toBe(false);
    mocks.get.mockReturnValue(undefined); expect(await isOwner()).toBe(false);
    mocks.get.mockReturnValue({ value: token }); expect(await isOwner()).toBe(true);
  });
  it("password and signing-secret changes invalidate sessions", () => {
    const token = encodeOwnerSession(Date.now() + 10_000);
    vi.stubEnv("ANALYTICS_OWNER_PASSWORD_HASH", "different-hash"); expect(validOwnerSession(token)).toBe(false);
    vi.stubEnv("ANALYTICS_OWNER_PASSWORD_HASH", hash); vi.stubEnv("ANALYTICS_OWNER_SESSION_SECRET", "other-secret-".repeat(4)); expect(validOwnerSession(token)).toBe(false);
  });
  it("rate limits failed logins and never sets a cookie for invalid passwords", async () => {
    expect(await ownerLogin({ error: "" }, form("wrong"))).toHaveProperty("error"); expect(mocks.set).not.toHaveBeenCalled();
    mocks.allow.mockResolvedValue(false);
    expect((await ownerLogin({ error: "" }, form(password))).error).toContain("Too many"); expect(mocks.set).not.toHaveBeenCalled();
  });
  it("sets a separate secure owner cookie and redirects after successful login", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const secret = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
    vi.stubEnv("ANALYTICS_OWNER_TOTP_SECRET", secret);
    const data = form(password); data.set("code", totpCode(secret, Math.floor(Date.now() / 30_000)));
    await expect(ownerLogin({ error: "" }, data)).rejects.toThrow("redirect:/admin/analytics");
    expect(mocks.set).toHaveBeenCalledWith("veloce_owner", expect.any(String), { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: OWNER_SESSION_SECONDS });
    await expect(ownerLogout()).rejects.toThrow("redirect:/admin/analytics"); expect(mocks.delete).toHaveBeenCalledWith("veloce_owner");
  });
  it("requires an authenticator in production and rejects reused authenticator steps", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(await ownerLogin({ error: "" }, form(password))).toHaveProperty("error");
    expect(mocks.set).not.toHaveBeenCalled();
    const secret = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
    vi.stubEnv("ANALYTICS_OWNER_TOTP_SECRET", secret);
    const data = form(password); data.set("code", totpCode(secret, Math.floor(Date.now() / 30_000)));
    mocks.consume.mockRejectedValue({ code: "P2002" });
    expect((await ownerLogin({ error: "" }, data)).error).toContain("next authenticator code");
    expect(mocks.set).not.toHaveBeenCalled();
  });
  it("denies an otherwise signed owner cookie after database revocation", async () => {
    mocks.get.mockReturnValue({ value: encodeOwnerSession(Date.now() + 10_000) });
    mocks.session.mockResolvedValue({ kind: "owner", expiresAt: new Date(Date.now() + 60_000), revokedAt: new Date() });
    expect(await isOwner()).toBe(false);
    await expect(getBusinessReport(7)).rejects.toThrow("Owner session required");
    expect(mocks.lead).not.toHaveBeenCalled();
  });
  it("denies reporting before querying PostHog or the database", async () => {
    await expect(getTrafficReport(7)).rejects.toThrow("Owner session required");
    await expect(getBusinessReport(7)).rejects.toThrow("Owner session required");
    expect(fetch).not.toHaveBeenCalled(); expect(mocks.lead).not.toHaveBeenCalled();
  });
});
describe("private report queries", () => {
  const authenticate = () => mocks.get.mockReturnValue({ value: encodeOwnerSession(Date.now() + 10_000) });
  it("bounds reporting windows and uses Manila calendar days", () => {
    expect(reportDays("7")).toBe(7); expect(reportDays("90")).toBe(90); expect(reportDays("1;DROP")).toBe(30);
    expect(reportWindow(7, new Date("2026-10-19T01:00:00Z")).start.toISOString()).toBe("2026-10-12T16:00:00.000Z");
    const queries = trafficQueries(new Date("2026-10-01"), new Date("2026-10-19"));
    expect(queries.totals).toContain("'$pageview', 'page_viewed'"); expect(queries.trend).toContain("Asia/Manila");
    // The comparison window is as long as the report window and ends where it starts.
    expect(queries.totals).toContain("2026-09-13T00:00:00.000Z");
    const window = reportWindow(7, new Date("2026-10-19T01:00:00Z"));
    expect(previousWindow(window)).toEqual({ start: new Date("2026-10-06T07:00:00.000Z"), end: window.start });
  });
  it("keeps the read key on the server and checks auth again before cached results", async () => {
    authenticate();
    vi.mocked(fetch).mockImplementation(async (_url, options) => {
      const body = JSON.parse(options!.body as string);
      return Response.json({ results: body.query.query.startsWith("SELECT uniqIf(") ? [[12, 34, 17, 10, 30, 15]] : [] });
    });
    const report = await getTrafficReport(7);
    expect(report.totals).toEqual({ visitors: 12, views: 34, sessions: 17 });
    expect(report.previous).toEqual({ visitors: 10, views: 30, sessions: 15 });
    expect(JSON.stringify(report)).not.toContain("private-query-key");
    expect(vi.mocked(fetch).mock.calls[0]![0]).toBe("https://eu.posthog.com/api/projects/42/query/");
    expect(vi.mocked(fetch).mock.calls[0]![1]!.headers).toMatchObject({ Authorization: "Bearer private-query-key" });
    await getTrafficReport(7); expect(fetch).toHaveBeenCalledTimes(3);
    mocks.get.mockReturnValue(undefined); await expect(getTrafficReport(7)).rejects.toThrow("Owner session required");
  });
  it("reports provider errors generically and supports the US query host", async () => {
    authenticate(); vi.stubEnv("POSTHOG_REGION", "us");
    vi.mocked(fetch).mockResolvedValue(new Response("private upstream detail", { status: 403 }));
    await expect(getTrafficReport(90)).rejects.toThrow("Analytics report unavailable");
    expect(vi.mocked(fetch).mock.calls[0]![0]).toBe("https://us.posthog.com/api/projects/42/query/");
  });
  it("counts business records independently of analytics consent", async () => {
    authenticate(); mocks.lead.mockResolvedValue(6); mocks.intro.mockResolvedValue(2); mocks.appointments.mockResolvedValue([{ leadId: "one" }]);
    const totals = { inquiries: 6, introductions: 2, confirmedBookings: 1 };
    expect(await getBusinessReport(30)).toEqual({ ...totals, previous: totals });
    expect(mocks.appointments).toHaveBeenCalledWith(expect.objectContaining({ distinct: ["leadId"] }));
    expect(JSON.stringify(mocks.lead.mock.calls)).not.toContain("analyticsVisitorId");
  });
});
