import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, ArrowUpRight, BarChart3, CalendarCheck2, Eye, Globe2, MousePointer2, Users } from "lucide-react";
import { isOwner, ownerConfigured } from "@/server/admin/session";
import { getBusinessReport, getTrafficReport, queryConfig, reportDays, type TrafficReport } from "@/server/analytics/report";
import { OwnerLogin } from "@/components/admin/owner-login";
import { Button } from "@/components/ui/button";
import { ownerLogout, ownerLogoutAll } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Owner analytics", robots: { index: false, follow: false }, referrer: "no-referrer" };
const number = (value: number) => new Intl.NumberFormat("en").format(value);
const panel = "rounded-3xl border border-line bg-surface p-5 sm:p-7";
function Stat({ label, value, note, icon: Icon }: { label: string; value?: number; note: string; icon: typeof Eye }) {
  return <div className={panel}><div className="flex items-center justify-between gap-3"><span className="text-sm font-medium text-muted">{label}</span><Icon className="size-5 text-accent-700" aria-hidden /></div><p className="mt-4 font-heading text-4xl font-semibold tracking-tight">{value === undefined ? "—" : number(value)}</p><p className="mt-2 text-xs leading-relaxed text-muted">{note}</p></div>;
}
function Breakdown({ title, rows, label }: { title: string; rows: { name: string; views: number }[]; label: string }) {
  const total = rows.reduce((sum, row) => sum + row.views, 0);
  return <section className={panel}><h2 className="font-heading text-lg font-semibold">{title}</h2>{rows.length ? <table className="mt-5 w-full text-left text-sm"><thead><tr className="border-b border-line text-xs text-muted"><th className="pb-3 font-medium">{label}</th><th className="pb-3 text-right font-medium">Pageviews</th></tr></thead><tbody>{rows.map(row => <tr key={row.name} className="border-b border-line/60 last:border-0"><td className="max-w-48 py-3 pr-4"><div className="truncate" title={row.name}>{row.name}</div><div className="mt-2 h-1 overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full bg-accent-600" style={{ width: `${total ? row.views / total * 100 : 0}%` }} /></div></td><td className="py-3 text-right font-mono text-xs">{number(row.views)}</td></tr>)}</tbody></table> : <p className="py-8 text-sm text-muted">No recorded pageviews in this period.</p>}</section>;
}
function Trend({ report, days }: { report: TrafficReport; days: 7 | 30 | 90 }) {
  const end = new Date(report.updatedAt);
  const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(end);
  const anchor = new Date(`${localDate}T00:00:00+08:00`);
  const values = Array.from({ length: days }, (_, i) => {
    const date = new Date(anchor.getTime() - (days - 1 - i) * 86400_000);
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
    return report.trend.find(row => row.day === day) ?? { day, views: 0, visitors: 0 };
  });
  const max = Math.max(1, ...values.map(row => row.views));
  return <section className={`${panel} lg:col-span-2`}><div className="flex flex-wrap items-baseline justify-between gap-3"><h2 className="font-heading text-lg font-semibold">Traffic over time</h2><span className="text-xs text-muted">Daily pageviews · Asia/Manila</span></div>
    <div className="mt-8 flex h-44 items-end gap-1 border-b border-line" role="img" aria-label={`Daily pageviews over the last ${days} days. Total ${number(report.totals.views)}.`}>{values.map(row => <div key={row.day} className="group relative flex h-full min-w-0 flex-1 items-end"><div className="w-full rounded-t bg-accent-600 transition-colors group-hover:bg-accent-800" style={{ height: `${Math.max(row.views ? 2 : 0, row.views / max * 100)}%` }} title={`${row.day}: ${number(row.views)} pageviews, ${number(row.visitors)} visitors`} /></div>)}</div>
    <div className="mt-3 flex justify-between font-mono text-xs text-muted"><span>{values[0]?.day}</span><span>{values.at(-1)?.day}</span></div>
    <details className="mt-5 text-sm"><summary className="cursor-pointer font-medium text-accent-700">View daily numbers</summary><div className="mt-3 max-h-56 overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th className="py-2">Date</th><th className="py-2 text-right">Pageviews</th><th className="py-2 text-right">Visitors</th></tr></thead><tbody>{values.map(row => <tr key={row.day} className="border-t border-line"><td className="py-2">{row.day}</td><td className="text-right">{number(row.views)}</td><td className="text-right">{number(row.visitors)}</td></tr>)}</tbody></table></div></details>
  </section>;
}
async function Reports({ days }: { days: 7 | 30 | 90 }) {
  const [traffic, business] = await Promise.allSettled([getTrafficReport(days), getBusinessReport(days)]);
  const web = traffic.status === "fulfilled" ? traffic.value : undefined;
  const sales = business.status === "fulfilled" ? business.value : undefined;
  return <>
    {!web ? <div role="status" className="mb-6 rounded-2xl border border-line bg-accent-100 p-5 text-sm">{queryConfig() ? "Traffic analytics is temporarily unavailable. Try refreshing shortly. Business totals are loaded separately." : "Traffic reporting is not connected yet. Configure POSTHOG_PROJECT_ID and POSTHOG_PERSONAL_API_KEY with project query-read permission on the server."}</div> : null}
    {!sales ? <p role="status" className="mb-6 rounded-2xl border border-line p-5 text-sm">Business totals are temporarily unavailable. Please try again shortly.</p> : null}
    <section aria-label="Traffic totals" className="grid gap-4 sm:grid-cols-3"><Stat label="Visitors" value={web?.totals.visitors} note="Consenting browsers, with linked identities resolved" icon={Users} /><Stat label="Pageviews" value={web?.totals.views} note="Recorded marketing and builder page visits" icon={Eye} /><Stat label="Sessions" value={web?.totals.sessions} note="Visits separated by 30 minutes of inactivity" icon={MousePointer2} /></section>
    <section aria-label="Business totals" className="mt-4 grid gap-4 sm:grid-cols-3"><Stat label="Inquiries" value={sales?.inquiries} note="Saved inquiries, including meeting requests by email" icon={ArrowUpRight} /><Stat label="Introductions" value={sales?.introductions} note="Saved referral introductions" icon={Globe2} /><Stat label="Confirmed bookings" value={sales?.confirmedBookings} note="Currently confirmed leads, by booking record creation date" icon={CalendarCheck2} /></section>
    <p className="mt-4 text-xs leading-relaxed text-muted">Traffic covers consenting visitors and delivered events. Business totals come from saved database records, including requests made without analytics consent. Deleted records are excluded. Inquiries and bookings can overlap; they are not distinct customer counts.</p>
    {web ? <><div className="mt-7 grid gap-5 lg:grid-cols-3"><Trend report={web} days={days} /><Breakdown title="Devices" rows={web.devices} label="Device" /></div><div className="mt-5 grid gap-5 lg:grid-cols-2"><Breakdown title="Popular pages" rows={web.pages} label="Page" /><Breakdown title="Traffic sources" rows={web.sources} label="Latest source" /></div><p className="mt-5 text-xs text-muted">Traffic snapshot: {new Intl.DateTimeFormat("en", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }).format(new Date(web.updatedAt))} · Refreshes at most once per minute. Historic custom pageviews are included.</p></> : null}
  </>;
}
export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const owner = await isOwner();
  const days = reportDays((await searchParams).days);
  return <main id="main" className="min-h-screen bg-background px-5 py-8 text-ink sm:px-10 sm:py-12"><div className="mx-auto max-w-6xl"><div className="flex items-center justify-between gap-4"><Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden />Back to Veloce</Link>{owner ? <div className="flex flex-wrap gap-2"><form action={ownerLogout}><Button type="submit" variant="outline" size="sm">Sign out</Button></form><form action={ownerLogoutAll}><Button type="submit" variant="outline" size="sm">Sign out all devices</Button></form></div> : null}</div>
    {!owner ? ownerConfigured() ? <OwnerLogin mfa={!!process.env.ANALYTICS_OWNER_TOTP_SECRET} /> : <section className={`${panel} mx-auto mt-16 max-w-md`}><h1 className="font-heading text-2xl font-semibold">Owner access is not configured</h1><p className="mt-3 text-sm text-muted">Owner access needs a password, a signing secret and an enrolled authenticator. Contact the site administrator to finish setup.</p></section> : <>
      <header className="mb-8 mt-10 flex flex-wrap items-end justify-between gap-6"><div><p className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-accent-700"><BarChart3 className="size-4" aria-hidden />Owner overview</p><h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight sm:text-5xl">A clearer view of your site.</h1><p className="mt-3 text-sm text-muted">Understand your traffic and the conversations it starts.</p></div><nav aria-label="Reporting period" className="flex gap-1 rounded-full border border-line p-1">{([7, 30, 90] as const).map(value => <Link key={value} href={`/admin/analytics?days=${value}`} aria-current={days === value ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold transition-colors active:bg-accent-100 ${days === value ? "bg-inverse text-on-inverse" : "hover:bg-neutral-100"}`}>{value} days</Link>)}</nav></header>
      <Suspense key={days} fallback={<p role="status" className={`${panel} text-sm text-muted`}>Loading your analytics…</p>}><Reports days={days} /></Suspense>
    </>}
  </div></main>;
}
