import 'server-only';
import { env } from '@/config/env';
import type { MeetingConfig } from '@/lib/meeting';
import { calEndpoints } from '@/lib/cal-endpoints';

export function bookingSettings() {
  const e = env();
  const url = e.CAL_BOOKING_URL ? new URL(e.CAL_BOOKING_URL) : undefined;
  const endpoints = calEndpoints(e.CAL_LOCAL_MODE === 'true', e.CAL_BOOKING_URL, e.CAL_API_BASE_URL);
  const configured = Boolean(url && e.CAL_EVENT_TYPE_ID && e.CAL_HOST_ID && e.CAL_API_KEY && e.CAL_WEBHOOK_SECRET);
  const enabled = e.BOOKING_ENABLED === 'true';
  const eventTypeId = Number(e.CAL_EVENT_TYPE_ID);
  const hostId = Number(e.CAL_HOST_ID);
  const duration = Number(e.BOOKING_DURATION_MINUTES);
  if (url && (!/^\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/.test(url.pathname) || url.search || url.hash || url.username || url.password)) {
    throw new Error('CAL_BOOKING_URL must be a single-host https://cal.com/username/event link');
  }
  if (enabled && (!configured || !Number.isSafeInteger(eventTypeId) || eventTypeId < 1 || !Number.isSafeInteger(hostId) || hostId < 1 || !Number.isSafeInteger(duration) || duration < 1 || !e.BOOKING_FORMAT || !e.BOOKING_COST_LABEL || !e.BOOKING_CRON_SECRET || e.BOOKING_CRON_SECRET.length < 32)) {
    throw new Error('Enabled booking requires valid Cal event/host, credentials, duration, format, cost terms and a 32-character cron secret');
  }
  return { enabled, configured, url, eventTypeId, hostId, duration, apiKey: e.CAL_API_KEY, webhookSecret: e.CAL_WEBHOOK_SECRET, format: e.BOOKING_FORMAT, costLabel: e.BOOKING_COST_LABEL, ...endpoints };
}
export function publicMeetingConfig(): MeetingConfig {
  const c = bookingSettings();
  return c.enabled ? { enabled: true, duration: c.duration, format: c.format, costLabel: c.costLabel } : { enabled: false };
}
