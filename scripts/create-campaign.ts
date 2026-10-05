/**
 * Create a referral or promotional campaign (admin UI is planned; this is the v1 way).
 *
 *   npx tsx scripts/create-campaign.ts --name "Spring promo" --referrer "Jane Cruz" --role "Owner" \
 *     --company "Cruz Bakery" --email jane@example.com --show-name \
 *     --offer-title "..." --offer-description "..." --expires 2026-12-31
 *
 * Omit --referrer for a general promotion. Prints the referrer page and prospect links.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const { values: v } = parseArgs({
  options: {
    name: { type: "string" }, referrer: { type: "string" }, role: { type: "string" }, company: { type: "string" },
    email: { type: "string" }, message: { type: "string" }, "show-name": { type: "boolean" },
    "offer-title": { type: "string" }, "offer-description": { type: "string" },
    starts: { type: "string" }, expires: { type: "string" },
  },
});
if (!v.name) {
  console.error("--name is required");
  process.exit(1);
}
const date = (s?: string) => {
  if (!s) return undefined;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${s}`);
  return d;
};

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const company = await db.company.findFirst();
if (!company) throw new Error("No company yet. Run `npm run db:seed` or submit a form once.");
const token = randomBytes(16).toString("base64url");
await db.referralCampaign.create({
  data: {
    companyId: company.id, name: v.name, publicToken: token,
    referrerName: v.referrer, referrerRole: v.role, referrerCompany: v.company, referrerEmail: v.email,
    personalMessage: v.message, showReferrerName: v["show-name"] ?? false,
    offerTitle: v["offer-title"], offerDescription: v["offer-description"],
    offerStartsAt: date(v.starts), offerExpiresAt: date(v.expires),
  },
});
console.log(`Referrer page: ${site}/refer/${token}`);
console.log(`Prospect link: ${site}/?ref=${token}`);
await db.$disconnect();
