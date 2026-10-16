import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { PRIVACY_NOTICE_VERSION } from "@/lib/legal";

const state = vi.hoisted(() => ({ db: undefined as PrismaClient | undefined, cookie: "", tasks: [] as (() => Promise<unknown>)[] }));
vi.mock("@/server/db", () => ({ get db() { return state.db; } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: state.cookie }) }) }));
vi.mock("next/server", () => ({ after: (task: () => Promise<unknown>) => { state.tasks.push(task); } }));
vi.mock("@/server/security/dev-session", () => ({ readDevSession: async () => null }));
vi.mock("@/server/analytics/config", () => ({ analyticsConfig: () => ({ enabled: true, key: "test-project-key", host: "https://eu.i.posthog.com" }) }));
vi.mock("@/server/notifications/dispatch", () => ({ dispatch: async () => "SENT" }));
vi.mock("@/server/booking/config", () => ({ bookingSettings: () => ({ enabled: true, configured: true, eventTypeId: 42, hostId: 7, url: new URL("https://cal.com/veloce/intro"), apiKey: "fake" }) }));

const probe = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 2000 });
const reachable = await probe.connect().then(() => probe.end().then(() => true), () => false);
const suite = reachable ? describe : describe.skip;
suite("analytics with real persisted submissions and bookings", () => {
  const schema = `analytics_test_${crypto.randomUUID().replaceAll("-", "")}`;
  const connection = new Client({ connectionString: process.env.DATABASE_URL });
  let inquiry: typeof import("@/server/services/lead");
  let sessions: typeof import("@/server/booking/sessions");
  let appointments: typeof import("@/server/booking/appointments");
  let visitorId: string;
  const db = () => state.db!;
  const validInput = () => ({ name: "Test Visitor", email: "analytics-fixture@example.com", projectType: "OTHER", projectGoals: "An example site", privacyConsent: true, privacyNoticeVersion: PRIVACY_NOTICE_VERSION, idempotencyKey: crypto.randomUUID(), startedAt: Date.now() - 5000, analytics: { link: true, first: { landingPage: "/", source: "newsletter" }, latest: { landingPage: "/", source: "newsletter" } } });
  async function flush() { for (const task of state.tasks.splice(0)) await task(); }
  const payloads = () => vi.mocked(fetch).mock.calls.map(([, options]) => JSON.parse(options!.body as string));
  beforeAll(async () => {
    await connection.connect();
    await connection.query(`CREATE SCHEMA "${schema}"`);
    await connection.query(`SET search_path TO "${schema}"`);
    for (const directory of readdirSync("prisma/migrations").filter(name => /^\d/.test(name)).sort()) await connection.query(readFileSync(`prisma/migrations/${directory}/migration.sql`, "utf8"));
    state.db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }, { schema }) });
    inquiry = await import("@/server/services/lead");
    sessions = await import("@/server/booking/sessions");
    appointments = await import("@/server/booking/appointments");
  });
  beforeEach(async () => {
    state.tasks.length = 0;
    await connection.query(`TRUNCATE "${schema}"."Company", "${schema}"."ReferralIntroduction", "${schema}"."BookingSession", "${schema}"."AnalyticsVisitor", "${schema}"."RateLimit" CASCADE`);
    const visitor = await db().analyticsVisitor.create({ data: { noticeVersion: PRIVACY_NOTICE_VERSION, expiresAt: new Date(Date.now() + 86400_000) } });
    visitorId = visitor.id;
    state.cookie = (await import("@/server/analytics/consent")).signVisitor(visitor.id);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
  });
  afterAll(async () => {
    vi.unstubAllGlobals();
    await state.db?.$disconnect();
    await connection.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await connection.end();
  });
  it("captures only persisted non-bot inquiries and does not repeat on idempotent retry", async () => {
    const bot = { ...validInput(), contactFax: "spam" };
    expect(await inquiry.submitInquiry(bot, { clientKey: "fixture" })).toEqual({ ok: true });
    expect(await db().lead.count()).toBe(0); expect(state.tasks).toHaveLength(0);
    const input = validInput();
    expect(await inquiry.submitInquiry(input, { clientKey: "fixture" })).toEqual({ ok: true });
    expect(await inquiry.submitInquiry(input, { clientKey: "fixture" })).toEqual({ ok: true });
    expect(state.tasks).toHaveLength(1);
    const lead = await db().lead.findUniqueOrThrow({ where: { idempotencyKey: input.idempotencyKey } });
    expect(lead.analyticsVisitorId).toBe(visitorId); expect(lead.analyticsLinkedAt).not.toBeNull();
    await flush();
    expect(payloads().map(p => p.event)).toEqual(["$identify", "inquiry_submitted"]);
    expect(JSON.stringify(payloads())).not.toMatch(/analytics-fixture@example|Test Visitor|An example site/);
  });
  it("saves requests with malformed optional context without tracking", async () => {
    expect(await inquiry.submitInquiry({ ...validInput(), analytics: { link: "bad" } }, { clientKey: "fixture" })).toEqual({ ok: true });
    expect((await db().lead.findFirstOrThrow()).analyticsVisitorId).toBeNull();
    expect(state.tasks).toHaveLength(0);
  });
  it("verified bookings share one conversion ID across repeated syncs and reschedules", async () => {
    const session = await sessions.startMeetingSession({ entryPoint: "contact", privacyConsent: true, privacyNoticeVersion: PRIVACY_NOTICE_VERSION, analytics: { link: true } }, "fixture");
    const booking = {
      uid: "analytics_booking", eventTypeId: 42, hosts: [{ id: 7 }], status: "accepted" as const,
      start: new Date(Date.now() + 86400_000).toISOString(), end: new Date(Date.now() + 88200_000).toISOString(),
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      attendees: [{ name: "Test Visitor", email: "booking@example.com", timeZone: "Asia/Manila" }], metadata: { veloceSession: session.reference },
    };
    await Promise.all([appointments.syncAppointment(booking), appointments.syncAppointment(booking)]);
    await appointments.syncAppointment({ ...booking, uid: "analytics_replacement", rescheduledFromUid: booking.uid });
    expect(await db().lead.count()).toBe(1);
    const lead = await db().lead.findFirstOrThrow();
    expect(lead.analyticsVisitorId).toBe(visitorId); expect(lead.analyticsBookingConfirmedAt).not.toBeNull();
    await flush();
    const confirmed = payloads().filter(p => p.event === "booking_confirmed");
    expect(confirmed).toHaveLength(3); // PostHog deduplicates the stable event UUID.
    expect(new Set(confirmed.map(p => p.uuid)).size).toBe(1);
    expect(new Set(confirmed.map(p => p.timestamp)).size).toBe(1);
    expect(payloads().filter(p => p.event === "booking_started")).toHaveLength(1);
  });
  it("withdrawal after scheduler creation suppresses delayed booking conversions", async () => {
    await sessions.startMeetingSession({ entryPoint: "contact", privacyConsent: true, privacyNoticeVersion: PRIVACY_NOTICE_VERSION, analytics: { link: true } }, "fixture");
    await db().analyticsVisitor.update({ where: { id: visitorId }, data: { revokedAt: new Date() } });
    await flush(); expect(fetch).not.toHaveBeenCalled();
  });
});
