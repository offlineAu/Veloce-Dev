import type { NextConfig } from "next";
import { calEndpoints } from "./src/lib/cal-endpoints";

const isProd = process.env.NODE_ENV === "production";
const scheduling = process.env.BOOKING_ENABLED === "true";
const cal = calEndpoints(process.env.CAL_LOCAL_MODE === 'true', process.env.CAL_BOOKING_URL, process.env.CAL_API_BASE_URL);
const calSources = cal.local ? ` ${cal.webOrigin}` : ' https://cal.com https://app.cal.com';

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}${scheduling ? calSources : ""}`,
  `frame-src 'self'${scheduling ? calSources : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${scheduling ? calSources : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          ...(isProd
            ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
