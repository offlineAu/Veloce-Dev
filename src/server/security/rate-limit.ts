import "server-only";
import { db } from "@/server/db";

/**
 * Fixed-window counter stored in Postgres, so it works across server instances
 * without extra infrastructure. Returns true if the request is allowed.
 */
export async function allow(key: string, limit: number, windowMs: number, now = Date.now()): Promise<boolean> {
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
  const row = await db.rateLimit.upsert({
    where: { key_windowStart: { key, windowStart } },
    create: { key, windowStart, count: 1 },
    update: { count: { increment: 1 } },
    select: { count: true },
  });
  if (Math.random() < 0.02) {
    // Opportunistic cleanup of old windows.
    await db.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(now - 24 * 3600_000) } } }).catch(() => undefined);
  }
  return row.count <= limit;
}
