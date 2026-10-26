import { Suspense, type CSSProperties, type ReactNode } from "react";
import { ArrowUpRight, BellRing, CalendarCheck2, CheckCircle2, Eye, Globe2, Layers, MousePointer2, Users } from "lucide-react";
import Link from "next/link";
import { LinkPending } from "@/components/admin/link-pending";
import { PROJECT_LABEL, SOURCE_LABEL } from "@/lib/admin-labels";
import type { BusinessReport, InsightsReport, PipelineReport, TrafficReport } from "@/server/analytics/report";
import { Delta, DeviceArc, Funnel, HourHeatmap, PipelineStages, RankedList, SERIES, Sparkline, TrafficChart } from "@/components/admin/analytics-charts";

const number = (value: number) => new Intl.NumberFormat("en").format(value);
export const card = "min-w-0 rounded-[28px] border border-[var(--dash-line)] bg-[var(--dash-surface)] p-5 sm:p-7";
const cardTitle = "font-heading text-base font-medium text-[var(--dash-ink)]";
const cardNote = "mt-1 text-xs text-[var(--dash-muted)]";
// Dashboard surface in the site's Ember palette (src/lib/themes.ts): #171010 page, #362222 raised, rose accent. Charts in analytics-charts.tsx are validated against it.
export const dashboardTheme = { "--dash-bg": "#171010", "--dash-surface": "#211716", "--dash-raised": "#362222", "--dash-line": "rgb(243 234 230 / 0.09)", "--dash-line-strong": "rgb(243 234 230 / 0.2)", "--dash-ink": "#f3eae6", "--dash-muted": "#bdb1ab", "--dash-accent": "#f0c3b7", "--dash-mark": "#d66b5c", "--dash-hi": "#e8afa1", "--dash-on-hi": "#171010" } as CSSProperties;
const manilaDay = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
export function greeting(now: Date) {
  const hour = Number(new Intl.DateTimeFormat("en", { timeZone: "Asia/Manila", hour: "numeric", hourCycle: "h23" }).format(now));
  return hour < 12 ? "Good morning," : hour < 18 ? "Good afternoon," : "Good evening,";
}
// PostHog only returns days with traffic; fill the gaps so every day of the window has a bar.
function fillDays(report: TrafficReport, days: 7 | 30 | 90) {
  const anchor = new Date(`${manilaDay(new Date(report.updatedAt))}T00:00:00+08:00`);
  return Array.from({ length: days }, (_, i) => {
    const day = manilaDay(new Date(anchor.getTime() - (days - 1 - i) * 86400_000));
    return report.trend.find(row => row.day === day) ?? { day, views: 0, visitors: 0 };
  });
}
function Stat({ label, value, display, previous, days, note, icon: Icon, children }: { label: string; value?: number; display?: string; previous?: number; days: number; note: string; icon: typeof Eye; children?: ReactNode }) {
  return <div className={`${card} flex flex-col`}>
    <div className="flex items-start justify-between gap-3"><div><p className={cardTitle}>{label}</p><p className={cardNote}>{note}</p></div><span className="grid size-10 shrink-0 place-items-center rounded-full border border-[var(--dash-line)]"><Icon className="size-4 text-[var(--dash-accent)]" aria-hidden /></span></div>
    <p className="mt-6 font-heading text-5xl font-light tracking-tight tabular-nums text-[var(--dash-ink)] sm:text-6xl">{value === undefined ? "—" : display ?? number(value)}</p>
    {value === undefined ? null : <Delta current={value} previous={previous} days={days} />}
    <div className="mt-auto">{children}</div>
  </div>;
}
const Unavailable = ({ connected }: { connected: boolean }) => <p className="py-6 text-sm text-[var(--dash-muted)]">{connected ? "Temporarily unavailable. Try refreshing shortly." : "Needs PostHog reporting to be connected."}</p>;
const CHANNEL: Record<string, string> = { direct: "Direct", search: "Search engines", social: "Social media", external: "Other websites" };
const PLACEMENT: Record<string, string> = { inquiry: "Inquiry", consultation: "Consultation", meeting: "Meeting", service: "Service pages", builder: "Site builder", footer: "Footer", other: "Other" };
const Footnote = ({ children }: { children: ReactNode }) => <p className="mt-6 border-t border-[var(--dash-line)] pt-4 font-mono text-xs text-[var(--dash-muted)]">{children}</p>;
/** Card-shaped placeholder shown while that card's data loads. */
export function CardSkeleton({ className = "", lines = 3, tall = false }: { className?: string; lines?: number; tall?: boolean }) {
  return <div className={`${card} ${className}`} aria-hidden>
    <div className="h-4 w-32 rounded-full bg-white/[0.07] motion-safe:animate-pulse" />
    <div className="mt-2 h-3 w-48 rounded-full bg-white/[0.05] motion-safe:animate-pulse" />
    <div className={`mt-6 rounded-2xl bg-white/[0.04] motion-safe:animate-pulse ${tall ? "h-56 sm:h-64" : "h-14"}`} />
    {Array.from({ length: lines }, (_, i) => <div key={i} className="mt-3 h-3 rounded-full bg-white/[0.04] motion-safe:animate-pulse" style={{ width: `${88 - i * 14}%` }} />)}
  </div>;
}

export type ReportData = { web: Promise<TrafficReport | undefined>; sales: Promise<BusinessReport | undefined>; insights: Promise<InsightsReport | undefined>; pipeline: Promise<PipelineReport | undefined> };
type Props = { days: 7 | 30 | 90; data: ReportData; connected: boolean };
const perSession = (t: { views: number; sessions: number }) => t.sessions ? t.views / t.sessions : 0;
const notice = "mb-5 rounded-2xl border border-[var(--dash-line)] bg-[var(--dash-surface)] p-5 text-sm text-[var(--dash-muted)]";

async function Notices({ data, connected }: Props) {
  const [web, sales] = await Promise.all([data.web, data.sales]);
  return <>
    {!web ? <div role="status" className={notice}>{connected ? "Traffic analytics is temporarily unavailable. Try refreshing shortly. Business totals are loaded separately." : "Traffic reporting is not connected yet. Configure POSTHOG_PROJECT_ID and POSTHOG_PERSONAL_API_KEY with project query-read permission on the server."}</div> : null}
    {!sales ? <p role="status" className={notice}>Business totals are temporarily unavailable. Please try again shortly.</p> : null}
  </>;
}
async function TrafficTotals({ days, data }: Props) {
  const web = await data.web;
  const trend = web ? fillDays(web, days) : [];
  return <section aria-label="Traffic totals" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <Stat label="Visitors" value={web?.totals.visitors} previous={web?.previous.visitors} days={days} note="Consenting browsers, linked identities merged" icon={Users}><Sparkline values={trend.map(d => d.visitors)} color={SERIES[1]} /></Stat>
    <Stat label="Pageviews" value={web?.totals.views} previous={web?.previous.views} days={days} note="Marketing and builder page visits" icon={Eye}><Sparkline values={trend.map(d => d.views)} /></Stat>
    <Stat label="Sessions" value={web?.totals.sessions} previous={web?.previous.sessions} days={days} note="Split by 30 minutes of inactivity" icon={MousePointer2}>{web?.totals.visitors ? <Footnote>{(web.totals.sessions / web.totals.visitors).toFixed(1)} sessions per visitor</Footnote> : null}</Stat>
    <Stat label="Pages per session" value={web ? perSession(web.totals) : undefined} display={web ? perSession(web.totals).toFixed(1) : undefined} previous={web ? perSession(web.previous) : undefined} days={days} note="How far a typical visit goes" icon={Layers}>{web ? <Footnote>{number(web.totals.views)} pageviews ÷ {number(web.totals.sessions)} sessions</Footnote> : null}</Stat>
  </section>;
}
async function TrendAndDevices({ days, data }: Props) {
  const web = await data.web;
  if (!web) return null;
  const trend = fillDays(web, days);
  return <div className="mt-4 grid gap-4 lg:grid-cols-12">
    <section className={`${card} lg:col-span-8`} aria-labelledby="trend-title">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><h2 id="trend-title" className={cardTitle}>Traffic over time</h2><p className={cardNote}>Daily · Asia/Manila · last {days} days</p></div><p className="font-heading text-4xl font-light tabular-nums text-[var(--dash-ink)]">{number(web.totals.views)}<span className="ml-2 font-body text-xs text-[var(--dash-muted)]">pageviews</span></p></div>
      <TrafficChart data={trend} />
      <details className="mt-6 text-sm"><summary className="cursor-pointer font-medium text-[var(--dash-accent)]">View daily numbers</summary><div className="mt-3 max-h-56 overflow-auto"><table className="w-full text-left text-sm text-[var(--dash-ink)]"><thead className="text-[var(--dash-muted)]"><tr><th className="py-2 font-normal">Date</th><th className="py-2 text-right font-normal">Pageviews</th><th className="py-2 text-right font-normal">Visitors</th></tr></thead><tbody className="font-mono text-xs">{trend.map(row => <tr key={row.day} className="border-t border-[var(--dash-line)]"><td className="py-2">{row.day}</td><td className="text-right">{number(row.views)}</td><td className="text-right">{number(row.visitors)}</td></tr>)}</tbody></table></div></details>
    </section>
    <section className={`${card} lg:col-span-4`} aria-labelledby="devices-title"><h2 id="devices-title" className={cardTitle}>Devices</h2><p className={`${cardNote} mb-6`}>Share of pageviews</p><DeviceArc rows={web.devices} /></section>
  </div>;
}
async function FunnelCard({ data, connected }: Props) {
  const insights = await data.insights;
  return <section className={`${card} lg:col-span-7`} aria-labelledby="funnel-title">
    <h2 id="funnel-title" className={cardTitle}>From visit to inquiry</h2><p className={`${cardNote} mb-6`}>Consenting people who reached each step in this period</p>
    {insights ? <Funnel steps={insights.funnel} /> : <Unavailable connected={connected} />}
  </section>;
}
async function PipelineCard({ data }: Props) {
  const pipeline = await data.pipeline;
  return <section className={`${card} lg:col-span-5`} aria-labelledby="pipeline-title">
    <h2 id="pipeline-title" className={cardTitle}>Inquiry pipeline</h2><p className={`${cardNote} mb-6`}>Every open inquiry right now, by stage</p>
    {pipeline ? <>
      {pipeline.waiting ? <p className="mb-6 flex items-start gap-3 rounded-2xl border border-[var(--dash-hi)]/30 bg-[var(--dash-hi)]/10 p-4 text-sm text-[var(--dash-ink)]"><BellRing className="mt-0.5 size-4 shrink-0 text-[var(--dash-accent)]" aria-hidden /><span><strong className="font-semibold">{number(pipeline.waiting)} {pipeline.waiting === 1 ? "inquiry is" : "inquiries are"} waiting for a first reply.</strong>{pipeline.oldestWaitingDays !== null ? ` The oldest arrived ${pipeline.oldestWaitingDays === 0 ? "today" : `${pipeline.oldestWaitingDays} ${pipeline.oldestWaitingDays === 1 ? "day" : "days"} ago`}.` : ""}</span></p> : <p className="mb-6 flex items-center gap-3 rounded-2xl border border-[var(--dash-line)] p-4 text-sm text-[var(--dash-muted)]"><CheckCircle2 className="size-4 shrink-0 text-[var(--dash-accent)]" aria-hidden />No inquiries waiting for a first reply.</p>}
      <PipelineStages stages={pipeline.stages} />
      <Link href="/admin/clients" className="mt-6 inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-[var(--dash-accent)] hover:underline">Open the client tracker<ArrowUpRight className="size-4" aria-hidden /><LinkPending /></Link>
    </> : <p className="text-sm text-[var(--dash-muted)]">The pipeline is temporarily unavailable.</p>}
  </section>;
}
async function HoursCard({ data }: Props) {
  const insights = await data.insights;
  return <section className={`${card} lg:col-span-8`} aria-labelledby="hours-title"><h2 id="hours-title" className={cardTitle}>When people visit</h2><p className={`${cardNote} mb-4`}>Pageviews by weekday and hour · Asia/Manila</p>{insights ? <HourHeatmap cells={insights.hours} /> : <Unavailable connected />}</section>;
}
async function ChannelsCard({ data }: Props) {
  const insights = await data.insights;
  return <section className={`${card} lg:col-span-4`} aria-labelledby="channels-title"><h2 id="channels-title" className={cardTitle}>How they found you</h2><p className={`${cardNote} mb-5`}>Visitors by latest channel</p>{insights ? <RankedList rows={insights.channels.map(c => ({ name: CHANNEL[c.name] ?? c.name, views: c.people }))} label="Channel" valueLabel="People" empty="No recorded visits in this period." /> : <Unavailable connected />}</section>;
}
async function BusinessCard({ days, data, connected }: Props) {
  const [sales, pipeline] = await Promise.all([data.sales, data.pipeline]);
  return <section className={`${card} ${connected ? "lg:col-span-7" : "lg:col-span-12"}`} aria-labelledby="business-title">
    <h2 id="business-title" className={cardTitle}>Conversations started</h2><p className={cardNote}>Saved records, including requests made without analytics consent</p>
    <dl aria-label="Business totals" className="mt-6 grid gap-6 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-[var(--dash-line)]">
      {([["Inquiries", "inquiries", ArrowUpRight, "Including meeting requests by email"], ["Introductions", "introductions", Globe2, "Referral introductions"], ["Confirmed bookings", "confirmedBookings", CalendarCheck2, "Currently confirmed, by booking date"]] as const).map(([label, key, Icon, note]) => <div key={key} className="sm:px-6 sm:first:pl-0 sm:last:pr-0">
        <dt className="flex items-center gap-2 text-sm text-[var(--dash-ink)]"><Icon className="size-4 text-[var(--dash-accent)]" aria-hidden />{label}</dt>
        <dd className="mt-4 font-heading text-5xl font-light tabular-nums text-[var(--dash-ink)]">{sales ? number(sales[key]) : "—"}</dd>
        <dd>{sales ? <Delta current={sales[key]} previous={sales.previous[key]} days={days} /> : null}</dd>
        <dd className="mt-2 text-xs text-[var(--dash-muted)]">{note}</dd>
      </div>)}
    </dl>
    {pipeline && (pipeline.projectTypes.length || pipeline.sources.length) ? <div className="mt-8 grid gap-6 border-t border-[var(--dash-line)] pt-6 sm:grid-cols-2">
      <div><h3 className="mb-4 text-sm text-[var(--dash-ink)]">What they asked for</h3><RankedList rows={pipeline.projectTypes.map(r => ({ name: PROJECT_LABEL[r.name] ?? r.name, views: r.count }))} label="Project" valueLabel="Inquiries" empty="No inquiries in this period." /></div>
      <div><h3 className="mb-4 text-sm text-[var(--dash-ink)]">Where inquiries came from</h3><RankedList rows={pipeline.sources.map(r => ({ name: SOURCE_LABEL[r.name] ?? r.name, views: r.count }))} label="Source" valueLabel="Inquiries" empty="No inquiries in this period." /></div>
    </div> : null}
  </section>;
}
async function CtaCard({ data }: Props) {
  const insights = await data.insights;
  return <section className={`${card} lg:col-span-5`} aria-labelledby="cta-title"><h2 id="cta-title" className={cardTitle}>Calls to action</h2><p className={`${cardNote} mb-5`}>Clicks by button placement</p>{insights ? <RankedList rows={insights.ctas.map(c => ({ name: PLACEMENT[c.name] ?? c.name, views: c.clicks }))} label="Placement" valueLabel="Clicks" empty="No call-to-action clicks in this period." /> : <Unavailable connected />}</section>;
}
async function PagesAndSources({ data }: Props) {
  const web = await data.web;
  if (!web) return null;
  return <div className="mt-4 grid gap-4 lg:grid-cols-12">
    <section className={`${card} lg:col-span-7`} aria-labelledby="pages-title"><h2 id="pages-title" className={`${cardTitle} mb-5`}>Popular pages</h2><RankedList rows={web.pages} label="Page" /></section>
    <section className={`${card} lg:col-span-5`} aria-labelledby="sources-title"><h2 id="sources-title" className={`${cardTitle} mb-5`}>Traffic sources</h2><RankedList rows={web.sources} label="Latest source" /></section>
  </div>;
}
async function DwellCard({ data }: Props) {
  const insights = await data.insights;
  return insights?.dwell.length ? <section className={`${card} mt-4`} aria-labelledby="dwell-title"><h2 id="dwell-title" className={cardTitle}>Time on page</h2><p className={`${cardNote} mb-5`}>Median time before leaving, for the most-read pages</p><RankedList rows={insights.dwell.map(d => ({ name: d.name, views: d.seconds }))} label="Page" valueLabel="Median" unit="seconds" share={false} /></section> : null;
}
async function Snapshot({ data }: Props) {
  const web = await data.web;
  return web ? <> Traffic snapshot: {new Intl.DateTimeFormat("en", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }).format(new Date(web.updatedAt))}, refreshed at most once per minute.</> : null;
}

/**
 * Signed-in report view. Each card waits only for its own source, behind its own skeleton, so database-backed cards
 * appear without waiting for PostHog. A missing source degrades only the cards that use it.
 */
export function OwnerReports(props: Props) {
  const { connected } = props;
  return <>
    <Suspense fallback={null}><Notices {...props} /></Suspense>
    <Suspense fallback={<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map(i => <CardSkeleton key={i} lines={1} />)}</div>}><TrafficTotals {...props} /></Suspense>
    {connected ? <Suspense fallback={<div className="mt-4 grid gap-4 lg:grid-cols-12"><CardSkeleton className="lg:col-span-8" tall /><CardSkeleton className="lg:col-span-4" tall /></div>}><TrendAndDevices {...props} /></Suspense> : null}
    <div className="mt-4 grid gap-4 lg:grid-cols-12">
      <Suspense fallback={<CardSkeleton className="lg:col-span-7" lines={5} />}><FunnelCard {...props} /></Suspense>
      <Suspense fallback={<CardSkeleton className="lg:col-span-5" lines={4} />}><PipelineCard {...props} /></Suspense>
    </div>
    {connected ? <div className="mt-4 grid gap-4 lg:grid-cols-12">
      <Suspense fallback={<CardSkeleton className="lg:col-span-8" tall />}><HoursCard {...props} /></Suspense>
      <Suspense fallback={<CardSkeleton className="lg:col-span-4" lines={4} />}><ChannelsCard {...props} /></Suspense>
    </div> : null}
    <div className="mt-4 grid gap-4 lg:grid-cols-12">
      <Suspense fallback={<CardSkeleton className={connected ? "lg:col-span-7" : "lg:col-span-12"} lines={4} />}><BusinessCard {...props} /></Suspense>
      {connected ? <Suspense fallback={<CardSkeleton className="lg:col-span-5" lines={4} />}><CtaCard {...props} /></Suspense> : null}
    </div>
    {connected ? <Suspense fallback={<div className="mt-4 grid gap-4 lg:grid-cols-12"><CardSkeleton className="lg:col-span-7" lines={5} /><CardSkeleton className="lg:col-span-5" lines={5} /></div>}><PagesAndSources {...props} /></Suspense> : null}
    {connected ? <Suspense fallback={null}><DwellCard {...props} /></Suspense> : null}
    <p className="mt-6 max-w-3xl text-xs leading-relaxed text-[var(--dash-muted)]">Traffic covers consenting visitors and delivered events. Business totals come from saved database records, including requests made without analytics consent. Deleted records are excluded. Inquiries and bookings can overlap; they are not distinct customer counts. Changes compare with the equally long period just before this one. The funnel counts consenting people per step, so later steps can include people whose earlier steps fell outside this period.<Suspense fallback={null}><Snapshot {...props} /></Suspense></p>
  </>;
}
