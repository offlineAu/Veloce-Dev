import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, CalendarClock, ChevronRight, Search } from "lucide-react";
import type { LeadStatus } from "@/generated/prisma/client";
import { isOwner } from "@/server/admin/session";
import { listClients, PAGE_SIZE, STAGES } from "@/server/clients/tracker";
import { AdminShell } from "@/components/admin/admin-shell";
import { card } from "@/components/admin/analytics-dashboard";
import { StagePill } from "@/components/admin/client-parts";
import { INTENT_LABEL, PROJECT_LABEL, STAGE_LABEL } from "@/lib/admin-labels";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Clients", robots: { index: false, follow: false }, referrer: "no-referrer" };

const FILTERS = ["ATTENTION", "OPEN", ...STAGES] as const;
type Filter = (typeof FILTERS)[number];
const filterLabel = (f: Filter) => f === "ATTENTION" ? "Needs attention" : f === "OPEN" ? "All open" : STAGE_LABEL[f] ?? f;
const date = (d: Date) => new Intl.DateTimeFormat("en", { timeZone: "Asia/Manila", month: "short", day: "numeric" }).format(d);
const ago = (d: Date, now: Date) => { const days = Math.floor((now.getTime() - d.getTime()) / 86_400_000); return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`; };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ stage?: string; q?: string; page?: string }> }) {
  if (!await isOwner()) redirect("/admin/analytics?next=/admin/clients");
  const params = await searchParams;
  const stage: Filter = FILTERS.includes(params.stage as Filter) ? params.stage as Filter : "OPEN";
  const q = (params.q ?? "").slice(0, 100);
  const now = new Date();
  const requested = Math.min(10_000, Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1));
  const { rows, counts, attention, total, page, pages } = await listClients({ stage: stage as LeadStatus | "OPEN" | "ATTENTION", q, page: requested }, now);
  const open = counts.NEW + counts.CONTACTED + counts.CONSULTATION_SCHEDULED + counts.PROPOSAL_IN_PROGRESS;
  const count = (f: Filter) => f === "ATTENTION" ? attention : f === "OPEN" ? open : counts[f];
  const href = (f: Filter, p = 1) => `/admin/clients?stage=${f}${q ? `&q=${encodeURIComponent(q)}` : ""}${p > 1 ? `&page=${p}` : ""}`;
  return <AdminShell active="clients" attention={attention}>
    <div className="mb-8 mt-10 flex flex-wrap items-end justify-between gap-6 sm:mt-14">
      <div><p className="text-sm text-[var(--dash-muted)]">Client tracker</p><h1 className="mt-2 font-heading text-3xl font-medium tracking-tight sm:text-5xl">Every conversation, in one place.</h1></div>
      <form role="search" className="flex min-h-11 w-full items-center gap-2 rounded-full border border-[var(--dash-line)] bg-[var(--dash-surface)] pl-4 pr-1 focus-within:border-[var(--dash-hi)] sm:w-80">
        <Search className="size-4 shrink-0 text-[var(--dash-muted)]" aria-hidden />
        <input type="hidden" name="stage" value={stage} />
        <label htmlFor="client-search" className="sr-only">Search clients</label>
        <input id="client-search" name="q" defaultValue={q} placeholder="Name, email or company" className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--dash-muted)]" />
        <button type="submit" className="min-h-9 rounded-full px-3 text-sm text-[var(--dash-ink)] hover:bg-white/[0.06]">Search</button>
      </form>
    </div>

    <section aria-label="Pipeline summary" className="grid grid-cols-3 gap-2 sm:gap-4">
      {([["Needs attention", attention, "Overdue for a reply or follow-up", "ATTENTION"], ["Open inquiries", open, "New, contacted, consultation or proposal", "OPEN"], ["Won", counts.CONVERTED, "Inquiries that became clients", "CONVERTED"]] as const).map(([label, value, note, f]) =>
        <Link key={label} href={href(f)} className={`${card} group !p-4 transition-colors hover:border-[var(--dash-line-strong)] sm:!p-7`}>
          <p className="text-xs text-[var(--dash-ink)] sm:text-sm">{label}</p><p className="mt-1 hidden text-xs text-[var(--dash-muted)] sm:block">{note}</p>
          <p className={`mt-3 font-heading text-3xl font-light tabular-nums sm:mt-5 sm:text-5xl ${f === "ATTENTION" && value ? "text-[var(--dash-hi)]" : "text-[var(--dash-ink)]"}`}>{value.toLocaleString("en")}</p>
        </Link>)}
    </section>

    <nav aria-label="Filter by stage" className="-mx-4 mt-8 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      <div className="flex w-max gap-1 rounded-full border border-[var(--dash-line)] bg-[var(--dash-surface)] p-1">
        {FILTERS.map(f => <Link key={f} href={href(f)} aria-current={stage === f ? "page" : undefined} className={`inline-flex min-h-9 items-center gap-2 whitespace-nowrap rounded-full px-3.5 text-sm transition-colors ${stage === f ? "bg-[var(--dash-hi)] font-medium text-[var(--dash-on-hi)]" : "text-[var(--dash-muted)] hover:bg-white/[0.06] hover:text-[var(--dash-ink)]"}`}>
          {filterLabel(f)}<span className={`font-mono text-[11px] ${stage === f ? "" : "text-[var(--dash-muted)]"}`}>{count(f)}</span>
        </Link>)}
      </div>
    </nav>

    <section aria-label="Clients" className={`${card} mt-4 !p-0`}>
      {rows.length ? <ul className="divide-y divide-[var(--dash-line)]">
        {rows.map(row => <li key={row.id}>
          <Link href={`/admin/clients/${row.id}`} className="group grid gap-3 px-5 py-4 transition-colors hover:bg-white/[0.03] sm:px-7 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.3fr)_auto] md:items-center">
            <div className="min-w-0">
              <p className="truncate font-medium text-[var(--dash-ink)]">{row.name}{row.companyName ? <span className="font-normal text-[var(--dash-muted)]"> · {row.companyName}</span> : null}</p>
              <p className="mt-0.5 truncate text-xs text-[var(--dash-muted)]">{INTENT_LABEL[row.intent]} · {PROJECT_LABEL[row.projectType]} · {date(row.createdAt)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2"><StagePill status={row.status} />{row.nextCall ? <span className="inline-flex items-center gap-1 text-xs text-[var(--dash-muted)]"><CalendarClock className="size-3.5" aria-hidden />{date(row.nextCall)}</span> : null}</div>
            <div className="min-w-0 text-xs">
              {row.suggestion ? <p className={`flex items-center gap-1.5 ${row.suggestion.overdue ? "text-[var(--dash-hi)]" : "text-[var(--dash-ink)]"}`}>{row.suggestion.overdue ? <AlertCircle className="size-3.5 shrink-0" aria-hidden /> : null}<span className="truncate">{row.suggestion.label} · {row.suggestion.reason}</span></p> : <p className="text-[var(--dash-muted)]">No follow-up due</p>}
              <p className="mt-0.5 text-[var(--dash-muted)]">{row.lastContactedAt ? `Last contacted ${ago(row.lastContactedAt, now)}` : "Not contacted yet"}</p>
            </div>
            <ChevronRight className="hidden size-4 text-[var(--dash-muted)] transition-transform group-hover:translate-x-0.5 md:block" aria-hidden />
          </Link>
        </li>)}
      </ul> : <div className="px-7 py-16 text-center">
        <p className="font-heading text-xl text-[var(--dash-ink)]">{q ? "No matches" : stage === "ATTENTION" ? "You're all caught up" : "Nothing here yet"}</p>
        <p className="mt-2 text-sm text-[var(--dash-muted)]">{q ? `No inquiries match "${q}" in ${filterLabel(stage).toLowerCase()}.` : stage === "ATTENTION" ? "No inquiry is overdue for a reply or follow-up." : "Inquiries from the site will appear here as they arrive."}</p>
      </div>}
      {total > PAGE_SIZE ? <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--dash-line)] px-5 py-4 text-sm sm:px-7">
        <span className="text-[var(--dash-muted)]">Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString("en")}</span>
        <span className="flex gap-2">
          {page > 1 ? <Link href={href(stage, page - 1)} className="inline-flex min-h-10 items-center rounded-full border border-[var(--dash-line)] px-4 hover:bg-white/[0.06]">Previous</Link> : null}
          {page < pages ? <Link href={href(stage, page + 1)} className="inline-flex min-h-10 items-center rounded-full border border-[var(--dash-line)] px-4 hover:bg-white/[0.06]">Next</Link> : null}
        </span>
      </nav> : null}
    </section>
    <p className="mt-6 max-w-3xl text-xs leading-relaxed text-[var(--dash-muted)]">Follow-ups are drafted for you and only sent when you press Send. They are about each person&apos;s own inquiry; the privacy notice promises no mailing list. Closed inquiries are deleted after the retention period unless reopened.</p>
  </AdminShell>;
}
