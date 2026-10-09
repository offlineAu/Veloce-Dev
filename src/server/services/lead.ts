import "server-only";
import { z } from "zod";
import { env } from "@/config/env";
import { db } from "@/server/db";
import { dispatch } from "@/server/notifications/dispatch";
import { leadAckEmail, leadTeamEmail } from "@/server/notifications/templates";
import { hmac } from "@/server/security/hash";
import { allow } from "@/server/security/rate-limit";
import { looksLikeBot } from "@/server/security/request";
import { CONSULTATION_TOPICS, PROJECT_TYPES, WEBSITE_TYPES, inquirySchema } from "@/schemas/inquiry";
import { defaultServices } from "@/content/site";
import { findCampaign } from "./campaign";
import { ensureCompanyId, getCompanyProfile } from "./company";
import { RATE_LIMITED, UNAVAILABLE, type ActionResult } from "./result";

const label = (list: readonly (readonly [string, string])[], v?: string) => list.find((x) => x[0] === v)?.[1];

export async function submitInquiry(raw: unknown, ctx: { clientKey: string }): Promise<ActionResult> {
  const parsed = inquirySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, code: "VALIDATION", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const input = parsed.data;

  // Looks like a bot: pretend success, store nothing, give no signal.
  if (looksLikeBot(input)) return { ok: true };

  try {
    // A retried request returns the original outcome without side effects.
    const existing = await db.lead.findUnique({ where: { idempotencyKey: input.idempotencyKey }, select: { id: true } });
    if (existing) return { ok: true };

    const withinLimits =
      (await allow(`inq:ip:${ctx.clientKey}`, 8, 3600_000)) &&
      (await allow(`inq:email:${hmac(input.email)}`, 3, 3600_000));
    if (!withinLimits) return RATE_LIMITED;

    // Attribution is resolved on the server from the public token; client-supplied ids are never used.
    const campaign = await findCampaign(input.refToken);
    const source = campaign ? "REFERRAL_VERIFIED" : input.referralClaimed ? "REFERRAL_UNVERIFIED" : "DIRECT";
    const companyId = await ensureCompanyId();

    let leadId: string;
    try {
      const lead = await db.lead.create({
        data: {
          companyId,
          name: input.name,
          email: input.email,
          companyName: input.companyName,
          currentWebsite: input.currentWebsite,
          projectType: input.projectType,
          websiteType: input.websiteType,
          serviceSlug: input.serviceSlug,
          projectGoals: input.projectGoals,
          additionalDetails: input.additionalDetails,
          intent: input.intent,
          source,
          referralCampaignId: campaign?.id,
          idempotencyKey: input.idempotencyKey,
          consentAt: new Date(),
          attribution: {
            create: {
              landingPath: input.landingPath,
              utmSource: input.utmSource,
              utmMedium: input.utmMedium,
              utmCampaign: input.utmCampaign,
            },
          },
        },
        select: { id: true },
      });
      leadId = lead.id;
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") return { ok: true }; // concurrent duplicate
      throw err;
    }

    const company = await getCompanyProfile();
    const e = env();
    await Promise.all([
      dispatch({
        kind: "LEAD_TEAM",
        entity: { leadId },
        to: e.NOTIFY_TEAM_EMAIL ?? company.contactEmail,
        message: leadTeamEmail({
          company: company.name,
          name: input.name,
          email: input.email,
          companyName: input.companyName,
          website: input.currentWebsite,
          projectType: label(input.intent === "CONSULTATION" ? CONSULTATION_TOPICS : PROJECT_TYPES, input.projectType) ?? input.projectType,
          websiteType: label(WEBSITE_TYPES, input.websiteType),
          service: input.serviceSlug ? (defaultServices.find((x) => x.slug === input.serviceSlug)?.title ?? input.serviceSlug) : undefined,
          goals: input.projectGoals,
          details: input.additionalDetails,
          intent: input.intent,
          source: source === "DIRECT" ? "Direct" : source === "REFERRAL_VERIFIED" ? "Referral (verified)" : "Referral (claimed, unverified)",
          campaignName: campaign?.name,
        }),
      }),
      dispatch({
        kind: "LEAD_ACK",
        entity: { leadId },
        to: input.email,
        message: leadAckEmail({ company: company.name, name: input.name, intent: input.intent }),
      }),
    ]);

    return { ok: true };
  } catch (err) {
    console.error("[inquiry] submission failed", err);
    return UNAVAILABLE;
  }
}
