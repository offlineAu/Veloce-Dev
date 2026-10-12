import type { Metadata } from "next";

export function pageMetadata(title: string, description: string, path: string): Metadata {
  return {
    title, description, alternates: { canonical: path },
    // Next.js replaces nested metadata objects; explicitly retain the shared preview on child pages.
    openGraph: { type: "website", title, description, url: path, images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Custom websites and digital systems" }] },
    twitter: { card: "summary_large_image", title, description, images: ["/opengraph-image"] },
  };
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
