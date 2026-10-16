import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyticsContext, clearTrackingStorage, rememberAttribution, setAnalyticsActive, storeChoice, submissionAttribution, track } from "@/lib/analytics/client";
import { ANALYTICS_ATTRIBUTION_KEY, ANALYTICS_SESSION_KEY } from "@/lib/analytics/shared";
const memory = () => {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key), clear: () => data.clear() };
};
const location = { pathname: "/", search: "?utm_source=newsletter&utm_campaign=launch", hostname: "veloce.example" };
beforeEach(() => {
  setAnalyticsActive(false);
  vi.stubGlobal("localStorage", memory()); vi.stubGlobal("sessionStorage", memory());
  vi.stubGlobal("location", location); vi.stubGlobal("document", { referrer: "https://google.com/search?private=secret" });
  vi.stubGlobal("innerWidth", 1440); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  location.pathname = "/"; location.search = "?utm_source=newsletter&utm_campaign=launch";
});
afterEach(() => { setAnalyticsActive(false); vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("browser analytics privacy and attribution", () => {
  it("does not persist attribution, assign sessions or contact the collector before consent", () => {
    rememberAttribution(); track("page_viewed");
    expect(analyticsContext(true)).toBeUndefined(); expect(fetch).not.toHaveBeenCalled();
    expect(localStorage.getItem(ANALYTICS_ATTRIBUTION_KEY)).toBeNull();
    expect(sessionStorage.getItem(ANALYTICS_SESSION_KEY)).toBeNull();
  });
  it("preserves first touch across navigation and updates latest campaign only", () => {
    storeChoice("allow"); setAnalyticsActive(true); rememberAttribution();
    location.pathname = "/about"; location.search = ""; rememberAttribution();
    expect(submissionAttribution()).toMatchObject({ landingPath: "/", utmSource: "newsletter", utmCampaign: "launch" });
    location.search = "?utm_source=linkedin&utm_campaign=october"; rememberAttribution();
    expect(analyticsContext()).toMatchObject({ first: { source: "newsletter" }, latest: { source: "linkedin" } });
  });
  it("rotates sessions after inactivity and clears tracking storage on withdrawal", () => {
    vi.useFakeTimers(); setAnalyticsActive(true);
    const first = analyticsContext()!.sessionId;
    vi.advanceTimersByTime(29 * 60_000); expect(analyticsContext()!.sessionId).toBe(first);
    vi.advanceTimersByTime(31 * 60_000); expect(analyticsContext()!.sessionId).not.toBe(first);
    rememberAttribution(); clearTrackingStorage(); setAnalyticsActive(false);
    expect(analyticsContext()).toBeUndefined();
    expect(localStorage.getItem(ANALYTICS_ATTRIBUTION_KEY)).toBeNull(); expect(sessionStorage.getItem(ANALYTICS_SESSION_KEY)).toBeNull();
  });
  it("excludes private routes even if a form tries to submit context", () => {
    setAnalyticsActive(true); location.pathname = "/build/preview/private-token";
    track("page_viewed"); rememberAttribution();
    expect(fetch).not.toHaveBeenCalled(); expect(analyticsContext(true)).toBeUndefined();
  });
});
