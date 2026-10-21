import { securityCsp } from "./src/lib/security/csp";
import type { NextConfig } from "next";
import { calEndpoints } from "./src/lib/cal-endpoints";

const isProd = process.env.NODE_ENV === "production";
const scheduling = process.env.BOOKING_ENABLED === "true";
const cal = calEndpoints(process.env.CAL_LOCAL_MODE === 'true', process.env.CAL_BOOKING_URL, process.env.CAL_API_BASE_URL);
const calSources = cal.local ? ` ${cal.webOrigin}` : ' https://cal.com https://app.cal.com';

const buildCsp = (builder = false) => securityCsp({ production: isProd, builder, calSources: scheduling ? calSources : "" });
const csp = buildCsp();

const nextConfig: NextConfig = {
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  images: { localPatterns: [{ pathname: "/images/**" }, { pathname: "/brand/**" }, { pathname: "/builder-templates/**" }, { pathname: "/api/builder/media/**" }] },
  async redirects() {
    return [{
      source: "/:path*",
      has: [{ type: "host", value: "www.veloceapp.dev" }],
      destination: "https://veloceapp.dev/:path*",
      permanent: true,
    }];
  },
  // The template importer (only loaded by /api/dev/templates) compiles CSS with Tailwind, which uses a native
  // module (lightningcss). Bundling it fails, so these load from node_modules at runtime instead...
  serverExternalPackages: ["@tailwindcss/node", "@tailwindcss/oxide", "lightningcss", "sharp"],
  // ...and the files they read from disk are shipped with the upload route on Vercel.
  outputFileTracingIncludes: Object.fromEntries(
    // Routes that compile Tailwind on the server: template uploads, and extra classes added in the builder (editor
    // and the team's design preview).
    ["/api/dev/templates", "/api/builder/css", "/build/preview/[token]"].map((route) => [
      route,
      [
        "./node_modules/tailwindcss/*.css",
        "./node_modules/tailwindcss/package.json",
        "./node_modules/lightningcss/**/*",
        "./node_modules/lightningcss-*/**/*",
        "./node_modules/@tailwindcss/node/**/*",
      ],
    ]),
  ),
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), display-capture=()" },
          ...(isProd
            ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
            : []),
        ],
      },
      { source: "/api/dev/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
      { source: "/private/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Referrer-Policy", value: "no-referrer" }] },
      { source: "/api/private/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/admin/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      // Later entries win for the same key: only the builder gets the wider image and embed sources.
      { source: "/build/:path*", headers: [{ key: "Content-Security-Policy", value: buildCsp(true) }] },
      // The developer panel's capture page (src/app/build/bake): an uploaded template runs there once, sandboxed, with
      // its images, styles and fonts from anywhere, framed only by this site.
      {
        source: "/build/bake",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https:; img-src https: data: blob:; font-src https: data:; media-src https:; connect-src https:; frame-ancestors 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
