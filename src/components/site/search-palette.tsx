"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import type { SearchEntry, SearchGroup } from "@/lib/search";
import { prefersReducedMotion } from "@/lib/use-reduced-motion";
import { cn } from "@/lib/utils";

/*
 * Search palette. Visual style follows VengeanceUI "search-modal" (rounded panel, grouped rows, keyboard hints),
 * rebuilt on shadcn Command (cmdk) + Dialog so it is a real combobox/listbox with focus trap, Esc and arrow keys.
 * It searches this page's own content (see lib/search.ts); nothing is sent anywhere.
 */
const ORDER: SearchGroup[] = ["Jump to", "Services", "Capabilities", "Contact"];

export function SearchPalette({ entries, className, variant = "compact", keyboardShortcut = true }: { entries: SearchEntry[]; className?: string; variant?: "compact" | "bar"; keyboardShortcut?: boolean }) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!keyboardShortcut) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [keyboardShortcut]);

  const run = (entry: SearchEntry) => {
    setOpen(false);
    // Wait for the dialog to unmount so focus and scroll lock are released first.
    window.setTimeout(() => {
      if (entry.kind === "cta") {
        // The FAB action stays mounted even when collapsed, so search can open the form.
        document.querySelector<HTMLElement>("[data-primary-cta]")?.click();
      } else if (entry.kind === "mail" && entry.href) {
        window.location.href = entry.href;
      } else if (entry.href?.startsWith("#")) {
        document.getElementById(entry.href.slice(1))?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth" });
        history.replaceState(null, "", entry.href);
      } else if (entry.href) {
        window.location.assign(entry.href);
      }
    }, 50);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-keyshortcuts={keyboardShortcut ? "Control+k Meta+k" : undefined}
        aria-label={variant === "bar" ? "Search this site" : "Search"}
        className={cn(
          "inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-medium text-muted hover:bg-ink/5 hover:text-ink",
          variant === "bar" && "h-14 w-full justify-start border border-line bg-bg px-5 shadow-lg focus-visible:outline-2 focus-visible:outline-accent",
          className,
        )}
      >
        <Search aria-hidden className="size-4" />
        <span className={variant === "bar" ? "flex-1 text-left" : "sr-only lg:not-sr-only"}>{variant === "bar" ? "Search this site…" : "Search"}</span>
        <kbd aria-hidden className={cn("shrink-0 rounded-md border border-line bg-bg px-1.5 py-0.5 font-sans text-[11px] text-muted", variant === "bar" ? "inline-flex" : "hidden lg:inline")}>
          Ctrl K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false} className="top-[22%] translate-y-0 gap-0 overflow-hidden rounded-2xl border border-line p-0 sm:max-w-xl">
          <DialogTitle className="sr-only">Search this site</DialogTitle>
          <DialogDescription className="sr-only">Type to filter sections, services and capabilities, then press Enter to go there.</DialogDescription>
          <Command className="rounded-none bg-transparent">
            <CommandInput placeholder="Search services, capabilities, sections…" aria-label="Search" className="h-14 text-base" />
            <CommandList className="max-h-[min(60vh,420px)] p-2">
              <CommandEmpty>No matches. Try a different word, or use Contact below.</CommandEmpty>
              {ORDER.map((g) => {
                const rows = entries.filter((e) => e.group === g);
                if (!rows.length) return null;
                return (
                  <CommandGroup key={g} heading={g} className="[&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.08em] [&_[cmdk-group-heading]]:text-muted">
                    {rows.map((e) => (
                      <CommandItem
                        key={e.id}
                        value={`${g} ${e.label}`}
                        keywords={[e.hint ?? "", ...(e.keywords ?? [])]}
                        onSelect={() => run(e)}
                        className="min-h-12 gap-3 rounded-xl px-3 data-[selected=true]:bg-accent-100 data-[selected=true]:text-ink"
                      >
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-100 text-accent-700">
                          <Icon name={e.icon} className="size-4" />
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-[15px] font-medium">{e.label}</span>
                          {e.hint ? <span className="truncate text-[13px] text-muted">{e.hint}</span> : null}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                );
              })}
            </CommandList>
            <div aria-hidden className="flex items-center justify-between border-t border-line px-4 py-2.5 text-xs text-muted">
              <span>↑ ↓ to move · Enter to open</span>
              <span>Esc to close</span>
            </div>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
