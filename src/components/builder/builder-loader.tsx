"use client";

import dynamic from "next/dynamic";
import { PixelLogoLoader } from "@/components/brand/pixel-logo-loader";
import type { BuilderAppProps } from "./builder-app";

// The editor is large and browser-only, so it is split out of every other page and never server-rendered.
const BuilderApp = dynamic(() => import("./builder-app"), {
  ssr: false,
  loading: () => (
    <div role="status" className="grid h-dvh place-items-center gap-3 text-muted">
      <span className="flex flex-col items-center gap-3"><PixelLogoLoader variant="compact" /> Opening the builder…</span>
    </div>
  ),
});

export function BuilderLoader(props: BuilderAppProps) {
  return <BuilderApp {...props} />;
}
