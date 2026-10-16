import { requestAnalyticsDeletion } from "@/server/analytics/deletion";
import "server-only";
import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";
import { CLOSED_RECORD_RETENTION_MS } from "@/lib/privacy-retention";

export type RecordKind = "inquiry" | "referral";
export type RecordAction = "close" | "reopen" | "hold" | "release";
const BATCH_SIZE = 250;

/** No dates are inferred from inactivity: the owner must explicitly close the conversation. */
export async function updatePrivacyRecord(kind: RecordKind, id: string, action: RecordAction, now = new Date()) {
  if (!id || !Number.isFinite(now.getTime())) throw new Error("Invalid record or date");
  if (kind === "inquiry") {
    if (action === "hold" || action === "release") {
      return db.lead.updateMany({ where: { id }, data: { retentionHold: action === "hold" } });
    }
    if (action === "close") {
      return db.lead.updateMany({
        where: { id, status: { not: "CONVERTED" }, closedAt: null, appointments: { none: {} } },
        data: { status: "NOT_PROCEEDING", closedAt: now },
      });
    }
    return db.lead.updateMany({
      where: { id, status: "NOT_PROCEEDING" },
      data: { status: "NEW", closedAt: null },
    });
  }
  if (action === "hold" || action === "release") {
    return db.referralIntroduction.updateMany({ where: { id }, data: { retentionHold: action === "hold" } });
  }
  if (action === "close") {
    return db.referralIntroduction.updateMany({
      where: { id, closedAt: null }, data: { status: "DECLINED", closedAt: now },
    });
  }
  return db.referralIntroduction.updateMany({
    where: { id, status: "DECLINED" }, data: { status: "RECEIVED", closedAt: null },
  });
}

/** Cascades remove the inquiry's design/preview, attribution and notification rows. */
export async function cleanupClosedRecords({ dryRun = true, now = new Date() }: { dryRun?: boolean; now?: Date } = {}) {
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid cleanup date");
  const cutoff = new Date(now.getTime() - CLOSED_RECORD_RETENTION_MS);
  const inquiryWhere: Prisma.LeadWhereInput = {
    status: "NOT_PROCEEDING", closedAt: { lte: cutoff }, retentionHold: false,
    appointments: { none: {} }, notifications: { none: { leaseUntil: { gt: now } } },
  };
  const referralWhere: Prisma.ReferralIntroductionWhereInput = {
    status: "DECLINED", closedAt: { lte: cutoff }, retentionHold: false,
    notifications: { none: { leaseUntil: { gt: now } } },
  };
  // A linked external copy must be erased before database cascades remove its record mapping.
  const externalReady = { OR: [
    { analyticsVisitorId: null },
    { analyticsVisitor: { is: { deletionConfirmedAt: { not: null } } } },
  ] };
  if (!dryRun) {
    const [inquiries, referrals, expiredVisitors] = await Promise.all([
      db.lead.findMany({ where: { ...inquiryWhere, analyticsVisitor: { is: { deletionRequestedAt: null, deletionConfirmedAt: null } } }, take: BATCH_SIZE, select: { analyticsVisitorId: true } }),
      db.referralIntroduction.findMany({ where: { ...referralWhere, analyticsVisitor: { is: { deletionRequestedAt: null, deletionConfirmedAt: null } } }, take: BATCH_SIZE, select: { analyticsVisitorId: true } }),
      db.analyticsVisitor.findMany({ where: { expiresAt: { lte: now }, deletionRequestedAt: null }, take: BATCH_SIZE, select: { id: true } }),
    ]);
    await requestAnalyticsDeletion([...inquiries, ...referrals].flatMap(row => row.analyticsVisitorId ? [row.analyticsVisitorId] : []).concat(expiredVisitors.map(row => row.id)));
  }
  return db.$transaction(async tx => {
    const inquiriesEligible = await tx.lead.count({ where: inquiryWhere });
    const referralsEligible = await tx.referralIntroduction.count({ where: referralWhere });
    let inquiriesDeleted = 0, referralsDeleted = 0;
    if (!dryRun) {
      const inquiries = await tx.lead.findMany({ where: { ...inquiryWhere, ...externalReady }, orderBy: [{ closedAt: "asc" }, { id: "asc" }], take: BATCH_SIZE, select: { id: true } });
      const referrals = await tx.referralIntroduction.findMany({ where: { ...referralWhere, ...externalReady }, orderBy: [{ closedAt: "asc" }, { id: "asc" }], take: BATCH_SIZE, select: { id: true } });
      // Recheck eligibility at deletion so a reopened, converted or held record isn't deleted from a stale id list.
      inquiriesDeleted = (await tx.lead.deleteMany({ where: { ...inquiryWhere, ...externalReady, id: { in: inquiries.map(row => row.id) } } })).count;
      referralsDeleted = (await tx.referralIntroduction.deleteMany({ where: { ...referralWhere, ...externalReady, id: { in: referrals.map(row => row.id) } } })).count;
    }
    return { dryRun, cutoff: cutoff.toISOString(), inquiriesEligible, referralsEligible, inquiriesDeleted, referralsDeleted,
      hasMore: !dryRun && (inquiriesEligible > inquiriesDeleted || referralsEligible > referralsDeleted) };
  });
}
