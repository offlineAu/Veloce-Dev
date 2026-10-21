import { BodyLimitError, readJson } from "@/server/security/body";
import { allow } from "@/server/security/rate-limit";
import { clientKey } from "@/server/security/request";
import { securityEvent } from "@/server/security/events";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  // Browser CSP reports may have no Origin. Reject explicit foreign origins.
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return new Response(null, { status: 403, headers });
  try {
    if (!await allow(`csp:${await clientKey()}`, 30, 60_000) || !await allow("csp:global", 500, 60_000)) return new Response(null, { status: 429, headers });
    const body = await readJson(request, 16_000);
    if (!body || typeof body !== "object") return new Response(null, { status: 400, headers });
    // Reports contain private URLs and script samples. Only a count leaves this route.
    securityEvent("csp_violation", Array.isArray(body) ? Math.min(body.length, 20) : 1);
    return new Response(null, { status: 204, headers });
  } catch (error) { return new Response(null, { status: error instanceof BodyLimitError ? error.status : 400, headers }); }
}
