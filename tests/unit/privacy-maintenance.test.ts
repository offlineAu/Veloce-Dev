import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/config/env", () => ({ env: vi.fn() }));
vi.mock("@/server/privacy/retention", () => ({ cleanupClosedRecords: vi.fn() }));
import { env } from "@/config/env";
import { cleanupClosedRecords } from "@/server/privacy/retention";
import { POST } from "@/app/api/privacy/maintenance/route";
const secret = "privacy-test-secret-".repeat(3);
const request = (authorization?: string, query = "?dryRun=true") => new Request(`https://veloce.example/api/privacy/maintenance${query}`, { method: "POST", headers: authorization ? { authorization } : {} });
describe("privacy maintenance boundary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(env).mockReturnValue({ PRIVACY_CRON_SECRET: secret } as ReturnType<typeof env>);
  });
  it("requires its dedicated secret before any database access", async () => {
    for (const authorization of [undefined, "Bearer wrong", `Bearer ${"x".repeat(secret.length)}`, "Bearer é", secret]) {
      expect((await POST(request(authorization))).status).toBe(401);
    }
    vi.mocked(env).mockReturnValue({} as ReturnType<typeof env>);
    expect((await POST(request(`Bearer ${secret}`))).status).toBe(401);
    expect(cleanupClosedRecords).not.toHaveBeenCalled();
  });
  it("requires an explicit preview or apply mode", async () => {
    for (const query of ["", "?dryRun=", "?dryRun=0"]) expect((await POST(request(`Bearer ${secret}`, query))).status).toBe(400);
    expect(cleanupClosedRecords).not.toHaveBeenCalled();
  });
  it("runs authorized previews and deletions without caching results", async () => {
    for (const dryRun of [true, false]) {
      vi.mocked(cleanupClosedRecords).mockResolvedValue({ dryRun, cutoff: "2026-09-15T00:00:00.000Z", inquiriesEligible: 1, referralsEligible: 0, inquiriesDeleted: dryRun ? 0 : 1, referralsDeleted: 0, hasMore: false });
      const response = await POST(request(`Bearer ${secret}`, `?dryRun=${dryRun}`));
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(cleanupClosedRecords).toHaveBeenLastCalledWith({ dryRun });
      expect(await response.json()).toMatchObject({ dryRun });
    }
  });
  it("does not expose database errors or personal details", async () => {
    vi.mocked(cleanupClosedRecords).mockRejectedValue(new Error("Private database detail"));
    const response = await POST(request(`Bearer ${secret}`, "?dryRun=false"));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("Private database detail");
  });
});
