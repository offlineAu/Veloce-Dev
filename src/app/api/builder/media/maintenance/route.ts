import { timingSafeEqual } from "node:crypto";
import { env } from "@/config/env";
import { cleanupMedia } from "@/server/builder/media";

/*
 * Removes builder uploads past their time (server/builder/media.ts). Personal data can be in a photo, so it runs on the
 * privacy schedule with the same secret: POST with "Authorization: Bearer <PRIVACY_CRON_SECRET>" and ?dryRun=true|false.
 */

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const expected = env().PRIVACY_CRON_SECRET;
  const authorization = request.headers.get("authorization");
  const received = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
  if (!expected || expected.length < 32 || !received || Buffer.byteLength(received) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(received), Buffer.from(expected))) {
    return new Response(null, { status: 401, headers });
  }
  const mode = new URL(request.url).searchParams.get("dryRun");
  if (mode !== "true" && mode !== "false") return Response.json({ error: "Specify dryRun=true to preview or dryRun=false to apply cleanup" }, { status: 400, headers });
  try {
    return Response.json(await cleanupMedia({ dryRun: mode === "true" }), { headers });
  } catch {
    return Response.json({ error: "Media cleanup failed; retry required" }, { status: 503, headers });
  }
}
