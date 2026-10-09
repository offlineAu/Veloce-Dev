import { PixelLogoLoader } from "@/components/brand/pixel-logo-loader";

export function PageLoading() {
  return (
    <main id="main" className="grid min-h-[70svh] place-items-center px-5 py-16 text-ink">
      <div role="status" className="flex flex-col items-center gap-5">
        <PixelLogoLoader />
        <p className="text-sm text-muted">Loading…</p>
      </div>
    </main>
  );
}
