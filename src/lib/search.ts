/**
 * Entries for the site search (command palette). It searches this page's own content only: sections,
 * services, capabilities and a couple of contact actions. There is no server-side search.
 */
export type SearchGroup = "Jump to" | "Services" | "Capabilities" | "Contact";

export interface SearchEntry {
  id: string;
  label: string;
  /** Extra words that should match but are not shown. */
  keywords?: string[];
  /** Short line shown under the label. */
  hint?: string;
  group: SearchGroup;
  /** Icon name from components/ui/icon. */
  icon?: string;
  /** "link" scrolls/navigates, "cta" clicks the page's primary call-to-action, "mail" opens the mail client. */
  kind: "link" | "cta" | "mail";
  href?: string;
}

interface Source {
  links: { href: string; label: string }[];
  services?: { slug: string; title: string; description: string; icon?: string | null }[];
  capabilities?: { icon: string; title: string; body: string }[];
  email: string;
  ctaLabel: string;
}

export function buildSearchEntries({ links, services = [], capabilities = [], email, ctaLabel }: Source): SearchEntry[] {
  return [
    ...links.map<SearchEntry>((l) => ({ id: `nav-${l.href}`, label: l.label, group: "Jump to", icon: "pointer", kind: "link", href: l.href })),
    ...services.map<SearchEntry>((s) => ({
      id: `svc-${s.slug}`,
      label: s.title,
      hint: s.description,
      group: "Services",
      icon: s.icon ?? undefined,
      kind: "link",
      href: "#services",
    })),
    ...capabilities.map<SearchEntry>((c) => ({
      id: `cap-${c.title}`,
      label: c.title,
      hint: c.body,
      group: "Capabilities",
      icon: c.icon,
      kind: "link",
      href: "#capabilities",
    })),
    { id: "cta", label: ctaLabel, hint: "Tell us what you want to build or fix", group: "Contact", icon: "form", kind: "cta" },
    { id: "mail", label: "Email us", hint: email, keywords: ["contact", "write"], group: "Contact", icon: "form", kind: "mail", href: `mailto:${email}` },
  ];
}
