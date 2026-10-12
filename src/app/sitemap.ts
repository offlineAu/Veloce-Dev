import type { MetadataRoute } from "next";
import { env } from "@/config/env";
import { publicPagePaths } from "@/content/seo";

/** Only public pages. Personal referral pages are deliberately excluded. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = env().NEXT_PUBLIC_SITE_URL;
  return publicPagePaths.map((p) => ({ url: new URL(p, base).toString() }));
}
