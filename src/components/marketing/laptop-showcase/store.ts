import { useSyncExternalStore } from "react";
import type { ShowcaseSample } from "@/content/samples";

export type Kind = "website" | "store" | "system";
/** `short`: the label on phones, so the choices and buttons share one row. */
export type ShowcaseItem = { kind: Kind; label: string; short: string; sample: ShowcaseSample };
export type Phase = "code" | "deploy" | "site" | "clear";

export interface ShowState {
  active: number;
  phase: Phase;
  /** Characters of the current snippet typed so far. */
  typed: number;
  /** Deploy log lines shown so far. */
  deployed: number;
  paused: boolean;
  /** Where the lid is heading; the scene animates towards it. */
  lid: boolean;
  /** Trackpad cursor on the screen (0..1 each way), or null when the pointer is off the trackpad. */
  cursor: { x: number; y: number } | null;
  /** Pointer or focus is on the laptop: a finished site stays up. */
  holding: boolean;
}

/**
 * A tiny external store shared by the page controls, the 3D scene (its own React renderer) and the screen content
 * (drei's Html renders into a separate React root, so context does not reach it; a store does).
 */
export function createShowStore(initial: ShowState) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(patch: Partial<ShowState> | ((s: ShowState) => Partial<ShowState>)) {
      state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
      listeners.forEach((l) => l());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
export type ShowStore = ReturnType<typeof createShowStore>;

/** Mutable handles shared through a ref (not state): they change every frame or are set once by one side. */
export interface Bus {
  /** Set by the scene: presses the 3D keys for a typed character. */
  press: null | ((char: string) => void);
  /** Set by the page: opens the current sample (the trackpad's click). */
  open: null | (() => void);
  /** Pointer over the stage, -0.5..0.5 each way, for the tilt. */
  pointer: { x: number; y: number };
  /** Set by the scene: asks for a frame (the canvas renders on demand). */
  invalidate: null | (() => void);
}

export function useShow(store: ShowStore) {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/** What each build types: a short page component for the sample it ends on. */
export const SNIPPETS: Record<Kind, string> = {
  website: `export default function Home() {\n  return (\n    <Hero title="Advisory firm"\n      action="Book a consultation" />\n  );\n}`,
  store: `export default function Shop() {\n  return (\n    <ProductGrid collection="homeware"\n      cart checkout="local" />\n  );\n}`,
  system: `export default function Portal() {\n  return (\n    <Dashboard project="Kitchen extension"\n      approvals invoices />\n  );\n}`,
};

export const FILES: Record<Kind, string> = { website: "app/page.tsx", store: "app/shop/page.tsx", system: "app/portal/page.tsx" };
export const VERB: Record<Kind, string> = { website: "a website", store: "an online store", system: "a business system" };

/** Timing in ms. A build is: type the snippet, deploy it, show the site, clear. */
export const TIMING = { char: 34, deployStep: 520, site: 3800, clear: 450 } as const;
export const DEPLOY_STEPS = 3;
