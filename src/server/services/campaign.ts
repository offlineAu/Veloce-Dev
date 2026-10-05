import "server-only";
import { db } from "@/server/db";
import { isWellFormedToken } from "@/lib/token";
import { offerState, type OfferState } from "@/lib/offer";

/** What the browser may see about a campaign. No internal ids, no referrer email. */
export interface PublicCampaign {
  token: string;
  /** True if the campaign is tied to a referrer, even when the name is not shown. */
  hasReferrer: boolean;
  referrerName: string | null;
  referrerRole: string | null;
  referrerCompany: string | null;
  personalMessage: string | null;
  offer: {
    state: OfferState;
    title: string | null;
    description: string | null;
    expiresAt: string | null;
  };
}

export interface CampaignRecord {
  id: string;
  referrerEmail: string | null;
}

/**
 * Resolve a public token to a campaign. Malformed, unknown and inactive tokens all return null,
 * so a caller cannot distinguish them.
 */
export async function findCampaign(token: unknown) {
  if (!isWellFormedToken(token)) return null;
  const c = await db.referralCampaign.findUnique({ where: { publicToken: token } });
  return c && c.active ? c : null;
}

/**
 * `audience: "referrer"` is the referrer's own page, so their details are always shown.
 * For prospects, referrer details are revealed only if the campaign allows it.
 */
export async function getPublicCampaign(
  token: unknown,
  opts: { now?: Date; audience?: "prospect" | "referrer" } = {},
): Promise<PublicCampaign | null> {
  const c = await findCampaign(token);
  if (!c) return null;
  const showName = opts.audience === "referrer" || c.showReferrerName;
  const now = opts.now ?? new Date();
  return {
    token: c.publicToken,
    hasReferrer: !!c.referrerName,
    referrerName: showName ? c.referrerName : null,
    referrerRole: showName ? c.referrerRole : null,
    referrerCompany: showName ? c.referrerCompany : null,
    personalMessage: showName ? c.personalMessage : null,
    offer: {
      state: offerState(c, now),
      title: c.offerTitle,
      description: c.offerDescription,
      expiresAt: c.offerExpiresAt?.toISOString() ?? null,
    },
  };
}
