import "server-only";
import { db } from "@/server/db";
import { unlinkedReference } from "./capture";

/** Retain a tombstone and all lookup references until the owner confirms provider erasure. */
export async function requestAnalyticsDeletion(visitorIds: string[]) {
  if (!visitorIds.length) return;
  await db.analyticsVisitor.updateMany({
    where: { id: { in: [...new Set(visitorIds)] }, deletionRequestedAt: null },
    data: { revokedAt: new Date(), deletionRequestedAt: new Date() },
  });
}
export async function analyticsDeletionReferences(visitorId: string) {
  const visitor = await db.analyticsVisitor.findUniqueOrThrow({ where: { id: visitorId }, include: {
    leads: { select: { id: true } }, introductions: { select: { id: true } }, bookingSessions: { select: { id: true } },
  } });
  return {
    visitorId: visitor.id, requestedAt: visitor.deletionRequestedAt, confirmedAt: visitor.deletionConfirmedAt,
    // Delete both browsing identities and every isolated request identity, even if only some were used.
    distinctIds: [visitor.id, visitor.reference, ...[...visitor.leads, ...visitor.introductions, ...visitor.bookingSessions].map(row => unlinkedReference(row.id))],
  };
}
export async function confirmAnalyticsDeletion(visitorId: string) {
  return db.analyticsVisitor.updateMany({ where: { id: visitorId, deletionRequestedAt: { not: null }, deletionConfirmedAt: null }, data: { deletionConfirmedAt: new Date() } });
}
