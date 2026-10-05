import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "pg";

// These tests need a reachable PostgreSQL (npm run db:dev, then npm run db:deploy). Skipped otherwise.
const url = process.env.DATABASE_URL;
let reachable = false;
if (url) {
  const c = new Client({ connectionString: url, connectionTimeoutMillis: 2000 });
  reachable = await c.connect().then(() => c.end().then(() => true), () => false);
}

const d = reachable ? describe : describe.skip;

d("services against a real database", () => {
  let db: typeof import("@/server/db").db;
  let lead: typeof import("@/server/services/lead");
  let intro: typeof import("@/server/services/introduction");
  let campaigns: typeof import("@/server/services/campaign");
  let provider: typeof import("@/server/notifications/provider");
  const sent: { to: string; subject: string }[] = [];
  const ctx = { clientKey: "test-client" };
  const TOKEN = "INT_TEST_TOKEN_000001";
  const EXPIRED = "INT_TEST_EXPIRED_0001";
  const INACTIVE = "INT_TEST_INACTIVE_001";
  let companyId: string;

  const base = () => ({
    name: "Test Person", email: `t${Math.random().toString(36).slice(2)}@example.com`, projectType: "NEW_PROJECT",
    projectGoals: "A site", privacyConsent: true, idempotencyKey: crypto.randomUUID(), startedAt: Date.now() - 5000,
  });

  beforeAll(async () => {
    ({ db } = await import("@/server/db"));
    lead = await import("@/server/services/lead");
    intro = await import("@/server/services/introduction");
    campaigns = await import("@/server/services/campaign");
    provider = await import("@/server/notifications/provider");
    const { ensureCompanyId } = await import("@/server/services/company");
    companyId = await ensureCompanyId();
    const mk = (token: string, extra: object) =>
      db.referralCampaign.upsert({
        where: { publicToken: token },
        create: { companyId, name: token, publicToken: token, referrerEmail: "referrer@example.com", ...extra },
        update: { ...extra },
      });
    await mk(TOKEN, { active: true, showReferrerName: true, referrerName: "Rita", offerTitle: "Offer" });
    await mk(EXPIRED, { active: true, offerTitle: "Old", offerExpiresAt: new Date(Date.now() - 1000) });
    await mk(INACTIVE, { active: false, offerTitle: "Off" });
  });

  beforeEach(async () => {
    sent.length = 0;
    provider.setProviderForTests({
      delivers: true,
      send: async (e) => {
        sent.push({ to: e.to, subject: e.subject });
        return { providerRef: "test" };
      },
    });
    await db.rateLimit.deleteMany();
  });

  afterAll(async () => {
    provider?.setProviderForTests(undefined);
    await db?.$disconnect();
  });

  it("persists a direct lead with status NEW and notifies team + prospect", async () => {
    const input = base();
    expect(await lead.submitInquiry(input, ctx)).toEqual({ ok: true });
    const row = await db.lead.findUniqueOrThrow({ where: { idempotencyKey: input.idempotencyKey }, include: { attribution: true } });
    expect(row).toMatchObject({ status: "NEW", source: "DIRECT", referralCampaignId: null });
    expect(row.attribution).not.toBeNull();
    const recipients = sent.map((s) => s.to);
    expect(recipients).toHaveLength(2);
    expect(recipients).toContain(input.email);
  });

  it("attributes a verified referral token to the campaign", async () => {
    const input = { ...base(), refToken: TOKEN };
    await lead.submitInquiry(input, ctx);
    const row = await db.lead.findUniqueOrThrow({ where: { idempotencyKey: input.idempotencyKey }, include: { campaign: true } });
    expect(row.source).toBe("REFERRAL_VERIFIED");
    expect(row.campaign?.publicToken).toBe(TOKEN);
  });

  it("expired campaigns still attribute (the introduction happened); inactive/unknown do not", async () => {
    const results: Record<string, string | undefined> = {};
    for (const t of [EXPIRED, INACTIVE, "INT_TEST_UNKNOWN_00001", "bad token!"]) {
      const input = { ...base(), refToken: t };
      await lead.submitInquiry(input, ctx);
      results[t] = (await db.lead.findUniqueOrThrow({ where: { idempotencyKey: input.idempotencyKey } })).source;
    }
    expect(results[EXPIRED]).toBe("REFERRAL_VERIFIED");
    expect(results[INACTIVE]).toBe("DIRECT");
    expect(results["INT_TEST_UNKNOWN_00001"]).toBe("DIRECT");
    expect(results["bad token!"]).toBe("DIRECT");
  });

  it("an unverified claim is recorded as such and never as verified", async () => {
    const input = { ...base(), referralClaimed: true };
    await lead.submitInquiry(input, ctx);
    expect((await db.lead.findUniqueOrThrow({ where: { idempotencyKey: input.idempotencyKey } })).source).toBe("REFERRAL_UNVERIFIED");
  });

  it("a retried submission creates one lead and sends notifications once", async () => {
    const input = base();
    await lead.submitInquiry(input, ctx);
    const first = sent.length;
    await lead.submitInquiry(input, ctx);
    await Promise.all([lead.submitInquiry(input, ctx), lead.submitInquiry(input, ctx)]);
    expect(await db.lead.count({ where: { idempotencyKey: input.idempotencyKey } })).toBe(1);
    expect(sent.length).toBe(first);
    expect(await db.notificationLog.count({ where: { lead: { idempotencyKey: input.idempotencyKey } } })).toBe(2);
  });

  it("returns field errors for invalid input and stores nothing", async () => {
    const r = await lead.submitInquiry({ ...base(), email: "bad", privacyConsent: false }, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok && r.code === "VALIDATION") expect(Object.keys(r.fieldErrors)).toEqual(expect.arrayContaining(["email", "privacyConsent"]));
  });

  it("silently drops honeypot and too-fast submissions", async () => {
    const a = { ...base(), contactFax: "spam" };
    const b = { ...base(), startedAt: Date.now() };
    expect(await lead.submitInquiry(a, ctx)).toEqual({ ok: true });
    expect(await lead.submitInquiry(b, ctx)).toEqual({ ok: true });
    expect(await db.lead.count({ where: { idempotencyKey: { in: [a.idempotencyKey, b.idempotencyKey] } } })).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it("rate limits repeated submissions from one client", async () => {
    let limited = 0;
    for (let i = 0; i < 10; i++) {
      const r = await lead.submitInquiry(base(), { clientKey: "flooder" });
      if (!r.ok && r.code === "RATE_LIMITED") limited++;
    }
    expect(limited).toBeGreaterThanOrEqual(2);
  });

  it("a notification failure never fails the submission and is recorded", async () => {
    provider.setProviderForTests({ delivers: true, send: async () => { throw new Error("boom"); } });
    const input = base();
    expect(await lead.submitInquiry(input, ctx)).toEqual({ ok: true });
    const logs = await db.notificationLog.findMany({ where: { lead: { idempotencyKey: input.idempotencyKey } } });
    expect(logs).toHaveLength(2);
    expect(logs.every((l) => l.status === "FAILED" && l.attempts === 1)).toBe(true);
  });

  it("without a configured provider, notifications are logged as SKIPPED, not SENT", async () => {
    provider.setProviderForTests({ delivers: false, send: async () => { throw new Error("n/a"); } });
    const input = base();
    await lead.submitInquiry(input, ctx);
    const logs = await db.notificationLog.findMany({ where: { lead: { idempotencyKey: input.idempotencyKey } } });
    expect(logs.every((l) => l.status === "SKIPPED")).toBe(true);
  });

  it("notification logs hold a hash, never the address", async () => {
    const input = base();
    await lead.submitInquiry(input, ctx);
    const logs = await db.notificationLog.findMany({ where: { lead: { idempotencyKey: input.idempotencyKey } } });
    expect(JSON.stringify(logs)).not.toContain(input.email);
  });

  describe("introductions", () => {
    const intro1 = () => ({
      referrerName: "Rita", referrerEmail: `r${Math.random().toString(36).slice(2)}@example.com`,
      referredName: "Bo", referredEmail: `b${Math.random().toString(36).slice(2)}@example.com`,
      projectInterest: "REDESIGN", referrerConsent: true, refToken: TOKEN,
      idempotencyKey: crypto.randomUUID(), startedAt: Date.now() - 5000,
    });

    it("persists with campaign and notifies the team only; never the referred person", async () => {
      const input = intro1();
      const r = await intro.submitIntroduction(input, ctx);
      expect(r).toEqual({ ok: true, referrerEmailed: false });
      const row = await db.referralIntroduction.findUniqueOrThrow({ where: { idempotencyKey: input.idempotencyKey }, include: { campaign: true } });
      expect(row.campaign?.publicToken).toBe(TOKEN);
      expect(sent.map((s) => s.to)).not.toContain(input.referredEmail);
      expect(sent.map((s) => s.to)).not.toContain(input.referrerEmail);
      expect(sent).toHaveLength(1);
    });

    it("copies the referrer only when NOTIFY_REFERRER is enabled, and reports it truthfully", async () => {
      vi.stubEnv("NOTIFY_REFERRER", "true");
      vi.resetModules();
      const fresh = await import("@/server/services/introduction");
      const p = await import("@/server/notifications/provider");
      p.setProviderForTests({ delivers: true, send: async (e) => { sent.push({ to: e.to, subject: e.subject }); return { providerRef: "t" }; } });
      const input = intro1();
      const r = await fresh.submitIntroduction(input, ctx);
      expect(r).toEqual({ ok: true, referrerEmailed: true });
      expect(sent.map((s) => s.to)).toContain(input.referrerEmail);
      vi.unstubAllEnvs();
    });

    it("requires consent and rejects self-introduction", async () => {
      expect((await intro.submitIntroduction({ ...intro1(), referrerConsent: false }, ctx)).ok).toBe(false);
      const same = intro1();
      expect((await intro.submitIntroduction({ ...same, referredEmail: same.referrerEmail }, ctx)).ok).toBe(false);
    });

    it("is idempotent", async () => {
      const input = intro1();
      await intro.submitIntroduction(input, ctx);
      await intro.submitIntroduction(input, ctx);
      expect(await db.referralIntroduction.count({ where: { idempotencyKey: input.idempotencyKey } })).toBe(1);
      expect(sent).toHaveLength(1);
    });
  });

  describe("public campaign view", () => {
    it("never exposes ids or the referrer email", async () => {
      const view = await campaigns.getPublicCampaign(TOKEN);
      expect(view).not.toBeNull();
      expect(JSON.stringify(view)).not.toMatch(/referrerEmail|referrer@example|"id"|companyId/);
    });

    it("hides the referrer name when the campaign does not allow it, unless it is the referrer's own page", async () => {
      await db.referralCampaign.update({ where: { publicToken: TOKEN }, data: { showReferrerName: false } });
      expect((await campaigns.getPublicCampaign(TOKEN))?.referrerName).toBeNull();
      expect((await campaigns.getPublicCampaign(TOKEN, { audience: "referrer" }))?.referrerName).toBe("Rita");
      await db.referralCampaign.update({ where: { publicToken: TOKEN }, data: { showReferrerName: true } });
    });

    it("reports expiry state and treats unknown/inactive/malformed as indistinguishable", async () => {
      expect((await campaigns.getPublicCampaign(EXPIRED))?.offer.state).toBe("expired");
      for (const t of [INACTIVE, "INT_TEST_UNKNOWN_00001", "x", undefined, 42, "'; DROP TABLE \"Lead\"; --"]) {
        expect(await campaigns.getPublicCampaign(t)).toBeNull();
      }
    });
  });
});
