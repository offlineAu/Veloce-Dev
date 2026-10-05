import type { ReactNode } from "react";
import { SiteFooter, SiteHeader } from "./site-chrome";
import { getCompanyProfile } from "@/server/services/company";

export async function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  const c = await getCompanyProfile();
  return (
    <>
      <SiteHeader companyName={c.name} links={[{ href: "/", label: "Home" }]} />
      <main id="main" className="mx-auto max-w-3xl px-5 py-16 sm:px-10">
        <h1 className="mb-8 text-[clamp(32px,4vw,48px)] leading-tight">{title}</h1>
        <div className="flex flex-col gap-4 text-[16px] leading-relaxed text-muted [&_h2]:mt-6 [&_h2]:text-[24px] [&_h2]:text-ink">{children}</div>
      </main>
      <SiteFooter name={c.name} description={c.description} email={c.contactEmail} websiteUrl={c.websiteUrl} channels={c.channels} />
    </>
  );
}
