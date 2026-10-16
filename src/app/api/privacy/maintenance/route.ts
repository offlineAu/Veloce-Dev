import { timingSafeEqual } from "node:crypto";
import { env } from "@/config/env";
import { cleanupClosedRecords } from "@/server/privacy/retention";

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
  if (mode !== "true" && mode !== "false") {
    return Response.json({ error: "Specify dryRun=true to preview or dryRun=false to apply cleanup" }, { status: 400, headers });
  }
  try {
    return Response.json(await cleanupClosedRecords({ dryRun: mode === "true" }), { headers });
  } catch {
    return Response.json({ error: "Privacy cleanup failed; retry required" }, { status: 503, headers });
  }
}
