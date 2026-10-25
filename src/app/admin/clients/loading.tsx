import { AdminShell } from "@/components/admin/admin-shell";
import { CardSkeleton, HeadingSkeleton, ListSkeleton } from "@/components/admin/admin-skeletons";

export default function LoadingClients() {
  return <AdminShell active="clients" skeleton>
    <HeadingSkeleton wide />
    <div className="grid grid-cols-3 gap-2 sm:gap-4">{[0, 1, 2].map(i => <CardSkeleton key={i} lines={0} />)}</div>
    <div className="mt-8 h-11 w-full max-w-3xl rounded-full border border-[var(--dash-line)] bg-[var(--dash-surface)]" aria-hidden />
    <div className="mt-4"><ListSkeleton /></div>
  </AdminShell>;
}
