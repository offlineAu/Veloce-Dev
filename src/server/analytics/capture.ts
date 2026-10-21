import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { after } from "next/server";
import { db } from "@/server/db";
import { analyticsContextSchema, attributionProperties, type AnalyticsContext, type ConversionEvent, type BrowserProperties, type BrowserEvent } from "@/lib/analytics/shared";
import { analyticsConfig } from "./config";
import { currentVisitor, isActive } from "./consent";

export function eventUuid(key: string) {
  const hex = createHash("sha256").update(`veloce-analytics:${key}`).digest("hex").slice(0, 32).split("");
  hex[12] = "5"; hex[16] = "8";
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}
export async function deliver(event: string, distinctId: string, properties: Record<string, unknown>, uuid: string = randomUUID(), timestamp = new Date()) {
  const config = analyticsConfig();
  if (!config.enabled) return;
  const response = await fetch(`${config.host}/capture/`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: config.key, event, uuid, timestamp: timestamp.toISOString(), properties: {
      ...properties, distinct_id: distinctId, $geoip_disable: true, $lib: "veloce", 
    } }), signal: AbortSignal.timeout(2500), cache: "no-store",
  });
  if (!response.ok) throw new Error("Analytics delivery failed");
}
export function scheduleAnalytics(task: () => Promise<unknown>) {
  // Do not extend the business response or expose provider errors to visitors.
  try { after(async () => { try { await task(); } catch { console.warn("[analytics] delivery failed"); } }); }
  catch { console.warn("[analytics] post-response scheduling unavailable"); }
}
export async function submissionTracking(raw: unknown) {
  try {
    const context = analyticsContextSchema.parse(raw);
    if (!context) return undefined;
    const visitor = await currentVisitor();
    if (!visitor) return undefined;
    return { visitorId: visitor.id, linkedAt: context.link ? new Date() : null, context };
  } catch { return undefined; }
}
export async function captureBrowser(visitorId: string, event: BrowserEvent, props: BrowserProperties, uuid: string) {
  const visitor = await db.analyticsVisitor.findUnique({ where: { id: visitorId } });
  if (!visitor || !isActive(visitor)) return;
  const { first, latest, sessionId, duration, pageviewId, ...safe } = props;
  const isPageEvent = event === "$pageview" || event === "$pageleave";
  const origin = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").origin;
  const web = isPageEvent ? {
    $current_url: `${origin}${safe.page}`, $host: new URL(origin).host, $pathname: safe.page,
    $device_type: safe.device === "desktop" ? "Desktop" : safe.device === "mobile" ? "Mobile" : safe.device === "tablet" ? "Tablet" : "unknown", $geoip_disable: true,
    ...(pageviewId ? { $pageview_id: pageviewId } : {}),
    ...(event === "$pageleave" && duration !== undefined ? { $prev_pageview_duration: duration, $prev_pageview_id: pageviewId, $prev_pageview_pathname: safe.page } : {}),
    ...(latest?.source ? { utm_source: latest.source } : {}),
    ...(latest?.medium ? { utm_medium: latest.medium } : {}),
    ...(latest?.campaign ? { utm_campaign: latest.campaign } : {}),
  } : {};
  await deliver(event, visitor.identifiedAt ? visitor.reference : visitor.id, {
    ...safe, ...web, ...attributionProperties({ first, latest, sessionId }), $process_person_profile: !!visitor.identifiedAt,
  }, uuid);
}
export const unlinkedReference = (key: string) => eventUuid(`unlinked:${key}`);
export function conversion(input: { event: ConversionEvent; key: string; visitorId?: string | null; linkedAt?: Date | null; context?: AnalyticsContext; campaignId?: string | null; form?: string; service?: string | null; timestamp?: Date }) {
  if (!input.visitorId) return;
  scheduleAnalytics(async () => {
    const visitor = await db.analyticsVisitor.findUnique({ where: { id: input.visitorId! } });
    if (!visitor || !isActive(visitor)) return;
    if (input.linkedAt) {
      await deliver("$identify", visitor.reference, {
        $anon_distinct_id: visitor.id, $set: { lead_reference: visitor.reference }, $process_person_profile: true,
      }, eventUuid(`identify:${visitor.id}`));
      await db.analyticsVisitor.update({ where: { id: visitor.id }, data: { identifiedAt: visitor.identifiedAt ?? new Date() } });
    }
    // Recheck withdrawal immediately before sending delayed booking events.
    const fresh = await db.analyticsVisitor.findUnique({ where: { id: visitor.id } });
    if (!fresh || !isActive(fresh)) return;
    await deliver(input.event, input.linkedAt ? fresh.reference : unlinkedReference(input.key), {
      ...attributionProperties(input.linkedAt ? input.context : { first: input.context?.first, latest: input.context?.latest }),
      journey_linked: !!input.linkedAt,
      ...(input.form ? { form: input.form } : {}),
      ...(input.service ? { service: input.service } : {}),
      ...(input.campaignId ? { campaign_reference: eventUuid(`campaign:${input.campaignId}`) } : {}),
      $process_person_profile: true,
    }, eventUuid(`${input.event}:${input.key}`), input.timestamp);
  });
}
