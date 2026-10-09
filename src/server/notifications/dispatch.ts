import "server-only";
import type { NotificationKind } from "@/generated/prisma/enums";
import { db } from "@/server/db";
import { hmac } from "@/server/security/hash";
import { getProvider } from "./provider";
import type { Message } from "./templates";

interface DispatchInput {
  kind: NotificationKind;
  entity: { leadId: string } | { introductionId: string };
  to: string;
  message: Message;
}

export type DispatchResult = "SENT" | "FAILED" | "SKIPPED" | "DUPLICATE";

/**
 * Outbox-style send. A log row with a unique dedupeKey is created first, so a retried
 * request (or concurrent duplicate) can never send the same notification twice.
 * Failures are recorded and returned, never thrown: they must not fail the user's submission.
 */
export async function dispatch({ kind, entity, to, message }: DispatchInput): Promise<DispatchResult> {
  const entityId = "leadId" in entity ? entity.leadId : entity.introductionId;
  const recipientHash = hmac(`rcpt:${to.toLowerCase()}`);
  const dedupeKey = `${kind}:${entityId}:${recipientHash}`;

  let logId: string;
  try {
    const row = await db.notificationLog.create({
      data: { kind, recipientHash, dedupeKey, ...entity },
      select: { id: true },
    });
    logId = row.id;
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") return "DUPLICATE";
    console.error("[notifications] could not create log row");
    return "FAILED";
  }

  return deliverLoggedNotification(logId, to, message, dedupeKey);
}

/** Atomic lease shared by initial delivery and bounded recovery. */
export async function deliverLoggedNotification(logId: string, to: string, message: Message, dedupeKey: string): Promise<DispatchResult> {
  const now = new Date();
  const claimed = await db.notificationLog.updateMany({
    where: { id: logId, status: { in: ["PENDING", "FAILED", "SKIPPED"] }, attempts: { lt: 5 }, OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] },
    data: { leaseUntil: new Date(now.getTime() + 120_000) },
  });
  if (!claimed.count) return "DUPLICATE";
  const provider = getProvider();
  if (!provider.delivers) {
    await db.notificationLog.update({ where: { id: logId }, data: { status: "SKIPPED", leaseUntil: null, lastError: "No email provider configured" } });
    return "SKIPPED";
  }
  await db.notificationLog.update({ where: { id: logId }, data: { attempts: { increment: 1 } } });
  try {
    const { providerRef } = await provider.send({ to, ...message, idempotencyKey: dedupeKey });
    await db.notificationLog.update({ where: { id: logId }, data: { status: "SENT", providerRef, leaseUntil: null, lastError: null } });
    return "SENT";
  } catch {
    await db.notificationLog.update({ where: { id: logId }, data: { status: "FAILED", leaseUntil: null, lastError: "Email delivery failed" } }).catch(() => undefined);
    return "FAILED";
  }
}
