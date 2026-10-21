import { timingSafeEqual } from "node:crypto";
import { db } from "@/server/db";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  const secret = process.env.PRIVACY_CRON_SECRET;
  const received = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || secret.length < 32 || Buffer.byteLength(received) !== Buffer.byteLength(secret) || !timingSafeEqual(Buffer.from(received), Buffer.from(secret))) return new Response(null, { status: 401, headers });
  const dryRun = new URL(request.url).searchParams.get("dryRun");
  if (dryRun !== "true" && dryRun !== "false") return new Response(null, { status: 400, headers });
  const expiresAt = { lt: new Date(Date.now() - 24 * 3600_000) };
  try {
    if (dryRun === "true") return Response.json({ sessions: await db.securitySession.count({ where: { expiresAt } }), grants: await db.privateAccessGrant.count({ where: { expiresAt } }) }, { headers });
    const sessions = await db.securitySession.deleteMany({ where: { expiresAt } });
    const grants = await db.privateAccessGrant.deleteMany({ where: { expiresAt } });
    return Response.json({ sessions: sessions.count, grants: grants.count }, { headers });
  } catch { return new Response(null, { status: 503, headers }); }
}
