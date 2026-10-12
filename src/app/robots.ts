import type { MetadataRoute } from "next";
import { env } from "@/config/env";

export default function robots(): MetadataRoute.Robots {
  const base = env().NEXT_PUBLIC_SITE_URL;
  return {
    // Referral, builder, and preview pages remain crawlable so their noindex tags can be read.
    rules: { userAgent: "*", allow: "/", disallow: ["/admin/", "/api/"] },
    sitemap: `${base}/sitemap.xml`,
  };
}
