"use client";
import posthog from "posthog-js/dist/module.no-external";
import { browserEvents, browserPropertiesSchema, normalizedPage } from "./shared";
import type { CaptureResult } from "posthog-js";

/** Keep SDK-generated device details, URLs, titles and person properties out of ingestion. */
export function sanitizeSdkEvent(event: CaptureResult | null, allowed: boolean): CaptureResult | null {
  if (!event || !allowed || ![...browserEvents, "$pageview", "$pageleave"].includes(event.event as typeof browserEvents[number])) return null;
  const parsed = browserPropertiesSchema.safeParse(event.properties);
  if (!parsed.success || !normalizedPage(parsed.data.page)) return null;
  const { page, ...properties } = parsed.data;
  return { uuid: event.uuid, event: event.event, timestamp: event.timestamp, properties: { ...properties, page, distinct_id: event.properties.distinct_id, ...(typeof event.properties.token === "string" ? { token: event.properties.token } : {}), ...(typeof event.properties.$cookieless_mode === "boolean" ? { $cookieless_mode: event.properties.$cookieless_mode } : {}) } };
}
export function initializeSdk(key: string, allowed: () => boolean) {
  posthog.init(key, {
    api_host: "/api/analytics",
    // Avoid a trailing-slash redirect during page-leave beacon delivery.
    rewriteRequestPath: url => { url.pathname = url.pathname.replace(/\/$/, ""); return url; },
    defaults: "2026-05-30",
    persistence: "memory", disable_persistence: true,
    autocapture: false, capture_pageview: false, capture_pageleave: false,
    capture_dead_clicks: false, rageclick: false, capture_exceptions: false,
    disable_session_recording: true, disable_surveys: true, enable_heatmaps: false,
    disable_external_dependency_loading: true, advanced_disable_flags: true,
    advanced_disable_feature_flags: true, person_profiles: "identified_only",
    request_batching: false, disable_compression: true,
    before_send: event => sanitizeSdkEvent(event, allowed()),
  });
  return posthog;
}
