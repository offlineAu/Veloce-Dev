import { z } from "zod";

export const ANALYTICS_COOKIE = "veloce_analytics";
export const ANALYTICS_CHOICE_KEY = "veloce.analytics.choice.v1";
export const ANALYTICS_ATTRIBUTION_KEY = "veloce.analytics.attribution.v1";
export const ANALYTICS_SESSION_KEY = "veloce.analytics.session.v1";
export const ANALYTICS_MAX_AGE = 365 * 24 * 60 * 60;
export const browserEvents = ["page_viewed", "cta_clicked", "form_opened", "form_started"] as const;
export type BrowserEvent = typeof browserEvents[number];
export type ConversionEvent = "inquiry_submitted" | "introduction_submitted" | "booking_started" | "booking_confirmed";

// Campaign labels must be deliberate, non-personal slugs. Arbitrary query values never leave the app.
export const campaignLabel = (value: string | null | undefined) => value && /^[a-z0-9][a-z0-9_-]{0,79}$/i.test(value) ? value : undefined;
export function normalizedPage(path: string): string | undefined {
  if (["/", "/about", "/privacy", "/terms", "/build"].includes(path)) return path;
  if (/^\/services\/[a-z0-9-]{1,60}$/.test(path)) return path;
  if (/^\/refer\/[^/]+$/.test(path)) return "/refer/[token]";
  return undefined;
}
const label = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/i).optional();
export const attributionSchema = z.object({
  landingPage: z.string().max(100).refine(p => normalizedPage(p) === p || p === "/refer/[token]"),
  source: label, medium: label, campaign: label,
  // Coarse source categories only; referrer URLs and domains are not collected.
  referrer: z.enum(["direct", "search", "social", "external"]).optional(),
});
export type Attribution = z.infer<typeof attributionSchema>;
export const analyticsContextSchema = z.object({
  link: z.boolean().default(false),
  first: attributionSchema.optional(),
  latest: attributionSchema.optional(),
  sessionId: z.uuid().optional(),
}).optional().catch(undefined);
export type AnalyticsContext = z.infer<typeof analyticsContextSchema>;
export const browserPropertiesSchema = z.object({
  page: z.string().max(100).refine(p => normalizedPage(p) === p || p === "/refer/[token]"),
  form: z.enum(["inquiry", "introduction", "meeting_request", "booking"]).optional(),
  placement: z.enum(["inquiry", "consultation", "meeting", "service", "builder", "footer"]).optional(),
  service: z.string().regex(/^[a-z0-9-]{1,60}$/).optional(),
  device: z.enum(["mobile", "tablet", "desktop"]).optional(),
  sessionId: z.uuid().optional(),
  first: attributionSchema.optional(), latest: attributionSchema.optional(),
});
export type BrowserProperties = z.infer<typeof browserPropertiesSchema>;
export function attributionProperties(context?: Pick<NonNullable<AnalyticsContext>, "first" | "latest" | "sessionId">) {
  const properties: Record<string, string> = {};
  if (context?.sessionId) properties.$session_id = context.sessionId;
  for (const key of ["first", "latest"] as const) {
    const touch = context?.[key];
    if (!touch) continue;
    for (const [field, value] of Object.entries(touch)) if (value) properties[`${key}_${field}`] = value;
  }
  return properties;
}
