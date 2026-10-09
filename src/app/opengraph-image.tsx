import { ImageResponse } from "next/og";
import { LOGO_POLYGONS } from "@/components/brand/logo";
import { getCompanyProfile } from "@/server/services/company";
import { DEFAULT_THEME, themes } from "@/lib/themes";

export const alt = "Build fast. Build what works.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

/** Social preview: brand mark + company name. Generic on purpose (also used for referral links). */
export default async function OpengraphImage() {
  const company = await getCompanyProfile();
  // Shared previews use the site default; browser-local palette choices are not available here.
  const palette = themes[DEFAULT_THEME]!;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: palette["--color-bg"], padding: 72, color: palette["--color-ink"] }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <svg width="68" height="70" viewBox="0 0 96.8 100" fill={palette["--color-ink"]}>
            {LOGO_POLYGONS.map((p) => (
              <polygon key={p} points={p} />
            ))}
          </svg>
          <div style={{ fontSize: 44, fontWeight: 700 }}>{company.name}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1.05, maxWidth: 900 }}>Your idea shouldn&apos;t stay an idea.</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30, color: palette["--color-muted"] }}>
            <div style={{ width: 18, height: 18, borderRadius: 9999, background: palette["--color-accent"] }} />
            Build fast. Build what works.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
