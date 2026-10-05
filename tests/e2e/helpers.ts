import "dotenv/config";
import { Client } from "pg";

export const TOKENS = {
  active: "E2E_ACTIVE_TOKEN_0001",
  expired: "E2E_EXPIRED_TOKEN_001",
  noOffer: "E2E_NO_OFFER_TOKEN_01",
  hidden: "E2E_HIDDEN_NAME_TOKEN",
} as const;

async function withDb<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

export const query = <T extends object = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
  withDb(async (c) => (await c.query(sql, params)).rows as T[]);

/** Creates/refreshes deterministic e2e campaigns and clears rate-limit counters. */
export async function resetFixtures() {
  await withDb(async (c) => {
    let company = (await c.query(`SELECT id FROM "Company" LIMIT 1`)).rows[0]?.id as string | undefined;
    if (!company) {
      company = "e2e_company";
      await c.query(
        `INSERT INTO "Company"(id,name,description,"contactEmail","updatedAt") VALUES ($1,'E2E Co','Custom website development.','hello@example.com',now())`,
        [company],
      );
    }
    const upsert = (token: string, extra: Record<string, unknown>) =>
      c.query(
        `INSERT INTO "ReferralCampaign"(id,"companyId",name,"publicToken","referrerName","referrerRole","referrerCompany","showReferrerName","offerTitle","offerDescription","offerExpiresAt",active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true)
         ON CONFLICT ("publicToken") DO UPDATE SET "offerExpiresAt"=EXCLUDED."offerExpiresAt","offerTitle"=EXCLUDED."offerTitle","showReferrerName"=EXCLUDED."showReferrerName","referrerName"=EXCLUDED."referrerName",active=true`,
        [
          `c_${token}`, company, `E2E ${token}`, token, extra.referrerName ?? null, extra.role ?? null, extra.corp ?? null,
          extra.show ?? false, extra.title ?? null, extra.desc ?? null, extra.expires ?? null,
        ],
      );
    const day = 24 * 3600_000;
    await upsert(TOKENS.active, { referrerName: "Alex Tester", role: "Ops Lead", corp: "Tester Co", show: true, title: "E2E OFFER TITLE", desc: "E2E offer description", expires: new Date(Date.now() + 30 * day) });
    await upsert(TOKENS.expired, { referrerName: "Sam Tester", show: true, title: "E2E EXPIRED OFFER", expires: new Date(Date.now() - day) });
    await upsert(TOKENS.noOffer, { referrerName: "Pat Tester", show: true });
    await upsert(TOKENS.hidden, { referrerName: "Secret Person", show: false, title: "E2E HIDDEN OFFER" });
    await c.query(`DELETE FROM "RateLimit"`);
  });
}

export const uniqueEmail = (p: string) => `${p}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`;
