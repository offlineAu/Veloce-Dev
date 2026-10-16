import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowDown, ArrowRight, ArrowUpRight, CalendarDays, ChevronDown, Clock3, FileCheck2,
  FileText, Fingerprint, FolderOpen, Globe2, Handshake, Info, Layers3, Mail,
  MessageCircle, RefreshCw, Scale, ShieldCheck, UserRound, UsersRound,
} from "lucide-react";
import { SiteFooter, SiteHeader } from "./site-chrome";
import { LegalIllustration } from "./legal-illustration";
import { getCompanyProfile } from "@/server/services/company";
import { LEGAL_UPDATED_LABEL, PRIVACY_NOTICE_VERSION } from "@/lib/legal";
import styles from "./legal-page.module.css";

const sections = {
  privacy: [
    { id: "responsibility", title: "Who is responsible", label: "Who’s responsible", icon: UserRound },
    { id: "collection", title: "Information we collect", label: "What we collect", icon: FolderOpen },
    { id: "purpose", title: "Why we use it", label: "How it’s used", icon: MessageCircle },
    { id: "recipients", title: "Who receives information", label: "Who receives it", icon: UsersRound },
    { id: "previews", title: "Submitted design previews", label: "Design previews", icon: Layers3 },
    { id: "storage", title: "Cookies and browser storage", label: "Browser storage", icon: Fingerprint },
    { id: "retention", title: "How long information is kept", label: "Retention", icon: Clock3 },
    { id: "rights", title: "Your choices and rights", label: "Your rights", icon: ShieldCheck },
    { id: "changes", title: "Changes and related terms", label: "Updates", icon: RefreshCw },
  ],
  terms: [
    { id: "website", title: "About this website", label: "About this website", icon: Globe2 },
    { id: "agreements", title: "Project agreements and offers", label: "Agreements & offers", icon: Handshake },
    { id: "acceptable-use", title: "Acceptable use", label: "Acceptable use", icon: ShieldCheck },
    { id: "ownership", title: "Website materials and your submissions", label: "Materials & ownership", icon: FileCheck2 },
    { id: "builder", title: "Builder drafts and previews", label: "Drafts & previews", icon: Layers3 },
    { id: "meetings", title: "Meetings and third-party services", label: "Meetings & services", icon: CalendarDays },
    { id: "responsibility", title: "Availability and responsibility", label: "Availability", icon: Info },
    { id: "privacy", title: "Privacy", label: "Privacy", icon: Fingerprint },
    { id: "law", title: "Governing law and questions", label: "Law & questions", icon: Scale },
  ],
} as const;
type LegalKind = keyof typeof sections;

const summaries = {
  privacy: [
    { icon: FolderOpen, title: "Collected with a purpose", text: "Details to handle your request.", href: "#collection" },
    { icon: Clock3, title: "30-day closed inquiry cleanup", text: "With exceptions for records still needed.", href: "#retention" },
    { icon: ShieldCheck, title: "You have a choice", text: "Ask, correct, or request deletion.", href: "#rights" },
  ],
  terms: [
    { icon: MessageCircle, title: "Start with a conversation", text: "An inquiry is a first step.", href: "#website" },
    { icon: Handshake, title: "Agree before work begins", text: "Paid work has a separate agreement.", href: "#agreements" },
    { icon: FileCheck2, title: "Your content stays yours", text: "You retain rights in your submissions.", href: "#ownership" },
  ],
} as const;

export function LegalSection({ kind, id, children }: { kind: LegalKind; id: string; children: ReactNode }) {
  const index = sections[kind].findIndex(section => section.id === id);
  const section = sections[kind][index];
  if (!section) throw new Error(`Unknown legal section: ${kind}/${id}`);
  const Icon = section.icon;
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={styles.section}>
      <div className={styles.sectionHeading}>
        <span className={styles.sectionIcon}><Icon size={20} strokeWidth={1.5} aria-hidden="true" /></span>
        <h2 id={`${id}-title`}>{section.title}</h2>
        <span className={styles.sectionNumber} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
      </div>
      <div className={styles.copy}>{children}</div>
    </section>
  );
}

export function LegalReviewNote({ children }: { children: ReactNode }) {
  return <div className={styles.reviewNote}><Info size={17} aria-hidden="true" /><p><strong>Draft for review.</strong> {children}</p></div>;
}

function Contents({ kind }: { kind: LegalKind }) {
  return <nav aria-label="On this page"><ol className={styles.contents}>
    {sections[kind].map((section, index) => <li key={section.id}><a href={`#${section.id}`}><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>{section.label}<ArrowDown size={12} aria-hidden="true" /></a></li>)}
  </ol></nav>;
}

export async function LegalPage({ title, kind, contactEmail, children }: { title: string; kind: LegalKind; contactEmail: string; children: ReactNode }) {
  const c = await getCompanyProfile();
  const privacy = kind === "privacy";
  const other = privacy ? { href: "/terms", title: "Terms of use", text: "The details of using this website." } : { href: "/privacy", title: "Privacy notice", text: "How your information is handled." };
  return (
    <>
      <SiteHeader companyName={c.name} links={[{ href: "/", label: "Home" }, { href: "/privacy", label: "Privacy" }, { href: "/terms", label: "Terms" }]} />
      <main id="main" className={styles.page}>
        <header className={styles.hero}>
          <div>
            <div className={styles.eyebrow}><span />The details, made clear<span className={styles.documentNumber}>{privacy ? "01" : "02"} / LEGAL</span></div>
            <h1>{title}<span className={styles.titleDot}>.</span></h1>
            <p className={styles.intro}>{privacy ? "What you share, how it’s handled, and the choices that stay yours." : "A few shared expectations for exploring, creating, and working together."}</p>
            <div className={styles.metadata}><span><CalendarDays size={14} aria-hidden="true" />Updated {LEGAL_UPDATED_LABEL}</span>{privacy ? <span className={styles.version}>Version {PRIVACY_NOTICE_VERSION}</span> : <span className={styles.version}>Based in the Philippines</span>}</div>
          </div>
          <figure className={styles.illustration}><LegalIllustration kind={kind} /><figcaption>{privacy ? "Your information. Your choices." : "Good work starts with clarity."}</figcaption></figure>
        </header>

        <div className={styles.summaries} aria-label="At a glance">
          {summaries[kind].map(({ icon: Icon, title: summaryTitle, text, href }) => <a href={href} key={href} className={styles.summary}>
            <Icon size={20} strokeWidth={1.5} aria-hidden="true" /><div><strong>{summaryTitle}</strong><p>{text}</p></div><ArrowDown size={14} aria-hidden="true" />
          </a>)}
        </div>

        <div className={styles.documentLayout}>
          <aside className={styles.sidebar}>
            <div className={styles.documentTabs} aria-label="Legal documents"><Link href="/privacy" aria-current={privacy ? "page" : undefined}><ShieldCheck size={16} aria-hidden="true" />Privacy</Link><Link href="/terms" aria-current={!privacy ? "page" : undefined}><FileText size={16} aria-hidden="true" />Terms</Link></div>
            <div className={styles.desktopContents}><p className={styles.contentsLabel}>In this document</p><Contents kind={kind} /></div>
            <details className={styles.mobileContents}><summary>In this document<ChevronDown size={16} aria-hidden="true" /></summary><Contents kind={kind} /></details>
            <a className={styles.sidebarContact} href={`mailto:${contactEmail}`}><Mail size={15} aria-hidden="true" />A question about the details?<ArrowUpRight size={14} aria-hidden="true" /></a>
          </aside>
          <div className={styles.document}>{children}<a href="#main" className={styles.backToTop}>Back to top<ArrowDown size={14} aria-hidden="true" /></a></div>
        </div>

        <div className={styles.closing}>
          <div className={styles.contact}><span className={styles.contactIcon}><Mail size={24} strokeWidth={1.5} aria-hidden="true" /></span><div><h2>Still have a question?</h2><p>Get in touch. We’ll help make it clear.</p><a href={`mailto:${contactEmail}`}>{contactEmail}<ArrowUpRight size={16} aria-hidden="true" /></a></div></div>
          <Link href={other.href} className={styles.otherDocument}><span className={styles.contentsLabel}>Also worth a read</span><strong>{other.title}<ArrowRight size={22} aria-hidden="true" /></strong><span>{other.text}</span></Link>
        </div>
      </main>
      <SiteFooter showContacts={false} name={c.name} description={c.description} email={c.contactEmail} websiteUrl={c.websiteUrl} channels={c.channels} />
    </>
  );
}
