import "server-only";
import { z } from "zod";
import { env } from "@/config/env";
import { db } from "@/server/db";
import { dispatch } from "@/server/notifications/dispatch";
import { introReferrerEmail, introTeamEmail } from "@/server/notifications/templates";
import { hmac } from "@/server/security/hash";
import { allow } from "@/server/security/rate-limit";
import { looksLikeBot } from "@/server/security/request";
import { PROJECT_INTERESTS, introductionSchema } from "@/schemas/introduction";
import { findCampaign } from "./campaign";
import { getCompanyProfile } from "./company";
import { RATE_LIMITED, UNAVAILABLE, type ActionResult } from "./result";

export type IntroductionResult = ActionResult<{ referrerEmailed: boolean }>;

export async function submitIntroduction(raw: unknown, ctx: { clientKey: string }): Promise<IntroductionResult> {
  const parsed = introductionSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, code: "VALIDATION", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const input = parsed.data;

  if (looksLikeBot(input)) return { ok: true, referrerEmailed: false };

  try {
    const existing = await db.referralIntroduction.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      select: { id: true },
    });
    if (existing) return { ok: true, referrerEmailed: false };

    const withinLimits =
      (await allow(`intro:ip:${ctx.clientKey}`, 6, 3600_000)) &&
      (await allow(`intro:referrer:${hmac(input.referrerEmail)}`, 10, 24 * 3600_000));
    if (!withinLimits) return RATE_LIMITED;

    const campaign = await findCampaign(input.refToken);

    let introductionId: string;
    try {
      const row = await db.referralIntroduction.create({
        data: {
          campaignId: campaign?.id,
          referrerName: input.referrerName,
          referrerEmail: input.referrerEmail,
          referredName: input.referredName,
          referredEmail: input.referredEmail,
          referredCompany: input.referredCompany,
          projectInterest: input.projectInterest,
          message: input.message,
          referrerConsentAt: new Date(),
          idempotencyKey: input.idempotencyKey,
        },
        select: { id: true },
      });
      introductionId = row.id;
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") return { ok: true, referrerEmailed: false };
      throw err;
    }

    const company = await getCompanyProfile();
    const e = env();
    const team = dispatch({
      kind: "INTRO_TEAM",
      entity: { introductionId },
      to: e.NOTIFY_TEAM_EMAIL ?? company.contactEmail,
      message: introTeamEmail({
        company: company.name,
        referrerName: input.referrerName,
        referrerEmail: input.referrerEmail,
        referredName: input.referredName,
        referredEmail: input.referredEmail,
        referredCompany: input.referredCompany,
        interest: PROJECT_INTERESTS.find((p) => p[0] === input.projectInterest)?.[1] ?? input.projectInterest,
        message: input.message,
        campaignName: campaign?.name,
      }),
    });
    // The referrer is copied only when explicitly enabled. The referred person is never emailed automatically.
    const referrer =
      e.NOTIFY_REFERRER === "true"
        ? dispatch({
            kind: "INTRO_REFERRER",
            entity: { introductionId },
            to: input.referrerEmail,
            message: introReferrerEmail({
              company: company.name,
              referrerName: input.referrerName,
              referredName: input.referredName,
            }),
          })
        : Promise.resolve("SKIPPED" as const);

    const [, referrerResult] = await Promise.all([team, referrer]);
    return { ok: true, referrerEmailed: referrerResult === "SENT" };
  } catch {
    console.error("[introduction] submission failed");
    return UNAVAILABLE;
  }
}
