import "server-only";
import { env } from "@/config/env";
import { db } from "@/server/db";

export type ChannelKind = "email" | "whatsapp" | "facebook" | "instagram" | "linkedin" | "github" | "x" | "discord";

export interface Channel {
  kind: ChannelKind;
  label: string;
  /** Missing when the channel is not set up yet; it is still listed so the contact row shows every slot. */
  href?: string;
}

export interface CompanyProfile {
  id: string | null;
  name: string;
  description: string;
  contactEmail: string;
  websiteUrl: string;
  timezone: string;
  /** Contact channels for the footer. Email is always present; the rest only if configured. */
  channels: Channel[];
}

const httpUrl = (v?: string) => {
  try {
    const u = new URL(v ?? "");
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
};

function buildChannels(email: string): Channel[] {
  const e = env();
  const digits = e.COMPANY_WHATSAPP?.replace(/D/g, "");
  const wa = digits && digits.length >= 7 ? `https://wa.me/${digits}` : undefined;
  const link = (kind: ChannelKind, label: string, raw?: string): Channel => {
    const href = httpUrl(raw);
    return href ? { kind, label, href } : { kind, label };
  };
  // Six always-listed slots (one per letter of the brand word); unset ones have no link. X and Discord appear only once set.
  const out: Channel[] = [
    { kind: "email", label: "Email", href: `mailto:${email}` },
    wa ? { kind: "whatsapp", label: "WhatsApp", href: wa } : { kind: "whatsapp", label: "WhatsApp" },
    link("facebook", "Facebook", e.SOCIAL_FACEBOOK_URL),
    link("instagram", "Instagram", e.SOCIAL_INSTAGRAM_URL),
    link("linkedin", "LinkedIn", e.SOCIAL_LINKEDIN_URL),
    link("github", "GitHub", e.SOCIAL_GITHUB_URL),
  ];
  for (const c of [link("x", "X", e.SOCIAL_X_URL), link("discord", "Discord", e.SOCIAL_DISCORD_URL)]) if (c.href) out.push(c);
  return out;
}

/** Public company profile: the DB row if present, otherwise environment configuration. */
export async function getCompanyProfile(): Promise<CompanyProfile> {
  const e = env();
  const row = await db.company.findFirst({ orderBy: { createdAt: "asc" } }).catch(() => null);
  const contactEmail = row?.contactEmail ?? e.COMPANY_CONTACT_EMAIL;
  return {
    id: row?.id ?? null,
    name: row?.name ?? e.COMPANY_NAME,
    description: row?.description ?? e.COMPANY_DESCRIPTION,
    contactEmail,
    websiteUrl: row?.websiteUrl ?? e.NEXT_PUBLIC_SITE_URL,
    timezone: e.COMPANY_TIMEZONE,
    channels: buildChannels(contactEmail),
  };
}

/** Company id used to own leads; creates the profile from env on first use. */
export async function ensureCompanyId(): Promise<string> {
  const existing = await db.company.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  if (existing) return existing.id;
  const e = env();
  const created = await db.company.create({
    data: {
      name: e.COMPANY_NAME,
      description: e.COMPANY_DESCRIPTION,
      contactEmail: e.COMPANY_CONTACT_EMAIL,
      websiteUrl: e.NEXT_PUBLIC_SITE_URL,
    },
    select: { id: true },
  });
  return created.id;
}
