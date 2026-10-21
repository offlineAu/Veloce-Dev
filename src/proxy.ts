import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { securityCsp } from "@/lib/security/csp";
import { calEndpoints } from "@/lib/cal-endpoints";

export function proxy(request: NextRequest) {
  const nonce = randomBytes(18).toString("base64");
  const cal = calEndpoints(process.env.CAL_LOCAL_MODE === "true", process.env.CAL_BOOKING_URL, process.env.CAL_API_BASE_URL);
  const calSources = process.env.BOOKING_ENABLED === "true" ? cal.local ? ` ${cal.webOrigin}` : " https://cal.com https://app.cal.com" : "";
  const policy = securityCsp({ production: process.env.NODE_ENV === "production", builder: request.nextUrl.pathname === "/build" || request.nextUrl.pathname.startsWith("/build/"), calSources, nonce });
  const headers = new Headers(request.headers);
  // Overwrite caller-provided values. Next reads the request CSP to nonce its scripts.
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers } });
  const mode = process.env.SECURITY_CSP_MODE === "enforce" ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only";
  response.headers.set(mode, `${policy}; report-uri /api/security/report`);
  // Per-response nonces must never be paired with cached HTML/RSC from another request.
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: ["/((?!api/|_next/|build/bake|build/t/|images/|brand/|builder-templates/|favicon.ico|robots.txt|sitemap.xml|opengraph-image|twitter-image).*)"],
};
