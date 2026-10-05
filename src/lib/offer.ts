export type OfferState = "none" | "upcoming" | "active" | "expired";

export interface OfferWindow {
  offerTitle?: string | null;
  offerDescription?: string | null;
  offerStartsAt?: Date | null;
  offerExpiresAt?: Date | null;
}

/** Whether a campaign offer is shown. An offer exists only if it has a title or description. */
export function offerState(c: OfferWindow, now: Date = new Date()): OfferState {
  if (!c.offerTitle?.trim() && !c.offerDescription?.trim()) return "none";
  if (c.offerStartsAt && now < c.offerStartsAt) return "upcoming";
  if (c.offerExpiresAt && now >= c.offerExpiresAt) return "expired";
  return "active";
}

export function formatOfferDate(iso: string, timeZone: string, locale = "en"): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone }).format(new Date(iso));
}
