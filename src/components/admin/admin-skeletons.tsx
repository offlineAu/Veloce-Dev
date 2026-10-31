import { CardSkeleton, card } from "@/components/admin/analytics-dashboard";

/** Loading-screen building blocks for owner pages, matching the real layouts so content doesn't jump in. */
const bar = "rounded-full bg-ink/[0.06] motion-safe:animate-pulse";
export function HeadingSkeleton({ wide = false }: { wide?: boolean }) {
  return <div className="mb-8 mt-10 sm:mt-14" role="status" aria-label="Loading">
    <div className={`${bar} h-4 w-28`} />
    <div className={`${bar} mt-4 h-9 sm:h-12 ${wide ? "w-full max-w-2xl" : "w-72 max-w-full"}`} />
  </div>;
}
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return <div className={`${card} !p-0`} aria-hidden>
    {Array.from({ length: rows }, (_, i) => <div key={i} className="grid gap-3 border-b border-[var(--dash-line)] px-5 py-5 last:border-0 sm:px-7 md:grid-cols-[1.6fr_1fr_1.3fr]">
      <div><div className={`${bar} h-4 w-40`} /><div className={`${bar} mt-2 h-3 w-56 max-w-full`} /></div>
      <div className={`${bar} h-6 w-24`} />
      <div><div className={`${bar} h-3 w-52 max-w-full`} /><div className={`${bar} mt-2 h-3 w-32`} /></div>
    </div>)}
  </div>;
}
export { CardSkeleton };
