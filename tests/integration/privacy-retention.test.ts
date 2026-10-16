import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { CLOSED_RECORD_RETENTION_MS } from "@/lib/privacy-retention";

const isolated = vi.hoisted(() => ({ db: undefined as PrismaClient | undefined }));
vi.mock("@/server/db", () => ({ get db() { return isolated.db; } }));

// Cleanup tests use a dedicated schema; no customer records in the development schema are swept.
const probe = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 2000 });
const reachable = await probe.connect().then(() => probe.end().then(() => true), () => false);
const suite = reachable ? describe : describe.skip;
suite("closed-record privacy cleanup", () => {
  const schema = `privacy_test_${crypto.randomUUID().replaceAll("-", "")}`;
  const connection = new Client({ connectionString: process.env.DATABASE_URL });
  const now = new Date("2026-10-15T12:00:00Z");
  const cutoff = new Date(now.getTime() - CLOSED_RECORD_RETENTION_MS);
  let companyId: string;
  let retention: typeof import("@/server/privacy/retention");
  const db = () => isolated.db!;
  const inquiry = (extra: object = {}) => db().lead.create({ data: {
    companyId, name: "Retention fixture", email: "retention@example.com", projectType: "OTHER",
    projectGoals: "Fixture", idempotencyKey: crypto.randomUUID(), consentAt: now,
    status: "NOT_PROCEEDING", closedAt: cutoff, ...extra,
  } });
  const referral = (extra: object = {}) => db().referralIntroduction.create({ data: {
    referrerName: "Referrer", referrerEmail: "referrer@example.com", referredName: "Visitor", referredEmail: "visitor@example.com",
    projectInterest: "UNSURE", referrerConsentAt: now, idempotencyKey: crypto.randomUUID(), status: "DECLINED", closedAt: cutoff, ...extra,
  } });
  beforeAll(async () => {
    await connection.connect();
    await connection.query(`CREATE SCHEMA "${schema}"`);
    await connection.query(`SET search_path TO "${schema}"`);
    for (const directory of readdirSync("prisma/migrations").filter(name => /^\d/.test(name)).sort()) {
      await connection.query(readFileSync(`prisma/migrations/${directory}/migration.sql`, "utf8"));
    }
    isolated.db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }, { schema }) });
    retention = await import("@/server/privacy/retention");
  });
  beforeEach(async () => {
    await connection.query(`TRUNCATE "${schema}"."Company", "${schema}"."ReferralIntroduction", "${schema}"."BookingSession" CASCADE`);
    companyId = (await db().company.create({ data: { name: "Retention fixture", description: "Fixture", contactEmail: "fixture@example.com" } })).id;
  });
  afterAll(async () => {
    await isolated.db?.$disconnect();
    await connection.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await connection.end();
  });
  it("defaults to a preview, then deletes at the exact 30-day boundary with related data", async () => {
    const lead = await inquiry();
    const intro = await referral();
    await db().siteDraft.create({ data: { leadId: lead.id, token: crypto.randomUUID(), data: { pages: [] } } });
    await db().leadAttribution.create({ data: { leadId: lead.id, landingPath: "/" } });
    await db().notificationLog.create({ data: { leadId: lead.id, kind: "LEAD_TEAM", recipientHash: "fixture", dedupeKey: crypto.randomUUID(), status: "SENT" } });
    await db().notificationLog.create({ data: { introductionId: intro.id, kind: "INTRO_TEAM", recipientHash: "fixture", dedupeKey: crypto.randomUUID(), status: "SENT" } });
    expect(await retention.cleanupClosedRecords({ now })).toMatchObject({ dryRun: true, inquiriesEligible: 1, referralsEligible: 1, inquiriesDeleted: 0 });
    expect(await db().siteDraft.count()).toBe(1);
    expect(await retention.cleanupClosedRecords({ now, dryRun: false })).toMatchObject({ inquiriesDeleted: 1, referralsDeleted: 1, hasMore: false });
    expect(await db().siteDraft.count()).toBe(0);
    expect(await db().leadAttribution.count()).toBe(0);
    expect(await db().notificationLog.count()).toBe(0);
    expect(await retention.cleanupClosedRecords({ now, dryRun: false })).toMatchObject({ inquiriesDeleted: 0, referralsDeleted: 0 });
  });
  it("preserves analytics mappings until external erasure is confirmed", async () => {
    const visitor = await db().analyticsVisitor.create({ data: {
      noticeVersion: "fixture", expiresAt: new Date(now.getTime() + 86400_000),
    } });
    const lead = await inquiry({ analyticsVisitorId: visitor.id, analyticsLinkedAt: now });
    const first = await retention.cleanupClosedRecords({ now, dryRun: false });
    expect(first).toMatchObject({ inquiriesDeleted: 0, hasMore: true });
    expect(await db().lead.findUnique({ where: { id: lead.id } })).not.toBeNull();
    const pending = await db().analyticsVisitor.findUniqueOrThrow({ where: { id: visitor.id } });
    expect(pending.deletionRequestedAt).not.toBeNull(); expect(pending.revokedAt).not.toBeNull();
    await db().analyticsVisitor.update({ where: { id: visitor.id }, data: { deletionConfirmedAt: now } });
    expect(await retention.cleanupClosedRecords({ now, dryRun: false })).toMatchObject({ inquiriesDeleted: 1, hasMore: false });
    expect(await db().analyticsVisitor.findUnique({ where: { id: visitor.id } })).not.toBeNull();
  });
  it("protects active, converted, held, undated and not-yet-expired records", async () => {
    await inquiry({ status: "CONTACTED" });
    await inquiry({ status: "CONVERTED" });
    await inquiry({ retentionHold: true });
    await inquiry({ closedAt: null, createdAt: new Date("2020-01-01") });
    await inquiry({ closedAt: new Date(cutoff.getTime() + 1) });
    await referral({ status: "CONTACTED" });
    await referral({ retentionHold: true });
    await referral({ closedAt: null });
    await referral({ closedAt: new Date(cutoff.getTime() + 1) });
    expect(await retention.cleanupClosedRecords({ now, dryRun: false })).toMatchObject({ inquiriesDeleted: 0, referralsDeleted: 0 });
    expect(await db().lead.count()).toBe(5);
    expect(await db().referralIntroduction.count()).toBe(4);
  });
  it("protects records with bookings and active email delivery leases", async () => {
    const booked = await inquiry();
    const session = await db().bookingSession.create({ data: { referenceHash: crypto.randomUUID(), accessHash: "fixture", companyId, eventTypeId: 1, hostId: 1, entryPoint: "contact", consentAt: now, expiresAt: now } });
    await db().appointment.create({ data: { sessionId: session.id, leadId: booked.id, providerBookingId: crypto.randomUUID(), eventTypeId: 1, hostId: 1, startAt: cutoff, endAt: cutoff, timezone: "Asia/Manila", status: "CANCELLED", providerUpdatedAt: now } });
    const leased = await inquiry();
    await db().notificationLog.create({ data: { leadId: leased.id, kind: "LEAD_TEAM", recipientHash: "fixture", dedupeKey: crypto.randomUUID(), leaseUntil: new Date(now.getTime() + 60_000) } });
    expect(await retention.cleanupClosedRecords({ now, dryRun: false })).toMatchObject({ inquiriesDeleted: 0 });
  });
  it("records explicit closure, preserves its date, supports reopening and respects holds", async () => {
    const lead = await inquiry({ status: "CONTACTED", closedAt: null });
    expect(await retention.updatePrivacyRecord("inquiry", lead.id, "close", cutoff)).toMatchObject({ count: 1 });
    expect(await retention.updatePrivacyRecord("inquiry", lead.id, "close", now)).toMatchObject({ count: 0 });
    expect((await db().lead.findUniqueOrThrow({ where: { id: lead.id } })).closedAt).toEqual(cutoff);
    await retention.updatePrivacyRecord("inquiry", lead.id, "hold", now);
    expect(await retention.cleanupClosedRecords({ now, dryRun: false })).toMatchObject({ inquiriesDeleted: 0 });
    await retention.updatePrivacyRecord("inquiry", lead.id, "reopen", now);
    await retention.updatePrivacyRecord("inquiry", lead.id, "release", now);
    expect(await db().lead.findUniqueOrThrow({ where: { id: lead.id } })).toMatchObject({ status: "NEW", closedAt: null, retentionHold: false });
    expect(await retention.cleanupClosedRecords({ now, dryRun: false })).toMatchObject({ inquiriesDeleted: 0 });
    const converted = await inquiry({ status: "CONVERTED", closedAt: null });
    expect(await retention.updatePrivacyRecord("inquiry", converted.id, "close", now)).toMatchObject({ count: 0 });
    const intro = await referral({ status: "CONTACTED", closedAt: null });
    await retention.updatePrivacyRecord("referral", intro.id, "close", cutoff);
    await retention.updatePrivacyRecord("referral", intro.id, "hold", now);
    expect(await retention.cleanupClosedRecords({ now, dryRun: false })).toMatchObject({ referralsDeleted: 0 });
    await retention.updatePrivacyRecord("referral", intro.id, "release", now);
    expect(await retention.cleanupClosedRecords({ now, dryRun: false })).toMatchObject({ referralsDeleted: 1 });
  });
  it("bounds each deletion run and reports a remaining backlog", async () => {
    await db().lead.createMany({ data: Array.from({ length: 251 }, () => ({
      companyId, name: "Batch fixture", email: "batch@example.com", projectType: "OTHER" as const, projectGoals: "Fixture",
      idempotencyKey: crypto.randomUUID(), consentAt: now, status: "NOT_PROCEEDING" as const, closedAt: cutoff,
    })) });
    expect(await retention.cleanupClosedRecords({ now, dryRun: false })).toMatchObject({ inquiriesDeleted: 250, hasMore: true });
    expect(await retention.cleanupClosedRecords({ now, dryRun: false })).toMatchObject({ inquiriesDeleted: 1, hasMore: false });
  });
});
