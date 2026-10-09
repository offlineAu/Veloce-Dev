import type { ComponentData } from "@puckeditor/core";
import { withFreshIds, type BlockItem } from "@/lib/builder/blocks";
import { docFromPage, type PageData, type SiteDoc } from "@/lib/builder/site-doc";
import { SYSTEM_ROUNDED, SYSTEM_SERIF, THEME_PRESETS, type ThemeTokens } from "@/lib/builder/theme";
import { builderConfig, type BuilderComponents, type BuilderData, type BuilderRoot } from "./config";

/** Website types from the inquiry form, so a draft arrives pre-labelled. */
type WebsiteType = "BUSINESS" | "CORPORATE" | "ECOMMERCE_STORE" | "WEB_APP" | "LANDING_PAGE" | "OTHER";

export interface StarterTemplate {
  id: string;
  name: string;
  description: string;
  websiteType: WebsiteType;
  build: () => SiteDoc;
}

/** A block with the editor's defaults filled in, so templates stay valid as blocks gain new fields. */
function b<K extends keyof BuilderComponents>(type: K, props: Partial<BuilderComponents[K]> = {}): ComponentData {
  const defaults = (builderConfig.components[type] as { defaultProps?: object }).defaultProps ?? {};
  return { type, props: { id: type, ...defaults, ...props } } as ComponentData;
}

/** A preset theme, optionally with a few tokens changed (which makes it a custom theme). */
function preset(id: string, overrides: Partial<ThemeTokens> = {}): ThemeTokens {
  const t = THEME_PRESETS.find((p) => p.id === id)!.theme;
  return Object.keys(overrides).length ? { ...t, ...overrides, preset: undefined } : t;
}

/** A one-page site: starter templates are single pages that visitors can add more pages to. */
function page(root: Partial<BuilderRoot>, content: ComponentData[]): SiteDoc {
  const data: BuilderData = {
    root: { props: { ...(builderConfig.root?.defaultProps as BuilderRoot), ...root } },
    content: withFreshIds(content as BlockItem[]) as BuilderData["content"],
  };
  return docFromPage(data as PageData);
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: "business",
    name: "Business landing",
    description: "Hero, services, testimonials and a contact section. A solid start for most local businesses.",
    websiteType: "BUSINESS",
    build: () =>
      page({ title: "Business landing", theme: preset("terracotta") }, [
        b("Hero"),
        b("Features", { title: "What we do" }),
        b("Testimonials"),
        b("Faq"),
        b("Contact"),
      ]),
  },
  {
    id: "portfolio",
    name: "Portfolio",
    description: "Big intro, a project gallery and a simple way to get in touch.",
    websiteType: "OTHER",
    build: () =>
      page({ title: "Portfolio", theme: preset("charcoal", { fontHeading: SYSTEM_SERIF }) }, [
        b("Hero", { eyebrow: "Designer & photographer", title: "Hi, I'm Jordan. I make things look good.", layout: "centered", tone: "light", secondaryLabel: "" , primaryLabel: "See my work", primaryHref: "#work" }),
        b("Section", {
          tone: "light",
          content: [
            b("Heading", { text: "Selected work", size: "m" }),
            b("Columns", { count: "3", gap: "sm", col1: [b("Image", { ratio: "1/1", alt: "Project one" })], col2: [b("Image", { ratio: "1/1", alt: "Project two" })], col3: [b("Image", { ratio: "1/1", alt: "Project three" })] }),
          ] as never,
        }),
        b("CtaBand", { title: "Have a project in mind?", buttonLabel: "Let's talk", tone: "dark" }),
        b("Contact", { showForm: false, tone: "light" }),
      ]),
  },
  {
    id: "restaurant",
    name: "Restaurant & café",
    description: "Warm hero, menu highlights, opening hours and directions.",
    websiteType: "BUSINESS",
    build: () =>
      page({ title: "Restaurant", theme: preset("gold") }, [
        b("Hero", { eyebrow: "Open daily from 8am", title: "Fresh food, made with care", subtitle: "Seasonal plates and great coffee in the heart of town.", primaryLabel: "Book a table", secondaryLabel: "View menu", secondaryHref: "#menu" }),
        b("Features", {
          title: "On the menu",
          columns: "3",
          items: [
            { icon: "🥐", title: "Breakfast", body: "Pastries baked every morning." },
            { icon: "🥗", title: "Lunch", body: "Salads, bowls and daily specials." },
            { icon: "☕", title: "Coffee", body: "Locally roasted, made right." },
          ],
        }),
        b("Testimonials", { title: "Loved by locals" }),
        b("Contact", { title: "Find us", body: "Walk-ins welcome. Call ahead for groups of 6+.", address: "12 Market Street\nYour Town", phone: "(555) 010-2030", showForm: false }),
      ]),
  },
  {
    id: "saas",
    name: "Product launch",
    description: "For an app or online service: features, pricing and a strong call to action.",
    websiteType: "LANDING_PAGE",
    build: () =>
      page({ title: "Product launch", theme: preset("ocean") }, [
        b("Hero", { eyebrow: "Now in beta", title: "The simplest way to run your bookings", primaryLabel: "Start free trial", secondaryLabel: "Watch demo" }),
        b("Features", { columns: "4", tone: "light", title: "Everything in one place", items: [
          { icon: "📅", title: "Scheduling", body: "Clients book in seconds." },
          { icon: "💳", title: "Payments", body: "Get paid upfront." },
          { icon: "🔔", title: "Reminders", body: "Fewer no-shows." },
          { icon: "📊", title: "Reports", body: "See what's working." },
        ] }),
        b("Pricing"),
        b("Faq"),
        b("CtaBand", { title: "Try it free for 14 days", buttonLabel: "Start now" }),
      ]),
  },
  {
    id: "shop",
    name: "Online shop teaser",
    description: "Show off products and collect interest before a full store.",
    websiteType: "ECOMMERCE_STORE",
    build: () =>
      page({ title: "Shop", theme: preset("plum", { fontHeading: SYSTEM_ROUNDED, fontBody: SYSTEM_ROUNDED }) }, [
        b("Hero", { eyebrow: "Handmade in small batches", title: "Candles that make home feel like home", primaryLabel: "Shop the collection", secondaryLabel: "" }),
        b("Section", {
          tone: "tinted",
          content: [
            b("Heading", { text: "Bestsellers", align: "center", size: "m" }),
            b("Columns", { count: "3", col1: [b("Image", { ratio: "4/3", alt: "Product" }), b("Text", { text: "Cedar & Smoke · $24" })], col2: [b("Image", { ratio: "4/3", alt: "Product" }), b("Text", { text: "Fig Leaf · $24" })], col3: [b("Image", { ratio: "4/3", alt: "Product" }), b("Text", { text: "Sea Salt · $22" })] }),
          ] as never,
        }),
        b("Testimonials"),
        b("CtaBand", { title: "Join the list for 10% off", buttonLabel: "Sign up" }),
      ]),
  },
  {
    id: "blank",
    name: "Blank page",
    description: "Start from nothing and drag in exactly what you want.",
    websiteType: "OTHER",
    build: () => page({ title: "My new website" }, []),
  },
];

export const findTemplate = (id: string | null | undefined) => STARTER_TEMPLATES.find((t) => t.id === id);
