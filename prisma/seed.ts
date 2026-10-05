import "dotenv/config";
import { randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { defaultServices } from "../src/content/site";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  // Company details and services come from env and src/content/site.ts, so re-seeding keeps the database in step.
  // There is no admin UI yet, so nothing edited in the database is lost that is not also defined here.
  const companyData = {
    name: process.env.COMPANY_NAME ?? "Veloce",
    description: process.env.COMPANY_DESCRIPTION ?? "Build fast. Build what works.",
    contactEmail: process.env.COMPANY_CONTACT_EMAIL ?? "hello@example.com",
    websiteUrl: process.env.NEXT_PUBLIC_SITE_URL,
  };
  const existing = await db.company.findFirst();
  const company = existing ? await db.company.update({ where: { id: existing.id }, data: companyData }) : await db.company.create({ data: companyData });

  const slugs = defaultServices.map((s) => s.slug);
  await db.service.deleteMany({ where: { companyId: company.id, slug: { notIn: slugs } } });
  for (const [i, s] of defaultServices.entries()) {
    const data = { title: s.title, description: s.description, benefit: s.benefit, icon: s.icon, displayOrder: i };
    await db.service.upsert({
      where: { companyId_slug: { companyId: company.id, slug: s.slug } },
      create: { companyId: company.id, slug: s.slug, ...data },
      update: data,
    });
  }

  // Demo campaigns exist ONLY for local development. They contain obviously fake people and offers.
  if (process.env.NODE_ENV !== "production") {
    const demo = async (name: string, data: Record<string, unknown>) => {
      const exists = await db.referralCampaign.findFirst({ where: { companyId: company.id, name } });
      if (exists) return exists;
      return db.referralCampaign.create({
        data: { companyId: company.id, name, publicToken: randomBytes(16).toString("base64url"), ...data },
      });
    };
    const active = await demo("DEMO active campaign", {
      referrerName: "Alex Demo", referrerRole: "Operations Lead", referrerCompany: "Demo Co.",
      referrerEmail: "alex.demo@example.com", showReferrerName: true,
      offerTitle: "DEMO OFFER: placeholder text, not a real discount",
      offerDescription: "Replace this with the real offer before launch.",
      offerExpiresAt: new Date(Date.now() + 30 * 24 * 3600_000),
    });
    const expired = await demo("DEMO expired campaign", {
      referrerName: "Sam Demo", showReferrerName: true,
      offerTitle: "DEMO OFFER (expired)", offerExpiresAt: new Date(Date.now() - 24 * 3600_000),
    });
    const noOffer = await demo("DEMO no-offer campaign", { showReferrerName: false });
    console.log("Demo tokens (dev only):");
    console.log(`  active:   ${active.publicToken}`);
    console.log(`  expired:  ${expired.publicToken}`);
    console.log(`  no offer: ${noOffer.publicToken}`);
  }
  console.log("Seed complete.");
}

main().finally(() => db.$disconnect());
