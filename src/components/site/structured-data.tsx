import { headers } from "next/headers";
import { env } from "@/config/env";
import { serializeJsonLd } from "@/lib/seo";
import type { CompanyProfile } from "@/server/services/company";

export async function OrganizationData({ company }: { company: CompanyProfile }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const base = env().NEXT_PUBLIC_SITE_URL;
  const url = new URL("/", base).toString();
  const social = company.channels.filter((channel) => channel.href && !["email", "whatsapp"].includes(channel.kind)).map((channel) => channel.href!);
  return <script nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd({
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": `${url}#organization`, name: company.name, url, logo: new URL("/brand/veloce-logo-original.png", base).toString(), email: company.contactEmail, ...(social.length ? { sameAs: social } : {}) },
      { "@type": "WebSite", "@id": `${url}#website`, name: company.name, url, publisher: { "@id": `${url}#organization` } },
    ],
  }) }} />;
}

export async function BreadcrumbData({ label, path }: { label: string; path: string }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const base = env().NEXT_PUBLIC_SITE_URL;
  return <script nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd({
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: new URL("/", base).toString() },
      { "@type": "ListItem", position: 2, name: label, item: new URL(path, base).toString() },
    ],
  }) }} />;
}
