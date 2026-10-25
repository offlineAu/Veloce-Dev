import { AdminShell } from "@/components/admin/admin-shell";
import { CardSkeleton, HeadingSkeleton } from "@/components/admin/admin-skeletons";

export default function LoadingClient() {
  return <AdminShell active="clients" skeleton>
    <HeadingSkeleton />
    <div className="grid gap-4 lg:grid-cols-12">
      <div className="space-y-4 lg:col-span-8"><CardSkeleton tall lines={2} /><CardSkeleton lines={5} /></div>
      <div className="space-y-4 lg:col-span-4"><CardSkeleton lines={4} /><CardSkeleton lines={3} /><CardSkeleton lines={2} /></div>
    </div>
  </AdminShell>;
}
