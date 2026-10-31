import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, BarChart3, Users } from "lucide-react";
import { ownerLogout, ownerLogoutAll } from "@/app/admin/analytics/actions";
import { dashboardTheme } from "@/components/admin/analytics-dashboard";
import { LinkPending } from "@/components/admin/link-pending";

const action = "inline-flex min-h-10 items-center rounded-lg border border-[var(--dash-line)] px-3 text-sm text-[var(--dash-ink)] transition-colors hover:bg-ink/[0.05]";

export function AdminShell({ active, attention = 0, skeleton = false, children }: { active: "analytics" | "clients"; attention?: number; skeleton?: boolean; children: ReactNode }) {
  const tab = (key: typeof active) => `inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors ${active === key ? "bg-[var(--dash-hi)] text-[var(--dash-on-hi)]" : "text-[var(--dash-muted)] hover:bg-ink/[0.05] hover:text-[var(--dash-ink)]"}`;
  return <main id="main" style={dashboardTheme} className="min-h-screen bg-[var(--dash-bg)] text-[var(--dash-ink)]">
    <div className="mx-auto flex max-w-[1600px] flex-col lg:min-h-screen lg:flex-row">
      <aside className="border-b border-[var(--dash-line)] bg-[var(--dash-surface)] p-4 lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 lg:block">
          <Link href="/" className="inline-flex min-h-11 items-center gap-3 font-heading text-lg font-bold"><ArrowLeft className="size-4" aria-hidden />Veloce <span className="text-xs font-normal text-[var(--dash-muted)]">Owner</span></Link>
          <nav aria-label="Owner sections" className="flex gap-1 lg:mt-10 lg:flex-col">
            <Link href="/admin/analytics" aria-current={active === "analytics" ? "page" : undefined} className={tab("analytics")}><BarChart3 className="size-4" aria-hidden />Analytics<LinkPending /></Link>
            <Link href="/admin/clients" aria-current={active === "clients" ? "page" : undefined} className={tab("clients")}><Users className="size-4" aria-hidden />Clients{attention ? <span className="ml-auto text-xs" aria-label={`${attention} need attention`}>{attention}</span> : null}<LinkPending /></Link>
          </nav>
        </div>
      </aside>
      <div className="min-w-0 flex-1 px-4 py-5 sm:px-8 sm:py-8 lg:px-12">
        <header className="flex min-h-10 justify-end gap-2">{skeleton ? <span className="h-10 w-24 rounded-lg bg-[var(--dash-raised)]" aria-hidden /> : <><form action={ownerLogout}><button type="submit" className={action}>Sign out</button></form><form action={ownerLogoutAll}><button type="submit" className={action}>Sign out all devices</button></form></>}</header>
        {children}
      </div>
    </div>
  </main>;
}
