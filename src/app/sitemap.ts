import type { MetadataRoute } from "next";
import { env } from "@/config/env";

/** Only public pages. Personal referral pages are deliberately excluded. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = env().NEXT_PUBLIC_SITE_URL;
  return ["/", "/privacy", "/terms"].map((p) => ({ url: new URL(p, base).toString() }));
}
