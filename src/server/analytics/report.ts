import "server-only";
import { z } from "@/lib/security/schema";
import { db } from "@/server/db";
import { requireOwner } from "@/server/admin/session";

export const reportDays = (value: unknown): 7 | 30 | 90 => value === "7" ? 7 : value === "90" ? 90 : 30;
export function reportWindow(days: 7 | 30 | 90, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  const start = new Date(`${part("year")}-${part("month")}-${part("day")}T00:00:00+08:00`);
  start.setUTCDate(start.getUTCDate() - days + 1);
  return { start, end: now };
}
// The equally long window just before the report window, for period-over-period comparison.
export const previousWindow = ({ start, end }: { start: Date; end: Date }) => ({ start: new Date(2 * start.getTime() - end.getTime()), end: start });
const resultSchema = z.object({ results: z.array(z.array(z.union([z.string(), z.number(), z.null()]))) });
type Rows = z.infer<typeof resultSchema>["results"];
type TrafficTotals = { visitors: number; views: number; sessions: number };
export type TrafficReport = { totals: TrafficTotals; previous: TrafficTotals; trend: { day: string; views: number; visitors: number }[]; pages: { name: string; views: number }[]; sources: { name: string; views: number }[]; devices: { name: string; views: number }[]; updatedAt: string };
type BusinessTotals = { inquiries: number; introductions: number; confirmedBookings: number };
export type BusinessReport = BusinessTotals & { previous: BusinessTotals };
// Cache only aggregate data in server memory, with a bounded set of three report windows.
const cache = new Map<number, { expires: number; project: string; pending: Promise<TrafficReport> }>();
export function queryConfig() {
  const id = process.env.POSTHOG_PROJECT_ID;
  const key = process.env.POSTHOG_PERSONAL_API_KEY;
  if (!id || !/^\d+$/.test(id) || !key) return null;
  return { id, key, host: process.env.POSTHOG_REGION === "us" ? "https://us.posthog.com" : "https://eu.posthog.com" };
}
export async function queryPostHog(query: string): Promise<Rows> {
  const config = queryConfig();
  if (!config) throw new Error("Analytics reporting is not configured");
  const response = await fetch(`${config.host}/api/projects/${config.id}/query/`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.key}` },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query }, name: "veloce_owner_analytics" }),
    signal: AbortSignal.timeout(12_000), cache: "no-store", redirect: "error",
  });
  if (!response.ok) throw new Error("Analytics report unavailable");
  return resultSchema.parse(await response.json()).results;
}
export function trafficQueries(start: Date, end: Date, previousStart = previousWindow({ start, end }).start) {
  // Only server-generated dates enter these fixed queries. No user-supplied SQL or filters.
  const events = `event IN ('$pageview', 'page_viewed')`;
  const current = `timestamp >= parseDateTimeBestEffort('${start.toISOString()}')`;
  const where = `${events} AND ${current} AND timestamp < parseDateTimeBestEffort('${end.toISOString()}')`;
  const session = `toString(properties.$session_id)`;
  const page = `coalesce(nullIf(toString(properties.$pathname), ''), nullIf(toString(properties.page), ''), '/')`;
  const source = `coalesce(nullIf(toString(properties.latest_source), ''), nullIf(toString(properties.latest_referrer), ''), 'direct')`;
  const device = `coalesce(nullIf(toString(properties.$device_type), ''), nullIf(toString(properties.device), ''), 'unknown')`;
  return {
    // Current window first, then the previous window, in one scan.
    totals: `SELECT uniqIf(person_id, ${current}), countIf(${current}), uniqIf(${session}, ${current} AND notEmpty(${session})),
      uniqIf(person_id, NOT ${current}), countIf(NOT ${current}), uniqIf(${session}, NOT ${current} AND notEmpty(${session}))
      FROM events WHERE ${events} AND timestamp >= parseDateTimeBestEffort('${previousStart.toISOString()}') AND timestamp < parseDateTimeBestEffort('${end.toISOString()}')`,
    trend: `SELECT toString(toDate(toTimeZone(timestamp, 'Asia/Manila'))), count(), uniq(person_id) FROM events WHERE ${where} GROUP BY 1 ORDER BY 1 LIMIT 90`,
    breakdowns: `SELECT 'page', ${page}, count() FROM events WHERE ${where} GROUP BY 2 ORDER BY 3 DESC LIMIT 10
      UNION ALL SELECT 'source', ${source}, count() FROM events WHERE ${where} GROUP BY 2 ORDER BY 3 DESC LIMIT 10
      UNION ALL SELECT 'device', ${device}, count() FROM events WHERE ${where} GROUP BY 2 ORDER BY 3 DESC LIMIT 10`,
  };
}
const count = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : 0;
export async function getTrafficReport(days: 7 | 30 | 90): Promise<TrafficReport> {
  await requireOwner(); // Check authentication even for cached results.
  const config = queryConfig();
  if (!config) throw new Error("Analytics reporting is not configured");
  const project = `${config.host}:${config.id}:${config.key}`;
  const saved = cache.get(days);
  if (saved && saved.project === project && saved.expires > Date.now()) return saved.pending;
  const pending = (async () => {
    const { start, end } = reportWindow(days);
    const queries = trafficQueries(start, end);
    const [totals, trend, breakdowns] = await Promise.all([queryPostHog(queries.totals), queryPostHog(queries.trend), queryPostHog(queries.breakdowns)]);
    const group = (name: string) => breakdowns.filter(row => row[0] === name).map(row => ({ name: String(row[1] ?? "unknown").slice(0, 120), views: count(row[2]) }));
    const row = totals[0] ?? [];
    return { totals: { visitors: count(row[0]), views: count(row[1]), sessions: count(row[2]) }, previous: { visitors: count(row[3]), views: count(row[4]), sessions: count(row[5]) }, trend: trend.map(row => ({ day: String(row[0]), views: count(row[1]), visitors: count(row[2]) })), pages: group("page"), sources: group("source"), devices: group("device"), updatedAt: end.toISOString() };
  })();
  cache.set(days, { expires: Date.now() + 60_000, project, pending });
  try { return await pending; } catch { if (cache.get(days)?.pending === pending) cache.delete(days); throw new Error("Analytics report unavailable"); }
}
export async function getBusinessReport(days: 7 | 30 | 90): Promise<BusinessReport> {
  await requireOwner();
  const window = reportWindow(days);
  const [current, previous] = await Promise.all([businessTotals(window), businessTotals(previousWindow(window))]);
  return { ...current, previous };
}
async function businessTotals({ start, end }: { start: Date; end: Date }): Promise<BusinessTotals> {
  const createdAt = { gte: start, lt: end };
  const [inquiries, introductions, bookings] = await Promise.all([
    db.lead.count({ where: { createdAt, NOT: { idempotencyKey: { startsWith: "cal:" } } } }),
    db.referralIntroduction.count({ where: { createdAt } }),
    db.appointment.findMany({ where: { createdAt, status: "CONFIRMED", replacementId: null }, distinct: ["leadId"], select: { leadId: true } }),
  ]);
  return { inquiries, introductions, confirmedBookings: bookings.length };
}
