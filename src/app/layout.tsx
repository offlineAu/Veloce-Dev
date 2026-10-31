import { headers } from "next/headers";
import { analyticsConfig } from "@/server/analytics/config";
import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Inter, Manrope } from "next/font/google";
import { env } from "@/config/env";
import { brand } from "@/content/site";
import { ThemeScope } from "@/components/site/theme-scope";
import { MarketingOnly } from "@/components/site/marketing-only";
import { BootInitScript } from "@/components/site/boot-loader";
import { DevShortcut } from "@/components/dev/dev-shortcut";
import { Providers } from "@/components/providers";
import { ScrollProgress } from "@/components/motion/scroll-progress";
import "./globals.css";

const heading = Manrope({ subsets: ["latin"], variable: "--font-space-grotesk", display: "swap" });
const body = Inter({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export const viewport: Viewport = { themeColor: "#f7f6f2", width: "device-width", initialScale: 1 };

export function generateMetadata(): Metadata {
  const e = env();
  return {
    metadataBase: new URL(e.NEXT_PUBLIC_SITE_URL),
    title: { default: `${e.COMPANY_NAME} | ${brand.tagline}`, template: `%s | ${e.COMPANY_NAME}` },
    description: brand.short,
    openGraph: { type: "website", siteName: e.COMPANY_NAME, locale: "en" },
    twitter: { card: "summary_large_image" },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning className={`${heading.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <a
          href="#main"
          className="sr-only z-50 rounded-full bg-ink px-5 py-3 text-bg focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        <noscript>
          <style>{"[data-reveal]{opacity:1!important;transform:none!important}[data-boot-loader]{display:none!important}"}</style>
        </noscript>
        <ThemeScope nonce={nonce} />
        <BootInitScript nonce={nonce} />
        <MarketingOnly>
          <ScrollProgress />
        </MarketingOnly>
        <Providers analyticsEnabled={analyticsConfig().enabled} analyticsKey={analyticsConfig().enabled ? analyticsConfig().key : undefined}>
          {children}
          <DevShortcut />
        </Providers>
      </body>
    </html>
  );
}
