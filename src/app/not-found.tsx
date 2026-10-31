import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return <main id="main" className="mx-auto flex min-h-[80dvh] max-w-page flex-col items-start justify-center px-5 py-20 sm:px-10 lg:px-16">
    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-700">404 · Page not found</p>
    <h1 className="mt-5 max-w-[14ch] font-heading text-[clamp(42px,6vw,76px)] font-semibold leading-[1.04] tracking-[-0.05em]">We couldn’t find that page.</h1>
    <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted">The page may have moved, or the link may no longer be available.</p>
    <Link href="/" className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-[10px] bg-accent-700 px-6 font-semibold text-bg"><ArrowLeft aria-hidden className="size-4" />Back to Veloce</Link>
  </main>;
}
