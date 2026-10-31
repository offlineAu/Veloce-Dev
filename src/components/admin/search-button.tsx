"use client";
import { useFormStatus } from "react-dom";

/** Search submit with immediate feedback while the results load. */
export function SearchButton() {
  const { pending } = useFormStatus();
  return <button type="submit" aria-busy={pending} className="inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-sm text-[var(--dash-ink)] hover:bg-ink/[0.06]">
    <span aria-hidden className={`size-3.5 rounded-full border-2 border-current border-r-transparent transition-opacity ${pending ? "opacity-70 motion-safe:animate-spin" : "hidden"}`} />Search
  </button>;
}
