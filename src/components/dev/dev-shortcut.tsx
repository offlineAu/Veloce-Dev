"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

// The panel (and everything it imports) downloads only after the shortcut is pressed.
const DevPanel = dynamic(() => import("./dev-panel"), { ssr: false, loading: () => null });

/** ⌘/Ctrl + Shift + Alt + T, matched on the physical key so Option on a Mac doesn't change it. */
const isShortcut = (e: KeyboardEvent) => e.code === "KeyT" && e.shiftKey && e.altKey && (e.ctrlKey || e.metaKey);

/**
 * Opens the developer panel for template uploads. The shortcut only saves a URL; access is decided by the password
 * and checked on the server for every action.
 */
export function DevShortcut() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isShortcut(e)) return;
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Shared design previews are for the team reading a lead, not for template work.
  if (path?.startsWith("/build/preview/")) return null;
  return open ? <DevPanel onClose={() => setOpen(false)} /> : null;
}
