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

  const provider = getProvider();
  if (!provider.delivers) {
    await db.notificationLog.update({
      where: { id: logId },
      data: { status: "SKIPPED", lastError: "No email provider configured" },
    });
    return "SKIPPED";
  }

  try {
    const { providerRef } = await provider.send({ to, ...message, idempotencyKey: dedupeKey });
    await db.notificationLog.update({
      where: { id: logId },
      data: { status: "SENT", providerRef, attempts: { increment: 1 }, lastError: null },
    });
    return "SENT";
  } catch (err) {
    await db.notificationLog
      .update({
        where: { id: logId },
        data: { status: "FAILED", attempts: { increment: 1 }, lastError: (err as Error).message.slice(0, 200) },
      })
      .catch(() => undefined);
    return "FAILED";
  }
}
