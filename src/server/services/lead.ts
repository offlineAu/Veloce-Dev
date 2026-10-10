import "server-only";
import { z } from "zod";
import { env } from "@/config/env";
import { db } from "@/server/db";
import { dispatch } from "@/server/notifications/dispatch";
import { leadAckEmail, leadTeamEmail } from "@/server/notifications/templates";
import { hmac, newPublicToken } from "@/server/security/hash";
import { allow } from "@/server/security/rate-limit";
import { looksLikeBot } from "@/server/security/request";
import { CONSULTATION_TOPICS, PROJECT_TYPES, WEBSITE_TYPES, inquirySchema } from "@/schemas/inquiry";
import type { SiteDraftData } from "@/schemas/site-draft";
import type { Prisma } from "@/generated/prisma/client";
import { defaultServices } from "@/content/site";
import { findCampaign } from "./campaign";
import { ensureCompanyId, getCompanyProfile } from "./company";
import { RATE_LIMITED, UNAVAILABLE, type ActionResult } from "./result";

/** Which template a design came from: an imported template's exact version ("noir-needle@v1") or a starter id. */
const draftLabel = ({ templateId, data }: SiteDraftData) => (data.templateRef ? `${data.templateRef.slug}@v${data.templateRef.version}` : templateId);

const label = (list: readonly (readonly [string, string])[], v?: string) => list.find((x) => x[0] === v)?.[1];

export async function submitInquiry(raw: unknown, ctx: { clientKey: string }): Promise<ActionResult> {
  const parsed = inquirySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, code: "VALIDATION", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const input = parsed.data;
  // A site designed in the /build editor. Its validation (template packages, HTML sanitising) is loaded only when a
  // design is attached, so an ordinary inquiry never depends on any of it.
  const draftRaw = (raw as { siteDraft?: unknown } | null)?.siteDraft;
  const draft = draftRaw === undefined ? undefined : await (await import("@/schemas/site-draft")).siteDraftSchema.safeParseAsync(draftRaw);
  if (draft && !draft.success) {
    return { ok: false, code: "VALIDATION", fieldErrors: { siteDraft: [draft.error.issues[0]?.message ?? "We couldn't read your design."] } };
  }

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
    const draftToken = draft?.success ? newPublicToken() : undefined;
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
          ...(draft?.success
            ? { siteDraft: { create: { token: draftToken!, templateId: draftLabel(draft.data), data: draft.data.data as unknown as Prisma.InputJsonValue } } }
            : {}),
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
          draftUrl: draftToken ? new URL(`/build/preview/${draftToken}`, e.NEXT_PUBLIC_SITE_URL).toString() : undefined,
          draftPages: draft?.success ? draft.data.data.pages.length : undefined,
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
