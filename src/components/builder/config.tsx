import type { Config, Data } from "@puckeditor/core";
import type { BlockType } from "@/lib/builder/blocks";
import { Columns, Divider, Section, Spacer, type ColumnsProps, type SectionProps } from "./blocks/layout";
import { ButtonLink, Heading, Image, List, Text, type ButtonLinkProps, type HeadingProps, type ImageProps, type ListProps, type TextProps } from "./blocks/content";
import {
  Contact, CtaBand, Faq, Features, Hero, Pricing, Testimonials,
  type ContactProps, type CtaBandProps, type FaqProps, type FeaturesProps, type HeroProps, type PricingProps, type TestimonialsProps,
} from "./blocks/marketing";
import { CustomHtml, type CustomHtmlProps } from "./blocks/custom-html";
import { DesignSection, type DesignSectionProps } from "./blocks/design-section";
import type { LoadedTemplate } from "./template-registry";
import { DEFAULT_THEME, normalizeTheme, themeFromLegacy, themeToCssVars, type ThemeTokens } from "@/lib/builder/theme";
import { ThemeField } from "./theme-field";

export type BuilderComponents = {
  Section: SectionProps;
  Columns: ColumnsProps;
  Spacer: { size: "sm" | "md" | "lg" };
  Divider: { inset: boolean };
  Heading: HeadingProps;
  Text: TextProps;
  Image: ImageProps;
  ButtonLink: ButtonLinkProps;
  List: ListProps;
  Hero: HeroProps;
  Features: FeaturesProps;
  Pricing: PricingProps;
  Testimonials: TestimonialsProps;
  Faq: FaqProps;
  CtaBand: CtaBandProps;
  Contact: ContactProps;
  CustomHtml: CustomHtmlProps;
  DesignSection: DesignSectionProps;
};

export type BuilderRoot = {
  title: string;
  theme: ThemeTokens;
  /** Classes of the imported page's <body>/<main> (prefixed template utilities), for pages made from a template. */
  frame?: string;
  /** Drafts from before themes existed; read once by themeFromLegacy. */
  accent?: string;
  font?: string;
};

export type BuilderData = Data<BuilderComponents, BuilderRoot>;

/** Every block the editor offers. Keep in step with BLOCK_TYPES, which the server validates drafts against. */
export const builderConfig: Config<BuilderComponents, BuilderRoot> & { components: Record<BlockType, unknown> } = {
  categories: {
    layout: { title: "Layout", components: ["Section", "Columns", "Spacer", "Divider"] },
    content: { title: "Content", components: ["Heading", "Text", "Image", "ButtonLink", "List"] },
    marketing: { title: "Ready-made sections", components: ["Hero", "Features", "Pricing", "Testimonials", "Faq", "CtaBand", "Contact"] },
    advanced: { title: "Advanced", components: ["CustomHtml"] },
    // Imported sections are added from "Add a section", which knows the template; an empty one would be meaningless.
    other: { visible: false },
  },
  root: {
    fields: {
      title: { type: "text", label: "Page title" },
      theme: { type: "custom", label: "Theme", render: ({ value, onChange, readOnly }) => <ThemeField value={value} onChange={onChange} readOnly={readOnly} /> },
    },
    defaultProps: { title: "My new website", theme: DEFAULT_THEME },
    render: ({ children, theme, accent, font, frame, puck }) => {
      const t = theme ? normalizeTheme(theme) : themeFromLegacy({ accent, font });
      const template = (puck.metadata as { template?: LoadedTemplate }).template;
      return (
        <div
          data-vt={template?.pkg.slug}
          data-vt-dark={template?.pkg.theme.scheme === "dark" ? "" : undefined}
          // The editor canvas inherits this site's stylesheet; reset its heading font so the visitor's choice applies.
          className="min-h-full bg-(--site-bg) text-(--site-fg) antialiased [&_:is(h1,h2,h3,h4)]:[font-family:var(--site-heading)]"
          data-scheme={t.scheme}
          style={{ ...themeToCssVars(t), fontFamily: "var(--site-body)", colorScheme: t.scheme }}
        >
          {/* The template's compiled stylesheet: scoped to [data-vt] and prefixed, so it can't restyle anything else. */}
          {template ? <style>{template.css}</style> : null}
          {frame && template ? <div className={frame}>{children}</div> : children}
        </div>
      );
    },
  },
  components: { Section, Columns, Spacer, Divider, Heading, Text, Image, ButtonLink, List, Hero, Features, Pricing, Testimonials, Faq, CtaBand, Contact, CustomHtml, DesignSection },
};
