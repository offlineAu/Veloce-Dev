import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertCircle, ArrowLeft, ArrowRightLeft, CalendarClock, ExternalLink, FileText, Inbox, Mail, MailWarning, NotebookPen, PhoneCall } from "lucide-react";
import { isOwner } from "@/server/admin/session";
import { getClient, MOVABLE } from "@/server/clients/tracker";
import { AdminShell } from "@/components/admin/admin-shell";
import { card } from "@/components/admin/analytics-dashboard";
import { LinkPending } from "@/components/admin/link-pending";
import { CloseOrReopen, FollowUpComposer, NoteForm, StageForm, StagePill } from "@/components/admin/client-parts";
import { INTENT_LABEL, PROJECT_LABEL, SOURCE_LABEL, STAGE_LABEL } from "@/lib/admin-labels";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Client", robots: { index: false, follow: false }, referrer: "no-referrer" };

const when = (d: Date) => new Intl.DateTimeFormat("en", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }).format(d);
const day = (d: Date) => new Intl.DateTimeFormat("en", { timeZone: "Asia/Manila", dateStyle: "medium" }).format(d);
const WEBSITE: Record<string, string> = { BUSINESS: "Business site", CORPORATE: "Corporate site", ECOMMERCE_STORE: "Online store", WEB_APP: "Web app", LANDING_PAGE: "Landing page", OTHER: "Other" };
const title = "font-heading text-base font-medium text-[var(--dash-ink)]";

type Event = { at: Date; icon: typeof Mail; title: string; detail?: string | null; body?: string | null; tone?: "warn" };

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-z0-9]{10,40}$/.test(id)) notFound();
  if (!await isOwner()) redirect(`/admin/analytics?next=/admin/clients/${id}`);
  const client = await getClient(id);
  if (!client) notFound();
  const { lead, suggestion, drafts, emailReady } = client;
  const open = !lead.closedAt && lead.status !== "NOT_PROCEEDING";

  const events: Event[] = [
    { at: lead.createdAt, icon: Inbox, title: `${INTENT_LABEL[lead.intent]} received`, detail: `${PROJECT_LABEL[lead.projectType]} · ${SOURCE_LABEL[lead.source]}` },
    ...lead.notifications.filter(n => n.kind === "LEAD_ACK").map(n => ({ at: n.createdAt, icon: Mail, title: "Automatic acknowledgement", detail: n.status === "SENT" ? "Delivered" : `Not delivered (${n.status.toLowerCase()})`, tone: n.status === "SENT" ? undefined : "warn" as const })),
    ...lead.appointments.map(a => ({ at: a.startAt, icon: CalendarClock, title: a.status === "CONFIRMED" ? "Meeting" : `Meeting (${a.status.toLowerCase()})`, detail: `${when(a.startAt)}${a.location ? ` · ${a.location}` : ""}` })),
    ...lead.activities.map((a): Event => {
      if (a.kind === "STAGE_CHANGED") return { at: a.createdAt, icon: ArrowRightLeft, title: `${STAGE_LABEL[a.fromStatus ?? ""] ?? "—"} → ${STAGE_LABEL[a.toStatus ?? ""] ?? "—"}`, detail: a.body };
      if (a.kind === "EMAIL_SENT") return { at: a.createdAt, icon: Mail, title: `Follow-up sent: ${a.subject}`, body: a.body };
      if (a.kind === "EMAIL_FAILED") return { at: a.createdAt, icon: MailWarning, title: `Follow-up not delivered: ${a.subject}`, body: a.body, tone: "warn" };
      if (a.kind === "CONTACT_LOGGED") return { at: a.createdAt, icon: PhoneCall, title: "Contact logged", detail: a.body };
      return { at: a.createdAt, icon: NotebookPen, title: "Note", detail: a.body };
    }),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  const facts: [string, React.ReactNode][] = [
    ["Email", <a key="e" href={`mailto:${lead.email}`} className="break-all text-[var(--dash-accent)] hover:underline">{lead.email}</a>],
    ...(lead.companyName ? [["Company", lead.companyName] as [string, string]] : []),
    ...(lead.currentWebsite ? [["Website", <a key="w" href={/^https?:\/\//.test(lead.currentWebsite) ? lead.currentWebsite : `https://${lead.currentWebsite}`} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 break-all text-[var(--dash-accent)] hover:underline">{lead.currentWebsite}<ExternalLink className="size-3" aria-hidden /></a>] as [string, React.ReactNode]] : []),
    ["Source", `${SOURCE_LABEL[lead.source]}${lead.campaign ? ` · ${lead.campaign.name}` : ""}`],
    ...(lead.attribution?.landingPath ? [["Landed on", lead.attribution.landingPath] as [string, string]] : []),
    ...(lead.attribution?.utmSource ? [["Campaign tags", [lead.attribution.utmSource, lead.attribution.utmMedium, lead.attribution.utmCampaign].filter(Boolean).join(" / ")] as [string, string]] : []),
    ["Last contacted", lead.lastContactedAt ? when(lead.lastContactedAt) : "Not yet"],
  ];

  return <AdminShell active="clients">
    <div className="mb-8 mt-8 sm:mt-12">
      <Link href="/admin/clients" className="inline-flex min-h-10 items-center gap-2 text-sm text-[var(--dash-muted)] hover:text-[var(--dash-ink)]"><ArrowLeft className="size-4" aria-hidden />All clients<LinkPending /></Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-3xl font-medium tracking-tight sm:text-5xl">{lead.name}</h1>
          <p className="mt-2 text-sm text-[var(--dash-muted)]">{INTENT_LABEL[lead.intent]} · {PROJECT_LABEL[lead.projectType]} · received {day(lead.createdAt)}</p>
        </div>
        <StagePill status={lead.status} />
      </div>
    </div>

    {suggestion ? <p className={`mb-4 flex items-start gap-3 rounded-2xl border p-4 text-sm ${suggestion.overdue ? "border-[var(--dash-hi)]/40 bg-[var(--dash-hi)]/10" : "border-[var(--dash-line)] bg-[var(--dash-surface)]"}`}>
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-[var(--dash-accent)]" aria-hidden /><span><strong className="font-semibold">{suggestion.label}.</strong> {suggestion.reason}. A draft is ready below.</span>
    </p> : null}

    <div className="grid gap-4 lg:grid-cols-12">
      <div className="space-y-4 lg:col-span-8">
        <section className={card} aria-labelledby="compose-title">
          <h2 id="compose-title" className={title}>Follow-up email</h2><p className="mb-5 mt-1 text-xs text-[var(--dash-muted)]">Pick a draft, make it yours, then review and send. Nothing is sent automatically.</p>
          <FollowUpComposer id={lead.id} to={{ name: lead.name, email: lead.email }} drafts={drafts} suggested={suggestion?.key} emailReady={emailReady} open={open} isNew={lead.status === "NEW"} />
        </section>
        <section className={card} aria-labelledby="timeline-title">
          <h2 id="timeline-title" className={`${title} mb-5`}>Timeline</h2>
          <NoteForm id={lead.id} />
          <ol className="mt-8 space-y-0">
            {events.map((e, i) => <li key={i} className="relative flex gap-4 pb-6 last:pb-0">
              {i < events.length - 1 ? <span className="absolute left-[19px] top-10 h-[calc(100%-2.5rem)] w-px bg-[var(--dash-line)]" aria-hidden /> : null}
              <span className={`grid size-10 shrink-0 place-items-center rounded-full border ${e.tone === "warn" ? "border-[#ff9f90]/40 text-[#ffc7be]" : "border-[var(--dash-line-strong)] text-[var(--dash-accent)]"} bg-[var(--dash-surface)]`}><e.icon className="size-4" aria-hidden /></span>
              <div className="min-w-0 pt-1.5">
                <p className="text-sm text-[var(--dash-ink)]">{e.title}</p>
                <p className="mt-0.5 font-mono text-[11px] text-[var(--dash-muted)]">{when(e.at)}</p>
                {e.detail ? <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--dash-muted)]">{e.detail}</p> : null}
                {e.body ? <details className="mt-2 text-sm"><summary className="cursor-pointer text-[var(--dash-accent)]">Show message</summary><p className="mt-2 whitespace-pre-wrap rounded-2xl border border-[var(--dash-line)] p-4 text-[var(--dash-muted)]">{e.body}</p></details> : null}
              </div>
            </li>)}
          </ol>
        </section>
      </div>

      <div className="space-y-4 lg:col-span-4">
        <section className={card} aria-labelledby="contact-title">
          <h2 id="contact-title" className={`${title} mb-4`}>Contact</h2>
          <dl className="space-y-3 text-sm">{facts.map(([k, v]) => <div key={k}><dt className="text-xs text-[var(--dash-muted)]">{k}</dt><dd className="mt-0.5 text-[var(--dash-ink)]">{v}</dd></div>)}</dl>
        </section>
        <section className={card} aria-labelledby="request-title">
          <h2 id="request-title" className={`${title} mb-4`}>Their request</h2>
          <dl className="space-y-3 text-sm">
            <div><dt className="text-xs text-[var(--dash-muted)]">Project</dt><dd className="mt-0.5">{PROJECT_LABEL[lead.projectType]}{lead.websiteType ? ` · ${WEBSITE[lead.websiteType]}` : ""}{lead.serviceSlug ? ` · ${lead.serviceSlug.replace(/-/g, " ")}` : ""}</dd></div>
            <div><dt className="text-xs text-[var(--dash-muted)]">Goals</dt><dd className="mt-0.5 whitespace-pre-wrap leading-relaxed">{lead.projectGoals}</dd></div>
            {lead.additionalDetails ? <div><dt className="text-xs text-[var(--dash-muted)]">Details</dt><dd className="mt-0.5 whitespace-pre-wrap leading-relaxed">{lead.additionalDetails}</dd></div> : null}
          </dl>
          {lead.siteDraft ? <a href={`/build/preview/${lead.siteDraft.token}`} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex min-h-10 items-center gap-2 text-sm font-medium text-[var(--dash-accent)] hover:underline"><FileText className="size-4" aria-hidden />Open their site design<ExternalLink className="size-3" aria-hidden /></a> : null}
        </section>
        <section className={card} aria-labelledby="stage-title">
          <h2 id="stage-title" className={`${title} mb-4`}>Stage</h2>
          {open ? <StageForm id={lead.id} status={lead.status} options={[...MOVABLE]} /> : null}
          <div className={open ? "mt-6 border-t border-[var(--dash-line)] pt-5" : ""}><CloseOrReopen id={lead.id} closed={!open} canClose={lead.status !== "CONVERTED" && lead.appointments.length === 0} /></div>
        </section>
      </div>
    </div>
  </AdminShell>;
}
