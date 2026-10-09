import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import { env } from "@/config/env";
import { brand } from "@/content/site";
import { ThemeScope } from "@/components/site/theme-scope";
import { BootInitScript, BootLoader } from "@/components/site/boot-loader";
import { MarketingOnly } from "@/components/site/marketing-only";
import { Providers } from "@/components/providers";
import { ScrollProgress } from "@/components/motion/scroll-progress";
import "./globals.css";

const heading = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk", display: "swap" });
const body = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export const viewport: Viewport = { themeColor: "#f6f4ee", width: "device-width", initialScale: 1 };

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${heading.variable} ${body.variable} ${mono.variable}`}>
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
        <ThemeScope />
        <BootInitScript />
        <MarketingOnly>
          <BootLoader />
          <ScrollProgress />
        </MarketingOnly>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
