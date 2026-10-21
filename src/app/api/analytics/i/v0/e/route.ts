import { BodyLimitError, readBody } from "@/server/security/body";
import { z } from "@/lib/security/schema";
import { currentVisitor } from "@/server/analytics/consent";
import { captureBrowser, scheduleAnalytics } from "@/server/analytics/capture";
import { browserEvents, browserPropertiesSchema } from "@/lib/analytics/shared";
import { clientKey } from "@/server/security/request";
import { allow } from "@/server/security/rate-limit";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
const eventSchema = z.object({ event: z.enum(browserEvents), uuid: z.uuid(), properties: browserPropertiesSchema });
const payloadSchema = z.union([eventSchema.transform(event => [event]), z.object({ batch: z.array(eventSchema).min(1).max(20) }).transform(body => body.batch)]);
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return new Response(null, { status: 403, headers });
  try {
    if (!await allow(`analytics-sdk:${await clientKey()}`, 300, 60_000)) return new Response(null, { status: 429, headers });
    const visitor = await currentVisitor();
    if (!visitor) return new Response(null, { status: 403, headers });
    // SDK compression and request queue batching are disabled; transport still uses a batch envelope.
    // Beacon fallback may encode JSON as base64 form data.
    const raw = new TextDecoder().decode(await readBody(request, 16_000));
    if (raw.length > 16_000) return new Response(null, { status: 413, headers });
    const encoded = request.headers.get("content-type")?.includes("application/x-www-form-urlencoded") ? new URLSearchParams(raw).get("data") : null;
    const value: unknown = JSON.parse(encoded ? Buffer.from(encoded, "base64").toString("utf8") : raw);
    const parsed = payloadSchema.safeParse(value);
    if (!parsed.success || parsed.data.some(event => event.event === "page_viewed")) return new Response(null, { status: 400, headers });
    for (const { event, properties, uuid } of parsed.data) scheduleAnalytics(() => captureBrowser(visitor.id, event, properties, uuid));
    return Response.json({ status: 1 }, { headers });
  } catch (error) { return new Response(null, { status: error instanceof BodyLimitError ? error.status : 503, headers }); }
}
