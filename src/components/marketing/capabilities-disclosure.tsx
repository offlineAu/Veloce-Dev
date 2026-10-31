"use client";

import { useEffect, useState, type ReactNode } from "react";

/** Search and existing section links open the capabilities they point to. */
export function CapabilitiesDisclosure({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const reveal = () => { if (window.location.hash === "#capabilities") setOpen(true); };
    reveal();
    window.addEventListener("hashchange", reveal);
    return () => window.removeEventListener("hashchange", reveal);
  }, []);
  return <details open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="min-h-11 cursor-pointer font-semibold text-accent-700">Explore capabilities and technology</summary>
    <div className="mt-8">{children}</div>
  </details>;
}
