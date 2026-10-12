export interface ServicePageContent {
  slug: string;
  serviceSlug: string;
  label: string;
  title: string;
  description: string;
  heading: string;
  intro: string;
  fit: string;
  capabilities: { title: string; body: string }[];
  process: string;
  questions: { question: string; answer: string }[];
}

export const servicePages: ServicePageContent[] = [
  {
    slug: "business-websites", serviceSlug: "business-websites", label: "Business websites",
    title: "Business Website Design & Development",
    description: "Custom business website design and development from Veloce. Present your services clearly, help customers get in touch, and build a site you can grow.",
    heading: "A business website that helps customers take the next step.",
    intro: "Your website should explain what you do, who you help, and how to work with you. We design and develop custom business websites around those decisions, with clear content and practical ways to enquire.",
    fit: "A good fit for service businesses launching their first website, replacing a basic landing page, or bringing scattered information into one clear online presence. We work remotely with English-speaking businesses and agree the scope around your customers and operations.",
    capabilities: [
      { title: "Pages built around your services", body: "Organize your offer into useful pages with clear navigation, calls to action, and content that answers customer questions." },
      { title: "Responsive, accessible design", body: "Make key information and enquiry forms easy to use on phones, tablets, and desktops, including with keyboard navigation." },
      { title: "Enquiries and bookings", body: "Connect contact forms and, where needed, scheduling tools to the way your team handles new business." },
      { title: "A foundation for growth", body: "Plan page metadata, performance, and content updates from the start. Add a CMS or integrations when the project needs them." },
    ],
    process: "We start with your audience, offer, and required pages. You review the proposed structure and key screens before development. We then build, check the site across devices, and agree the launch and handover steps with you.",
    questions: [
      { question: "How much does a business website cost?", answer: "Cost depends on the pages, content, design, and functionality involved. After an initial conversation, we propose a scope and estimate so you can decide before development begins." },
      { question: "Can we update the website ourselves?", answer: "If regular editing is important, we can include a CMS in the scope. We agree which content your team needs to manage and how the handover will work." },
      { question: "How long does development take?", answer: "We estimate the timeline after reviewing the scope, available content, and integrations. Reviews and content preparation are part of that discussion; we do not promise a fixed turnaround before understanding the project." },
      { question: "Will the website appear in Google?", answer: "We can build the technical foundations for discovery, including useful page structure, metadata, and a sitemap. Indexing and rankings depend on search engines, competition, and the quality of your content; they are not guaranteed." },
    ],
  },
  {
    slug: "website-redesign", serviceSlug: "modernization", label: "Website redesign",
    title: "Website Redesign Services",
    description: "Improve an existing business website with Veloce. Clarify your content, resolve usability problems, and plan a careful migration that preserves useful pages.",
    heading: "Keep what works. Build a better website around it.",
    intro: "An existing website does not always need a complete restart. We review the content, navigation, and functionality you rely on, then recommend changes that address the problems your customers and team actually face.",
    fit: "A good fit when your website no longer reflects your business, is difficult to use on mobile, or makes content updates harder than they should be. Bring the current site and the problems you want to solve to our first conversation.",
    capabilities: [
      { title: "Content and navigation review", body: "Identify useful pages, confusing journeys, and missing information before deciding what to change." },
      { title: "Design and usability improvements", body: "Update key screens and customer journeys so visitors can understand your offer and find the next step." },
      { title: "A considered migration", body: "Inventory existing URLs and agree redirects for moved pages. Preserve valuable content and check links during the transition." },
      { title: "Performance and maintainability", body: "Review loading behavior, unnecessary dependencies, and the editing workflow. Focus improvements on observed issues." },
    ],
    process: "We review the existing website and available search data, agree what to retain, and propose the changes. You review the new structure and design before we build. Before launch, we check redirects, important forms, content, and device layouts.",
    questions: [
      { question: "Do we need to rebuild the whole website?", answer: "Not necessarily. We first assess the current platform and the changes you need. A targeted improvement may be enough; a rebuild makes sense when the existing structure prevents the required work." },
      { question: "Can we keep our existing content and domain?", answer: "Usually, yes. We review ownership, hosting, and platform constraints, then agree what can transfer and what needs updating. We plan the domain transition with you." },
      { question: "How do you handle existing search traffic?", answer: "We use the current URL inventory and any available Search Console data to identify important pages. Redirects and metadata checks help manage a migration, but a redesign cannot guarantee unchanged rankings." },
      { question: "What affects the price and timeline?", answer: "The existing platform, number of pages, content changes, integrations, and migration requirements all matter. We provide an estimate after reviewing those details." },
    ],
  },
  {
    slug: "ecommerce", serviceSlug: "ecommerce", label: "E-commerce websites",
    title: "E-commerce Website Development",
    description: "E-commerce website development shaped around your business. Work with Veloce on product catalogs, checkout, payment integrations, and order workflows.",
    heading: "An online store shaped around how you sell.",
    intro: "Selling online brings together your products, customers, payments, and operations. We help define the shopping experience and build the functionality your business needs, from product discovery through checkout and order handling.",
    fit: "A good fit for businesses launching online sales or improving a store whose workflows no longer fit. We start with your catalog, selling regions, delivery rules, and existing systems rather than assuming every store needs the same setup.",
    capabilities: [
      { title: "Catalog and product discovery", body: "Organize products, variants, and useful product information so customers can find and compare what you sell." },
      { title: "Cart, checkout, and payments", body: "Plan checkout around your business rules and integrate an agreed payment provider available in your selling regions." },
      { title: "Order and delivery workflows", body: "Define order updates and delivery options with your team. Include stock or fulfillment connections where the scope calls for them." },
      { title: "Connections to existing tools", body: "Integrate inventory, accounting, or customer tools when their APIs and your requirements support it." },
    ],
    process: "We map your catalog and order journey, review platform and provider requirements, and agree the first release. You review the key shopping screens before development. We test the agreed purchase and order workflows before launch and discuss ongoing support separately.",
    questions: [
      { question: "Which e-commerce platform should we use?", answer: "The choice depends on your catalog, business rules, budget, and editing needs. We discuss those requirements before recommending an existing platform or a custom implementation." },
      { question: "Can you connect our payment provider?", answer: "We review the provider's supported regions, account requirements, and integration options. Provider fees and approval requirements are separate from development work." },
      { question: "Can the store connect to our inventory system?", answer: "Where the system offers suitable integration access, we can scope a connection. We first review its API, data ownership, and how stock and orders should be synchronized." },
      { question: "How much does an online store cost?", answer: "The catalog, checkout rules, integrations, content, and operational requirements determine the scope. We propose an estimate after discussing the first version you need." },
    ],
  },
];

export const publicPagePaths = ["/", ...servicePages.map((page) => `/services/${page.slug}`), "/about", "/privacy", "/terms"];

/** Only pass tokens already validated by the campaign service. Keep fragments after the query. */
export function withReferral(href: string, refToken?: string): string {
  if (!refToken) return href;
  const [path = "", fragment] = href.split("#");
  return `${path}${path.includes("?") ? "&" : "?"}ref=${encodeURIComponent(refToken)}${fragment ? `#${fragment}` : ""}`;
}

export function servicePageHref(serviceSlug: string, refToken?: string): string | undefined {
  const page = servicePages.find((item) => item.serviceSlug === serviceSlug);
  return page ? withReferral(`/services/${page.slug}`, refToken) : undefined;
}
