import type { ReactNode } from "react";
import Link from "next/link";
import { LogoBadge, LogoMark } from "@/components/brand/logo";
import { brand } from "@/content/site";
import SocialFlipButton from "@/components/ui/social-flip-button";
import type { Channel } from "@/server/services/company";
import { NotchHeader } from "./notch-header";
import { ThemeManager } from "./theme-manager";

export interface NavLink {
  href: string;
  label: string;
}

export function Brand({ name }: { name: string }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 font-heading text-lg" aria-label={`${name} home`}>
      <LogoBadge className="size-9" />
      {name}
    </Link>
  );
}

export function SiteHeader({ companyName, links, menuCta }: { companyName: string; links: NavLink[]; menuCta?: ReactNode }) {
  return <NotchHeader companyName={companyName} links={links} menuCta={menuCta} />;
}

export function SiteFooter({
  name,
  description,
  email,
  websiteUrl,
  channels,
  showContacts = true,
}: {
  name: string;
  description: string;
  email: string;
  websiteUrl: string;
  channels: Channel[];
  /** Set false on a page that already shows the contact row itself (the sales page does), to avoid showing it twice. */
  showContacts?: boolean;
}) {
  let host = websiteUrl;
  try {
    host = new URL(websiteUrl).host;
  } catch {
    /* keep raw */
  }
  return (
    <footer className="mx-auto max-w-page px-5 py-12 pb-28 text-sm text-muted sm:px-10 lg:px-16 lg:pb-12">
      <div className="flex flex-wrap justify-between gap-10">
        <div className="flex max-w-[52ch] flex-col gap-3">
          <strong className="flex items-center gap-2.5 font-heading text-lg font-normal text-ink">
            <LogoMark className="size-5" />
            {name}
          </strong>
          <p className="font-heading text-[17px] text-ink">{brand.tagline}</p>
          <p>{description}</p>
        </div>
        <div className="flex flex-col gap-4 md:items-end">
          {showContacts ? <SocialFlipButton items={channels} /> : null}
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
            <a className="underline-offset-4 hover:underline" href={`mailto:${email}`}>{email}</a>
            <a className="underline-offset-4 hover:underline" href={websiteUrl}>{host}</a>
            <Link className="underline-offset-4 hover:underline" href="/privacy">Privacy</Link>
            <Link className="underline-offset-4 hover:underline" href="/terms">Terms</Link>
            {/* The header has a palette icon from lg up; this link covers phones and tablets, where the header goes logo-only once scrolled. */}
            <ThemeManager variant="text" className="lg:hidden" />
          </nav>
        </div>
      </div>
    </footer>
  );
}
