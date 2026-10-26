"use client";
import { useLinkStatus } from "next/link";

/**
 * Small spinner inside a Link while its navigation is pending. Always rendered at a fixed size and only faded in, so
 * it never shifts the layout. Must be a descendant of the Link.
 */
export function LinkPending({ className = "" }: { className?: string }) {
  const { pending } = useLinkStatus();
  return <span aria-hidden className={`inline-block size-3.5 shrink-0 rounded-full border-2 border-current border-r-transparent transition-opacity duration-150 ${pending ? "opacity-70 motion-safe:animate-spin" : "opacity-0"} ${className}`} />;
}
