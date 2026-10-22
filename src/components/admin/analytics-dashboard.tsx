import type { CSSProperties, ReactNode } from "react";
import { ArrowUpRight, CalendarCheck2, Eye, Globe2, Layers, MousePointer2, Users } from "lucide-react";
import type { BusinessReport, TrafficReport } from "@/server/analytics/report";
import { Delta, DeviceArc, RankedList, SERIES, Sparkline, TrafficChart, WeekdayDots } from "@/components/admin/analytics-charts";

const number = (value: number) => new Intl.NumberFormat("en").format(value);
export const card = "rounded-[28px] border border-[var(--dash-line)] bg-[var(--dash-surface)] p-5 sm:p-7";
const cardTitle = "font-heading text-base font-medium text-[var(--dash-ink)]";
const cardNote = "mt-1 text-xs text-[var(--dash-muted)]";
// Dashboard-only dark surface, built from the brand ink and accent. Charts in analytics-charts.tsx are validated against it.
export const dashboardTheme = { "--dash-bg": "#141110", "--dash-surface": "#1d1916", "--dash-line": "rgb(245 234 216 / 0.09)", "--dash-line-strong": "rgb(245 234 216 / 0.2)", "--dash-ink": "#f5ead8", "--dash-muted": "rgb(245 234 216 / 0.62)" } as CSSProperties;
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
    <div className="flex items-start justify-between gap-3"><div><p className={cardTitle}>{label}</p><p className={cardNote}>{note}</p></div><span className="grid size-10 shrink-0 place-items-center rounded-full border border-[var(--dash-line)]"><Icon className="size-4 text-[#f3a877]" aria-hidden /></span></div>
    <p className="mt-6 font-heading text-5xl font-light tracking-tight tabular-nums text-[var(--dash-ink)] sm:text-6xl">{value === undefined ? "—" : display ?? number(value)}</p>
    {value === undefined ? null : <Delta current={value} previous={previous} days={days} />}
    <div className="mt-auto">{children}</div>
  </div>;
}
const Footnote = ({ children }: { children: ReactNode }) => <p className="mt-6 border-t border-[var(--dash-line)] pt-4 font-mono text-xs text-[var(--dash-muted)]">{children}</p>;
/** Signed-in report view. Either report may be missing when its source is unavailable; each section degrades on its own. */
export function OwnerReports({ days, web, sales, connected }: { days: 7 | 30 | 90; web?: TrafficReport; sales?: BusinessReport; connected: boolean }) {
  const trend = web ? fillDays(web, days) : [];
  const perSession = (t: { views: number; sessions: number }) => t.sessions ? t.views / t.sessions : 0;
  const notice = "mb-5 rounded-2xl border border-[var(--dash-line)] bg-[var(--dash-surface)] p-5 text-sm text-[var(--dash-muted)]";
  return <>
    {!web ? <div role="status" className={notice}>{connected ? "Traffic analytics is temporarily unavailable. Try refreshing shortly. Business totals are loaded separately." : "Traffic reporting is not connected yet. Configure POSTHOG_PROJECT_ID and POSTHOG_PERSONAL_API_KEY with project query-read permission on the server."}</div> : null}
    {!sales ? <p role="status" className={notice}>Business totals are temporarily unavailable. Please try again shortly.</p> : null}
    <section aria-label="Traffic totals" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Stat label="Visitors" value={web?.totals.visitors} previous={web?.previous.visitors} days={days} note="Consenting browsers, linked identities merged" icon={Users}><Sparkline values={trend.map(d => d.visitors)} color={SERIES[1]} /></Stat>
      <Stat label="Pageviews" value={web?.totals.views} previous={web?.previous.views} days={days} note="Marketing and builder page visits" icon={Eye}><Sparkline values={trend.map(d => d.views)} /></Stat>
      <Stat label="Sessions" value={web?.totals.sessions} previous={web?.previous.sessions} days={days} note="Split by 30 minutes of inactivity" icon={MousePointer2}>{web?.totals.visitors ? <Footnote>{(web.totals.sessions / web.totals.visitors).toFixed(1)} sessions per visitor</Footnote> : null}</Stat>
      <Stat label="Pages per session" value={web ? perSession(web.totals) : undefined} display={web ? perSession(web.totals).toFixed(1) : undefined} previous={web ? perSession(web.previous) : undefined} days={days} note="How far a typical visit goes" icon={Layers}>{web ? <Footnote>{number(web.totals.views)} pageviews ÷ {number(web.totals.sessions)} sessions</Footnote> : null}</Stat>
    </section>
    {web ? <div className="mt-4 grid gap-4 lg:grid-cols-12">
      <section className={`${card} lg:col-span-8`} aria-labelledby="trend-title">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><h2 id="trend-title" className={cardTitle}>Traffic over time</h2><p className={cardNote}>Daily · Asia/Manila · last {days} days</p></div><p className="font-heading text-4xl font-light tabular-nums text-[var(--dash-ink)]">{number(web.totals.views)}<span className="ml-2 font-body text-xs text-[var(--dash-muted)]">pageviews</span></p></div>
        <TrafficChart data={trend} />
        <details className="mt-6 text-sm"><summary className="cursor-pointer font-medium text-[#f3a877]">View daily numbers</summary><div className="mt-3 max-h-56 overflow-auto"><table className="w-full text-left text-sm text-[var(--dash-ink)]"><thead className="text-[var(--dash-muted)]"><tr><th className="py-2 font-normal">Date</th><th className="py-2 text-right font-normal">Pageviews</th><th className="py-2 text-right font-normal">Visitors</th></tr></thead><tbody className="font-mono text-xs">{trend.map(row => <tr key={row.day} className="border-t border-[var(--dash-line)]"><td className="py-2">{row.day}</td><td className="text-right">{number(row.views)}</td><td className="text-right">{number(row.visitors)}</td></tr>)}</tbody></table></div></details>
      </section>
      <section className={`${card} lg:col-span-4`} aria-labelledby="devices-title"><h2 id="devices-title" className={cardTitle}>Devices</h2><p className={`${cardNote} mb-6`}>Share of pageviews</p><DeviceArc rows={web.devices} /></section>
    </div> : null}
    <div className="mt-4 grid gap-4 lg:grid-cols-12">
      <section className={`${card} ${web ? "lg:col-span-7" : "lg:col-span-12"}`} aria-labelledby="business-title">
        <h2 id="business-title" className={cardTitle}>Conversations started</h2><p className={cardNote}>Saved records, including requests made without analytics consent</p>
        <dl aria-label="Business totals" className="mt-6 grid gap-6 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-[var(--dash-line)]">
          {([["Inquiries", "inquiries", ArrowUpRight, "Including meeting requests by email"], ["Introductions", "introductions", Globe2, "Referral introductions"], ["Confirmed bookings", "confirmedBookings", CalendarCheck2, "Currently confirmed, by booking date"]] as const).map(([label, key, Icon, note]) => <div key={key} className="sm:px-6 sm:first:pl-0 sm:last:pr-0">
            <dt className="flex items-center gap-2 text-sm text-[var(--dash-ink)]"><Icon className="size-4 text-[#f3a877]" aria-hidden />{label}</dt>
            <dd className="mt-4 font-heading text-5xl font-light tabular-nums text-[var(--dash-ink)]">{sales ? number(sales[key]) : "—"}</dd>
            <dd>{sales ? <Delta current={sales[key]} previous={sales.previous[key]} days={days} /> : null}</dd>
            <dd className="mt-2 text-xs text-[var(--dash-muted)]">{note}</dd>
          </div>)}
        </dl>
      </section>
      {web ? <section className={`${card} lg:col-span-5`} aria-labelledby="weekday-title"><h2 id="weekday-title" className={cardTitle}>Busiest days</h2><p className={`${cardNote} mb-4`}>Average pageviews by weekday</p><WeekdayDots data={trend} /></section> : null}
    </div>
    {web ? <div className="mt-4 grid gap-4 lg:grid-cols-12">
      <section className={`${card} lg:col-span-7`} aria-labelledby="pages-title"><h2 id="pages-title" className={`${cardTitle} mb-5`}>Popular pages</h2><RankedList rows={web.pages} label="Page" /></section>
      <section className={`${card} lg:col-span-5`} aria-labelledby="sources-title"><h2 id="sources-title" className={`${cardTitle} mb-5`}>Traffic sources</h2><RankedList rows={web.sources} label="Latest source" /></section>
    </div> : null}
    <p className="mt-6 max-w-3xl text-xs leading-relaxed text-[var(--dash-muted)]">Traffic covers consenting visitors and delivered events. Business totals come from saved database records, including requests made without analytics consent. Deleted records are excluded. Inquiries and bookings can overlap; they are not distinct customer counts. Changes compare with the equally long period just before this one.{web ? ` Traffic snapshot: ${new Intl.DateTimeFormat("en", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }).format(new Date(web.updatedAt))}, refreshed at most once per minute.` : ""}</p>
  </>;
}
