"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/** Renders site-wide extras (boot loader, reading progress) everywhere except the full-screen site builder. */
export function MarketingOnly({ children }: { children: ReactNode }) {
  const path = usePathname();
  return path === "/build" || path?.startsWith("/build/") ? null : children;
}
