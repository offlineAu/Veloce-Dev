import { AdminShell } from "@/components/admin/admin-shell";
import { CardSkeleton, HeadingSkeleton } from "@/components/admin/admin-skeletons";

export default function LoadingAnalytics() {
  return <AdminShell active="analytics" skeleton>
    <HeadingSkeleton wide />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map(i => <CardSkeleton key={i} lines={1} />)}</div>
    <div className="mt-4 grid gap-4 lg:grid-cols-12"><CardSkeleton className="lg:col-span-8" tall /><CardSkeleton className="lg:col-span-4" tall /></div>
  </AdminShell>;
}
