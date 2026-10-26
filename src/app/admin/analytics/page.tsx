import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { isOwner, ownerConfigured, ownerReturnPath } from "@/server/admin/session";
import { getBusinessReport, getInsightsReport, getPipelineReport, getTrafficReport, queryConfig, reportDays } from "@/server/analytics/report";
import { OwnerLogin } from "@/components/admin/owner-login";
import { OwnerReports, card, dashboardTheme, greeting, type ReportData } from "@/components/admin/analytics-dashboard";
import { AdminShell } from "@/components/admin/admin-shell";
import { LinkPending } from "@/components/admin/link-pending";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Owner analytics", robots: { index: false, follow: false }, referrer: "no-referrer" };
/** Starts every report at once; each card awaits only its own. A failed source resolves to undefined for its cards. */
function reportData(days: 7 | 30 | 90): ReportData {
  const settle = <T,>(work: Promise<T>) => work.catch(() => undefined);
  return { web: settle(getTrafficReport(days)), sales: settle(getBusinessReport(days)), insights: settle(getInsightsReport(days)), pipeline: settle(getPipelineReport(days)) };
}
export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string; next?: string }> }) {
  const owner = await isOwner();
  const params = await searchParams;
  const days = reportDays(params.days);
  if (!owner) return <main id="main" style={dashboardTheme} className="min-h-screen bg-[var(--dash-bg)] px-4 py-6 text-[var(--dash-ink)] [color-scheme:dark] sm:px-8 sm:py-10"><div className="mx-auto max-w-5xl">
    <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-full pr-3 text-sm text-[var(--dash-muted)] hover:text-[var(--dash-ink)]"><ArrowLeft className="size-4" aria-hidden />Back to Veloce</Link>
    {ownerConfigured() ? <OwnerLogin mfa={!!process.env.ANALYTICS_OWNER_TOTP_SECRET} next={ownerReturnPath(params.next)} /> : <section className={`${card} mx-auto mt-16 max-w-md`}><h1 className="font-heading text-2xl font-medium">Owner access is not configured</h1><p className="mt-3 text-sm text-[var(--dash-muted)]">Owner access needs a password, a signing secret and an enrolled authenticator. Contact the site administrator to finish setup.</p></section>}
  </div></main>;
  return <AdminShell active="analytics">
    <div className="mb-8 mt-10 flex flex-wrap items-end justify-between gap-6 sm:mt-14">
      <div><p className="text-sm text-[var(--dash-muted)]">{greeting(new Date())}</p><h1 className="mt-2 font-heading text-3xl font-medium tracking-tight sm:text-5xl">A clearer view of your site.</h1></div>
      <nav aria-label="Reporting period" className="flex gap-1 rounded-full border border-[var(--dash-line)] bg-[var(--dash-surface)] p-1">{([7, 30, 90] as const).map(value => <Link key={value} href={`/admin/analytics?days=${value}`} aria-current={days === value ? "page" : undefined} className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm font-medium transition-colors ${days === value ? "bg-[var(--dash-hi)] text-[var(--dash-on-hi)]" : "text-[var(--dash-muted)] hover:bg-white/[0.06] hover:text-[var(--dash-ink)]"}`}>{value} days<LinkPending className="ml-2" /></Link>)}</nav>
    </div>
    {/* Keyed by period so switching periods shows fresh skeletons instead of stale numbers. */}
    <div key={days}><OwnerReports days={days} data={reportData(days)} connected={!!queryConfig()} /></div>
  </AdminShell>;
}
