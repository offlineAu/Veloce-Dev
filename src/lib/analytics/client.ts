"use client";
import { PRIVACY_NOTICE_VERSION } from "@/lib/legal";
import { ANALYTICS_ATTRIBUTION_KEY, ANALYTICS_CHOICE_KEY, ANALYTICS_SESSION_KEY, ANALYTICS_MAX_AGE, attributionSchema, campaignLabel, normalizedPage, type AnalyticsContext, type Attribution, type BrowserEvent, type BrowserProperties } from "./shared";

let active = false;
let sdk: ReturnType<typeof import("./sdk").initializeSdk> | undefined;
let sdkLoading: Promise<void> | undefined;
function newSessionId() {
  // PostHog's web session processing expects UUIDv7, with its creation timestamp encoded.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const timestamp = BigInt(Date.now());
  for (let i = 0; i < 6; i++) bytes[i] = Number((timestamp >> BigInt((5 - i) * 8)) & 255n);
  bytes[6] = (bytes[6]! & 15) | 0x70; bytes[8] = (bytes[8]! & 63) | 0x80;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export async function startAnalyticsSdk(key: string) {
  if (sdk) return;
  if (!sdkLoading) sdkLoading = import("./sdk").then(module => { sdk = module.initializeSdk(key, () => active && !!normalizedPage(location.pathname)); }).finally(() => { sdkLoading = undefined; });
  await sdkLoading;
}
export const setAnalyticsActive = (value: boolean) => { active = value; };
export function readStorage(key: string) { try { return localStorage.getItem(key); } catch { return null; } }
export function storeChoice(value: "allow" | "decline") {
  try { localStorage.setItem(ANALYTICS_CHOICE_KEY, JSON.stringify({ value, version: PRIVACY_NOTICE_VERSION, expiresAt: Date.now() + ANALYTICS_MAX_AGE * 1000 })); } catch { /* memory-only choice */ }
}
export function readChoice(): "allow" | "decline" | undefined {
  try {
    const choice = JSON.parse(readStorage(ANALYTICS_CHOICE_KEY) ?? "null");
    if (choice?.version === PRIVACY_NOTICE_VERSION && choice.expiresAt > Date.now() && ["allow", "decline"].includes(choice.value)) return choice.value;
  } catch { /* unknown choice */ }
}
export async function analyticsRequest(body: object) {
  const response = await fetch("/api/analytics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin", keepalive: true, signal: AbortSignal.timeout(4000) });
  if (!response.ok) throw new Error("Analytics unavailable");
}
export function clearTrackingStorage() {
  try { localStorage.removeItem(ANALYTICS_ATTRIBUTION_KEY); sessionStorage.removeItem(ANALYTICS_SESSION_KEY); } catch { /* unavailable */ }
}
function sessionId() {
  try {
    const previous = JSON.parse(sessionStorage.getItem(ANALYTICS_SESSION_KEY) ?? "null");
    const id = previous?.lastAt > Date.now() - 30 * 60_000 && typeof previous.id === "string" && previous.id[14] === "7" ? previous.id : newSessionId();
    sessionStorage.setItem(ANALYTICS_SESSION_KEY, JSON.stringify({ id, lastAt: Date.now() }));
    return id as string;
  } catch { return undefined; }
}
function referrerCategory(): Attribution["referrer"] {
  try {
    if (!document.referrer) return "direct";
    const host = new URL(document.referrer).hostname;
    if (host === location.hostname) return undefined;
    if (/(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|yahoo\.[a-z.]+)$/.test(host)) return "search";
    if (/(^|\.)(facebook\.com|instagram\.com|linkedin\.com|t\.co|x\.com)$/.test(host)) return "social";
    return "external";
  } catch { return "direct"; }
}
export function rememberAttribution() {
  if (!active) return;
  const page = normalizedPage(location.pathname);
  if (!page) return;
  const params = new URLSearchParams(location.search);
  const touch: Attribution = { landingPage: page, source: campaignLabel(params.get("utm_source")), medium: campaignLabel(params.get("utm_medium")), campaign: campaignLabel(params.get("utm_campaign")), referrer: referrerCategory() };
  try {
    const old = JSON.parse(readStorage(ANALYTICS_ATTRIBUTION_KEY) ?? "null");
    const first = attributionSchema.safeParse(old?.first);
    const latest = attributionSchema.safeParse(old?.latest);
    const campaign = !!(touch.source || touch.medium || touch.campaign);
    // document.referrer is fixed for the document; only use it on its landing page.
    const next = { first: first.success ? first.data : touch, latest: campaign || !latest.success ? touch : latest.data };
    localStorage.setItem(ANALYTICS_ATTRIBUTION_KEY, JSON.stringify(next));
  } catch { /* no persistent attribution when storage is unavailable */ }
}
export function analyticsContext(link = false): AnalyticsContext {
  if (!active || !normalizedPage(location.pathname)) return undefined;
  let first: Attribution | undefined, latest: Attribution | undefined;
  try {
    const saved = JSON.parse(readStorage(ANALYTICS_ATTRIBUTION_KEY) ?? "null");
    first = attributionSchema.safeParse(saved?.first).data;
    latest = attributionSchema.safeParse(saved?.latest).data;
  } catch { /* optional */ }
  return { link, first, latest, sessionId: sessionId() };
}
/** Preserve business attribution behavior without storing anything before analytics consent. */
export function submissionAttribution() {
  const context = analyticsContext();
  const params = new URLSearchParams(location.search);
  return {
    landingPath: context?.first?.landingPage ?? normalizedPage(location.pathname),
    utmSource: context?.latest?.source ?? campaignLabel(params.get("utm_source")),
    utmMedium: context?.latest?.medium ?? campaignLabel(params.get("utm_medium")),
    utmCampaign: context?.latest?.campaign ?? campaignLabel(params.get("utm_campaign")),
  };
}
export function track(event: BrowserEvent, properties: Partial<BrowserProperties> = {}) {
  if (!active) return;
  const currentPage = normalizedPage(location.pathname);
  const page = properties.page ?? currentPage;
  if (!currentPage || !page || !normalizedPage(page)) return;
  const context = analyticsContext();
  const safe = {
    page, device: innerWidth < 640 ? "mobile" : innerWidth < 1024 ? "tablet" : "desktop",
    first: context?.first, latest: context?.latest, sessionId: context?.sessionId, ...properties,
  };
  // Never initialize or queue an SDK event before consent. Old clients may still use the legacy collector.
  if (sdk) sdk.capture(event === "page_viewed" ? "$pageview" : event, safe, event === "$pageleave" ? { transport: "sendBeacon", send_instantly: true } : undefined);
}
