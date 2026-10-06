"use client";

import * as React from "react";
import { Check, Palette } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DEFAULT_THEME, MOTION_STORAGE_KEY, THEME_NAMES, THEME_STORAGE_KEY, themeMeta, type ThemeName } from "@/lib/themes";
import { cn } from "@/lib/utils";

/*
 * Palette manager: a side panel to choose the colour palette. The choice is stored in this browser
 * (localStorage) and applied before first paint by the inline script in ThemeScope; with no choice the site
 * default (DEFAULT_THEME) is used. The attribute on <html> is the source of truth, observed here.
 */
const subscribe = (cb: () => void) => {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-motion"] });
  window.addEventListener("storage", cb);
  return () => {
    mo.disconnect();
    window.removeEventListener("storage", cb);
  };
};
const read = (): ThemeName => {
  const t = document.documentElement.dataset.theme;
  return t === "ember" || t === "periwinkle" ? t : DEFAULT_THEME;
};

function useTheme() {
  const theme = React.useSyncExternalStore(subscribe, read, () => DEFAULT_THEME);
  const set = React.useCallback((t: ThemeName) => {
    document.documentElement.dataset.theme = t;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, t);
    } catch {
      /* private mode: the choice lasts for this visit only */
    }
  }, []);
  const reset = React.useCallback(() => {
    delete document.documentElement.dataset.theme;
    try {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);
  return { theme, set, reset };
}

/** "Always animate": plays animations even when the device asks for reduced motion. Off = follow the device. */
function useAlwaysAnimate() {
  const on = React.useSyncExternalStore(subscribe, () => document.documentElement.dataset.motion === "full", () => false);
  const set = React.useCallback((v: boolean) => {
    if (v) document.documentElement.dataset.motion = "full";
    else delete document.documentElement.dataset.motion;
    try {
      if (v) localStorage.setItem(MOTION_STORAGE_KEY, "full");
      else localStorage.removeItem(MOTION_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);
  return { on, set };
}

/** The palette radio cards. Shared by the palette side panel and the mobile menu (`compact` = swatches only, side by side). */
export function PaletteChoices({ theme, onSelect, className, compact = false }: { theme: ThemeName; onSelect: (t: ThemeName) => void; className?: string; compact?: boolean }) {
  return (
    <div role="radiogroup" aria-label="Colour palette" className={cn("flex gap-3", compact ? "flex-row" : "flex-col", className)}>
      {THEME_NAMES.map((name) => {
        const m = themeMeta[name];
        const on = theme === name;
        return (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onSelect(name)}
            className={cn(
              "flex rounded-xl border text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              compact ? "min-w-0 flex-1 flex-col gap-2 p-2.5" : "flex-col gap-3 p-4",
              on ? "border-accent-700 bg-accent-100" : "border-line bg-neutral-100 hover:bg-neutral-200",
            )}
          >
            <span aria-hidden className={cn("flex overflow-hidden rounded-lg border border-line", compact ? "h-9" : "h-12")}>
              {m.swatches.map((c) => (
                <span key={c} className="flex-1" style={{ background: c }} />
              ))}
            </span>
            <span className="flex items-center justify-between gap-2">
              <span className={cn("font-semibold text-ink", compact && "truncate text-[14px]")}>
                {m.label}
                {!compact && name === DEFAULT_THEME ? <span className="ml-2 text-[13px] font-medium text-muted">Site default</span> : null}
              </span>
              {on ? <Check aria-hidden className="size-4 shrink-0 text-accent-700" strokeWidth={3} /> : null}
            </span>
            {compact ? null : <span className="text-[14.5px] leading-snug text-muted">{m.description}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function useThemeChoice() {
  return useTheme();
}

export function ThemeManager({ variant = "icon", className }: { variant?: "icon" | "text"; className?: string }) {
  const { theme, set, reset } = useTheme();
  const motion = useAlwaysAnimate();
  return (
    <Sheet>
      <SheetTrigger asChild>
        {variant === "icon" ? (
          <button type="button" className={cn("grid size-11 place-items-center rounded-full text-muted hover:bg-ink/5 hover:text-ink", className)}>
            <span className="sr-only">Change colour palette</span>
            <Palette aria-hidden className="size-5" />
          </button>
        ) : (
          <button type="button" className={cn("inline-flex min-h-11 items-center gap-2 rounded-full px-1 hover:text-ink", className)}>
            <Palette aria-hidden className="size-4" />
            Colour palette
          </button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(92vw,380px)] gap-0 bg-bg p-0">
        <SheetHeader className="border-b border-line p-5">
          <SheetTitle className="font-heading text-xl">Colour palette</SheetTitle>
          <SheetDescription className="text-[15px] text-muted">Pick the look you prefer. It is remembered in this browser.</SheetDescription>
        </SheetHeader>
        <PaletteChoices theme={theme} onSelect={set} className="flex-1 overflow-y-auto p-4" />
        <div className="border-t border-line p-4">
          <button
            type="button"
            role="switch"
            aria-checked={motion.on}
            onClick={() => motion.set(!motion.on)}
            className="flex w-full items-center justify-between gap-4 rounded-xl p-2 text-left hover:bg-ink/5"
          >
            <span className="flex flex-col gap-0.5">
              <span className="font-semibold text-ink">Always play animations</span>
              <span className="text-[14px] leading-snug text-muted">By default the site follows your device&apos;s reduce-motion setting. Turn this on to see the animations anyway.</span>
            </span>
            <span aria-hidden className={cn("flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors", motion.on ? "bg-accent-700" : "bg-neutral-300")}>
              <span className={cn("size-5 rounded-full bg-surface shadow transition-transform", motion.on && "translate-x-5")} />
            </span>
          </button>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line p-4 text-[14px] text-muted">
          <span>Saved on this device only.</span>
          <button type="button" onClick={() => { reset(); motion.set(false); }} className="min-h-11 rounded-full px-4 font-semibold text-accent-700 hover:bg-ink/5">
            Use site default
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
