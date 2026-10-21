import "server-only";
import { db } from "@/server/db";
export type SessionKind = "owner" | "developer";
export async function registerSession(id: string, kind: SessionKind, expiresAt: number) {
  await db.securitySession.create({ data: { id, kind, expiresAt: new Date(expiresAt) } });
}
export async function sessionActive(id: string | undefined, kind: SessionKind): Promise<boolean> {
  if (!id) return false;
  const row = await db.securitySession.findUnique({ where: { id } });
  return !!row && row.kind === kind && !row.revokedAt && row.expiresAt.getTime() > Date.now();
}
export async function revokeSession(id: string | undefined, kind: SessionKind) {
  if (id) await db.securitySession.updateMany({ where: { id, kind, revokedAt: null }, data: { revokedAt: new Date() } });
}
export async function revokeAllSessions(kind: SessionKind) {
  await db.securitySession.updateMany({ where: { kind, revokedAt: null }, data: { revokedAt: new Date() } });
}
