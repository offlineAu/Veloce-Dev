"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

/** Keep native section jumps and browser history; use Next transitions between routes. */
export function NavigationLink({ href, ...props }: ComponentProps<"a"> & { href: string }) {
  return href.startsWith("/") && !href.startsWith("//")
    ? <Link href={href} {...props} />
    : <a href={href} {...props} />;
}
