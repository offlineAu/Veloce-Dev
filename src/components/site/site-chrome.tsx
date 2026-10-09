import type { ReactNode } from "react";
import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
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
    <Link href="/" className="flex items-center gap-2.5 font-heading text-lg text-ink" aria-label={`${name} home`}>
      <LogoMark className="size-7" />
      {name}
    </Link>
  );
}

export function SiteHeader({ companyName, links, menuCta }: { companyName: string; links: NavLink[]; menuCta?: ReactNode }) {
  return <NotchHeader companyName={companyName} links={links} menuCta={menuCta} />;
}

export interface FooterColumn {
  title: string;
  links: NavLink[];
}

export function SiteFooter({
  name,
  description,
  email,
  websiteUrl,
  channels,
  showContacts = true,
  columns = [],
  contactHref,
}: {
  name: string;
  description: string;
  email: string;
  websiteUrl: string;
  channels: Channel[];
  /** Set false on a page that already shows the contact row itself (the sales page does), to avoid showing it twice. */
  showContacts?: boolean;
  /** Optional link columns (e.g. sections and services of the page). */
  columns?: FooterColumn[];
  /** In-page anchor for the "Questions?" call to action; omitted, it falls back to email. */
  contactHref?: string;
}) {
  let host = websiteUrl;
  try {
    host = new URL(websiteUrl).host;
  } catch {
    /* keep raw */
  }
  const link = "transition-colors hover:text-on-inverse";
  return (
    <footer className="bg-inverse text-[13.5px] text-on-inverse/70">
      <div className="mx-auto max-w-page px-5 pb-28 pt-14 sm:px-10 lg:px-16 lg:pb-12">
        <div className="grid gap-10 border-b border-on-inverse/10 pb-12 md:grid-cols-12">
          <div className="flex flex-col gap-4 md:col-span-5">
            <strong className="flex items-center gap-2.5 font-heading text-xl font-bold tracking-tight text-on-inverse">
              <LogoMark className="size-7 text-accent" />
              {name}
            </strong>
            <p className="font-heading text-[17px] text-on-inverse">{brand.tagline}</p>
            <p className="max-w-[46ch] leading-relaxed">{description}</p>
            <p className="font-mono text-xs text-on-inverse/60">{email}</p>
          </div>
          {columns.map((c) => (
            <div key={c.title} className="flex flex-col gap-3 md:col-span-2">
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-on-inverse/85">{c.title}</p>
              <ul className="flex flex-col gap-2">
                {c.links.map((l) => (
                  <li key={`${l.href}-${l.label}`}>
                    <a className={link} href={l.href}>{l.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="flex flex-col gap-3 md:col-span-3 md:col-start-10">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-on-inverse/85">Questions?</p>
            <p>Have an idea, or need straightforward advice on what to build first?</p>
            <a href={contactHref ?? `mailto:${email}`} className="inline-flex w-fit items-center gap-1.5 border-b border-accent pb-0.5 font-semibold text-accent transition-colors hover:border-on-inverse hover:text-on-inverse">
              Talk with us <span aria-hidden>→</span>
            </a>
            {showContacts ? <SocialFlipButton items={channels} /> : null}
          </div>
        </div>
        <div className="flex flex-col gap-4 pt-8 font-mono text-[11.5px] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {name}</p>
          <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <a className={link} href={`mailto:${email}`}>{email}</a>
            <a className={link} href={websiteUrl}>{host}</a>
            <Link className={link} href="/privacy">Privacy</Link>
            <Link className={link} href="/terms">Terms</Link>
            {/* The header has a palette icon from lg up; this link covers phones and tablets, where the header goes logo-only once scrolled. */}
            <ThemeManager variant="text" className="hover:text-on-inverse lg:hidden" />
          </nav>
        </div>
      </div>
    </footer>
  );
}
