import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, BarChart3, Users } from "lucide-react";
import { ownerLogout, ownerLogoutAll } from "@/app/admin/analytics/actions";
import { dashboardTheme } from "@/components/admin/analytics-dashboard";

const pill = "inline-flex min-h-10 items-center rounded-full border border-[var(--dash-line)] px-4 text-sm text-[var(--dash-ink)] transition-colors hover:bg-white/[0.06]";

/** Signed-in owner frame shared by analytics and the client tracker: Ember surface, section tabs and sign-out. */
export function AdminShell({ active, attention = 0, children }: { active: "analytics" | "clients"; attention?: number; children: ReactNode }) {
  const tab = (key: typeof active) => `inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors ${active === key ? "bg-[var(--dash-hi)] text-[var(--dash-on-hi)]" : "text-[var(--dash-muted)] hover:bg-white/[0.06] hover:text-[var(--dash-ink)]"}`;
  return <main id="main" style={dashboardTheme} className="min-h-screen bg-[var(--dash-bg)] px-4 py-5 text-[var(--dash-ink)] [color-scheme:dark] sm:px-8 sm:py-8">
    <div className="mx-auto max-w-7xl">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/" aria-label="Back to Veloce" className="grid size-10 place-items-center rounded-full border border-[var(--dash-line)] hover:bg-white/[0.06]"><ArrowLeft className="size-4" aria-hidden /></Link>
          <span className="font-heading text-xl font-semibold tracking-tight">Veloce</span>
          <span className="rounded-full border border-[var(--dash-line)] px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-widest text-[var(--dash-muted)]">Owner</span>
          <nav aria-label="Owner sections" className="ml-1 flex gap-1 rounded-full border border-[var(--dash-line)] bg-[var(--dash-surface)] p-1">
            <Link href="/admin/analytics" aria-current={active === "analytics" ? "page" : undefined} className={tab("analytics")}><BarChart3 className="size-4" aria-hidden />Analytics</Link>
            <Link href="/admin/clients" aria-current={active === "clients" ? "page" : undefined} className={tab("clients")}><Users className="size-4" aria-hidden />Clients{attention ? <span className={`grid min-w-5 place-items-center rounded-full px-1.5 font-mono text-[11px] ${active === "clients" ? "bg-[var(--dash-on-hi)] text-[var(--dash-hi)]" : "bg-[var(--dash-hi)] text-[var(--dash-on-hi)]"}`} aria-label={`${attention} need attention`}>{attention}</span> : null}</Link>
          </nav>
        </div>
        <div className="flex flex-wrap gap-2"><form action={ownerLogout}><button type="submit" className={pill}>Sign out</button></form><form action={ownerLogoutAll}><button type="submit" className={pill}>Sign out all devices</button></form></div>
      </header>
      {children}
    </div>
  </main>;
}
