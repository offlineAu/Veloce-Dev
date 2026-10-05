import type { MetadataRoute } from "next";
import { env } from "@/config/env";

export default function robots(): MetadataRoute.Robots {
  const base = env().NEXT_PUBLIC_SITE_URL;
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/refer/", "/admin/", "/api/"] },
    sitemap: `${base}/sitemap.xml`,
  };
}
