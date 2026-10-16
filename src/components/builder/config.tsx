import type { Config, Data } from "@puckeditor/core";
import type { BlockType } from "@/lib/builder/blocks";
import { Columns, Divider, Section, Spacer, type ColumnsProps, type SectionProps } from "./blocks/layout";
import { ButtonLink, Heading, Image, List, Text, type ButtonLinkProps, type HeadingProps, type ImageProps, type ListProps, type TextProps } from "./blocks/content";
import {
  Contact, CtaBand, Faq, Features, Hero, Pricing, Testimonials,
  type ContactProps, type CtaBandProps, type FaqProps, type FeaturesProps, type HeroProps, type PricingProps, type TestimonialsProps,
} from "./blocks/marketing";
import { CustomHtml, type CustomHtmlProps } from "./blocks/custom-html";
import { Gallery, Logos, Stats, Steps, Team, type GalleryProps, type LogosProps, type StatsProps, type StepsProps, type TeamProps } from "./blocks/more-sections";
import { ItemContext, PIECE_CSS, SiteStylesContext, withLayerFlags, type ItemOnPage } from "./blocks/elements";
import { FreeCanvas } from "./free-canvas";
import { DesignSection, type DesignSectionProps } from "./blocks/design-section";
import {
  Box, DField, DIcon, DImage, DLink, DRaw, DRich, DText,
  type BoxProps, type DFieldProps, type DIconProps, type DImageProps, type DLinkProps, type DRawProps, type DRichProps, type DTextProps,
} from "./blocks/elements";
import type { LoadedTemplate } from "./template-registry";
import { DEFAULT_THEME, normalizeTheme, themeFromLegacy, themeToCssVars, type ThemeTokens } from "@/lib/builder/theme";
import { ThemeField } from "./theme-field";
import { fontHref, stylesCss, webFontsUsed, type SiteStyles } from "@/lib/builder/site-styles";
import type { PageSeo } from "@/lib/builder/content";
import { MOTION_CSS } from "@/lib/builder/motion";
import { BEHAVIOUR_CSS } from "@/lib/builder/behaviours";
import { Behaviours } from "./behaviours";
import { EditorBehaviourBridge } from "./behaviour-bridge";
import { Wiring } from "./wiring";
import type { BuilderMetadata } from "./links";

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
  Stats: StatsProps;
  Steps: StepsProps;
  Gallery: GalleryProps;
  Team: TeamProps;
  Logos: LogosProps;
  CustomHtml: CustomHtmlProps;
  DesignSection: DesignSectionProps;
  Box: BoxProps;
  DText: DTextProps;
  DImage: DImageProps;
  DLink: DLinkProps;
  DIcon: DIconProps;
  DField: DFieldProps;
  DRaw: DRawProps;
  DRich: DRichProps;
};

export type BuilderRoot = {
  title: string;
  theme: ThemeTokens;
  /** Classes of the imported page's <body>/<main> (prefixed template utilities), for pages made from a template. */
  frame?: string;
  /** The site's styles (copied onto every page like the theme; site-styles.ts). */
  styles?: SiteStyles;
  /** This page's search and sharing details (content.ts). */
  seo?: PageSeo;
  /** This page shows one item of that collection, at /<path>/<item slug>; `previewItem` is the one shown while editing. */
  itemsOf?: string;
  previewItem?: string;
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
    marketing: { title: "Ready-made sections", components: ["Hero", "Features", "Steps", "Stats", "Gallery", "Team", "Logos", "Pricing", "Testimonials", "Faq", "CtaBand", "Contact"] },
    advanced: { title: "Advanced", components: ["CustomHtml"] },
    // The pieces a design section is made of ("Edit layout" takes a section apart into these).
    pieces: { title: "Design pieces", components: ["Box", "DText", "DRich", "DImage", "DLink", "DIcon"], defaultExpanded: false },
    // Imported sections are added from "Add a section", which knows the template; an empty one would be meaningless.
    other: { visible: false },
  },
  root: {
    fields: {
      title: { type: "text", label: "Page title" },
      theme: { type: "custom", label: "Theme", render: ({ value, onChange, readOnly }) => <ThemeField value={value} onChange={onChange} readOnly={readOnly} /> },
    },
    defaultProps: { title: "My new website", theme: DEFAULT_THEME },
    render: ({ children, theme, styles, accent, font, frame, itemsOf, previewItem, puck }) => {
      const t = theme ? normalizeTheme(theme) : themeFromLegacy({ accent, font });
      const { template, extraCss, collections, itemPages, itemSlug, static: still } = puck.metadata as BuilderMetadata & { template?: LoadedTemplate; extraCss?: string; itemSlug?: string; static?: boolean };
      // A collection's item page shows one item: the one in the address (preview), else the one picked to edit with.
      const c = itemsOf ? collections?.find((x) => x.id === itemsOf) : undefined;
      const item = c && (c.items.find((i) => (itemSlug ? i.slug === itemSlug : i.id === previewItem)) ?? (itemSlug ? undefined : c.items[0]));
      const onPage: ItemOnPage | null = c && item ? { c, item, pageId: itemPages?.[c.id] } : null;
      return (
        <div
          // Sites without a template are scoped "site", for classes a visitor adds (compiled against the site theme).
          data-vt={template?.pkg.slug ?? "site"}
          data-vt-dark={template?.pkg.theme.scheme === "dark" ? "" : undefined}
          // The editor canvas inherits this site's stylesheet; reset its heading font so the visitor's choice applies
          // (not to a design's headings that name their own font, which follow the design and the Styles panel, nor
          // to a hand-written design, whose stylesheet sets its headings' fonts).
          className={`min-h-full bg-(--site-bg) text-(--site-fg) antialiased ${template?.pkg.handWritten ? "" : "[&_:is(h1,h2,h3,h4):not([class*='font-'])]:[font-family:var(--site-heading)]"}`}
          data-scheme={t.scheme}
          style={{ ...themeToCssVars(t), fontFamily: "var(--site-body)", colorScheme: t.scheme }}
        >
          {/* The template's compiled stylesheet: scoped to [data-vt] and prefixed, so it can't restyle anything else. */}
          {template ? <style>{template.css}</style> : null}
          <style>{PIECE_CSS + MOTION_CSS + BEHAVIOUR_CSS}</style>
          {/* Classes added in the Style panel or Edit HTML that the template's stylesheet lacks (/api/builder/css). */}
          {extraCss ? <style>{extraCss}</style> : null}
          {/* The site's own styles: web fonts (served from this site), token overrides and colour styles. */}
          {webFontsUsed(styles, [t.fontHeading, t.fontBody]).map((f) => <link key={f} rel="stylesheet" href={fontHref(f)} />)}
          {styles ? <style>{stylesCss(styles, template?.pkg.slug ?? "site")}</style> : null}
          <SiteStylesContext.Provider value={styles}>
            <ItemContext.Provider value={onPage}>{frame && template ? <div className={frame}>{children}</div> : children}</ItemContext.Provider>
          </SiteStylesContext.Provider>
          {/* Handles, guides and multi-select for items in a free layout (editor only). */}
          {puck.isEditing ? <FreeCanvas /> : null}
          {/* Interactions (reveals, the photo wall, menus…), unless this is a still picture of the page. */}
          {still ? null : <Behaviours editing={puck.isEditing} />}
          {puck.isEditing && !still ? <EditorBehaviourBridge /> : null}
          {/* Lines from links and buttons to where they go ("Wiring" in the toolbar). */}
          {puck.isEditing && !still ? <Wiring /> : null}
        </div>
      );
    },
  },
  components: {
    Section, Columns, Spacer, Divider, Heading, Text, Image, ButtonLink, List, Hero, Features, Pricing, Testimonials, Faq, CtaBand, Contact, Stats, Steps, Gallery, Team, Logos, CustomHtml, DesignSection,
    // Design pieces carry layer flags (name, hidden, locked) from the layers panel.
    Box: withLayerFlags(Box), DText: withLayerFlags(DText), DImage: withLayerFlags(DImage), DLink: withLayerFlags(DLink),
    DIcon: withLayerFlags(DIcon), DField: withLayerFlags(DField), DRaw: withLayerFlags(DRaw), DRich: withLayerFlags(DRich),
  },
};
