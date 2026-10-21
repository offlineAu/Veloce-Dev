import { afterEach, describe, expect, it, vi } from "vitest";
import { totpCode, verifyTotp } from "@/server/security/totp";
import { decodeSession, encodeSession } from "@/server/security/dev-session";
import { trustedClientIp } from "@/server/security/request";
import { hashPassword, verifyPassword } from "@/server/security/password";
const mock = vi.hoisted(() => ({ session: vi.fn(), grant: vi.fn(), cookie: vi.fn() }));
vi.mock("@/server/db", () => ({ db: { securitySession: { findUnique: mock.session }, privateAccessGrant: { findUnique: mock.grant } } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: mock.cookie }), headers: async () => new Headers() }));
import { sessionActive } from "@/server/security/sessions";
import { caseGrant, grantHash } from "@/server/portfolio/access";
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe("authenticator verification", () => {
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  it("matches RFC 6238 six-digit truncation and rejects wrong/old codes", () => {
    expect(totpCode(secret, 1)).toBe("287082");
    expect(verifyTotp(secret, "287082", 59_000)).toBe(1);
    expect(verifyTotp(secret, "287082", 180_000)).toBeNull();
    expect(verifyTotp(secret, "28708", 59_000)).toBeNull();
    expect(verifyTotp("invalid", "287082", 59_000)).toBeNull();
  });
});
it("revokes developer signatures when password or session version changes", () => {
  vi.stubEnv("TEMPLATE_UPLOAD_PASSWORD_HASH", "first");
  const token = encodeSession({ name: "Tester", exp: Date.now() + 60_000 }, "fixture-secret");
  expect(decodeSession(token, "fixture-secret")).not.toBeNull();
  expect(decodeSession(token + ".extra", "fixture-secret")).toBeNull();
  vi.stubEnv("DEV_SESSION_VERSION", "2"); expect(decodeSession(token, "fixture-secret")).toBeNull();
  vi.stubEnv("DEV_SESSION_VERSION", "1"); vi.stubEnv("TEMPLATE_UPLOAD_PASSWORD_HASH", "second"); expect(decodeSession(token, "fixture-secret")).toBeNull();
});
it("requires an active session of the correct privilege even with a valid signature", async () => {
  mock.session.mockResolvedValue({ kind: "owner", expiresAt: new Date(Date.now() + 60_000), revokedAt: null });
  expect(await sessionActive("id", "owner")).toBe(true);
  expect(await sessionActive("id", "developer")).toBe(false);
  mock.session.mockResolvedValue({ kind: "owner", expiresAt: new Date(Date.now() + 60_000), revokedAt: new Date() });
  expect(await sessionActive("id", "owner")).toBe(false);
  expect(await sessionActive(undefined, "owner")).toBe(false);
});
it("ignores untrusted forwarded IPs and validates the ingress-appended address", () => {
  vi.stubEnv("VERCEL", "0"); vi.stubEnv("SECURITY_TRUSTED_IP_HEADER", "");
  const headers = new Headers({ "x-forwarded-for": "1.2.3.4, 8.8.8.8" });
  expect(trustedClientIp(headers)).toBe("unknown");
  vi.stubEnv("SECURITY_TRUSTED_IP_HEADER", "x-forwarded-for"); expect(trustedClientIp(headers)).toBe("8.8.8.8");
  headers.set("x-forwarded-for", "garbage"); expect(trustedClientIp(headers)).toBe("unknown");
});
it("rejects malformed password hashes and passwords longer than the supported maximum", () => {
  expect(verifyPassword("anything", "scrypt:16384:8:1:abc:AA")).toBe(false);
  const hash = hashPassword("x".repeat(200));
  expect(verifyPassword("x".repeat(201), hash)).toBe(false);
});
it("limits invitations by case, expiry and revocation without storing raw codes", async () => {
  const token = "x".repeat(43);
  mock.grant.mockResolvedValue({ id: "grant", caseSlug: "case-a", expiresAt: new Date(Date.now() + 60_000), revokedAt: null });
  expect(await caseGrant("case-a", token)).not.toBeNull();
  expect(mock.grant).toHaveBeenCalledWith(expect.objectContaining({ where: { tokenHash: grantHash(token) } }));
  expect(await caseGrant("case-b", token)).toBeNull();
  mock.grant.mockResolvedValue({ caseSlug: "case-a", expiresAt: new Date(Date.now() - 1), revokedAt: null }); expect(await caseGrant("case-a", token)).toBeNull();
  mock.grant.mockResolvedValue({ caseSlug: "case-a", expiresAt: new Date(Date.now() + 60_000), revokedAt: new Date() }); expect(await caseGrant("case-a", token)).toBeNull();
});
