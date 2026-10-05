import { ImageResponse } from "next/og";
import { LOGO_POLYGONS } from "@/components/brand/logo";
import { getCompanyProfile } from "@/server/services/company";

export const alt = "Build fast. Build what works.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

/** Social preview: brand mark + company name. Generic on purpose (also used for referral links). */
export default async function OpengraphImage() {
  const company = await getCompanyProfile();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#f7f7ff", padding: 72, color: "#1b1d4d" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ width: 96, height: 96, borderRadius: 48, background: "#9fa1ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="48" height="50" viewBox="0 0 96.8 100" fill="#1b1d4d">
              {LOGO_POLYGONS.map((p) => (
                <polygon key={p} points={p} />
              ))}
            </svg>
          </div>
          <div style={{ fontSize: 44, fontWeight: 700 }}>{company.name}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1.05, maxWidth: 900 }}>Your idea shouldn&apos;t stay an idea.</div>
          <div style={{ fontSize: 30, color: "#44476f" }}>Build fast. Build what works.</div>
        </div>
      </div>
    ),
    size,
  );
}
