import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/server/db";
import { allow } from "@/server/security/rate-limit";
import { clientKey } from "@/server/security/request";
import { readDevSession } from "@/server/security/dev-session";
import { analyticsConfig } from "@/server/analytics/config";
import { currentVisitor, signVisitor } from "@/server/analytics/consent";
import { captureBrowser, scheduleAnalytics } from "@/server/analytics/capture";
import { ANALYTICS_COOKIE, ANALYTICS_MAX_AGE, browserEvents, browserPropertiesSchema } from "@/lib/analytics/shared";
import { PRIVACY_NOTICE_VERSION } from "@/lib/legal";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("allow"), noticeVersion: z.literal(PRIVACY_NOTICE_VERSION) }),
  z.object({ action: z.literal("withdraw") }),
  z.object({ action: z.literal("status") }),
  z.object({ action: z.literal("capture"), event: z.enum(browserEvents), uuid: z.uuid(), properties: browserPropertiesSchema }),
]);
export async function POST(request: Request) {
  // Only our browser UI may change consent or submit events; reject cross-origin writes.
  if (request.headers.get("origin") !== new URL(request.url).origin) return new Response(null, { status: 403, headers });
  try {
    if (!await allow(`analytics:${await clientKey()}`, 300, 60_000)) return new Response(null, { status: 429, headers });
    const text = await request.text();
    if (text.length > 6000) return new Response(null, { status: 413, headers });
    const parsed = schema.safeParse(JSON.parse(text));
    if (!parsed.success) return new Response(null, { status: 400, headers });
    const data = parsed.data;
    if (data.action !== "withdraw" && (!analyticsConfig().enabled || await readDevSession())) return new Response(null, { status: 403, headers });
    const jar = await cookies();
    if (data.action === "withdraw") {
      const visitor = await currentVisitor(true);
      if (visitor) await db.analyticsVisitor.update({ where: { id: visitor.id }, data: { revokedAt: new Date() } });
      jar.delete(ANALYTICS_COOKIE);
    } else if (data.action === "allow") {
      const existing = await currentVisitor();
      if (!existing) {
        const visitor = await db.analyticsVisitor.create({ data: {
          id: randomUUID(), reference: randomUUID(), noticeVersion: data.noticeVersion,
          expiresAt: new Date(Date.now() + ANALYTICS_MAX_AGE * 1000),
        } });
        jar.set(ANALYTICS_COOKIE, signVisitor(visitor.id), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: ANALYTICS_MAX_AGE });
      }
    } else {
      const visitor = await currentVisitor();
      if (!visitor) return new Response(null, { status: 403, headers });
      if (data.action === "capture") scheduleAnalytics(() => captureBrowser(visitor.id, data.event, data.properties, data.uuid));
    }
    return new Response(null, { status: 204, headers });
  } catch { return new Response(null, { status: 503, headers }); }
}
