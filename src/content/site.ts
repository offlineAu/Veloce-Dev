/**
 * Marketing content as data. Edit here (or via the Service table) without touching page code.
 * Brand copy below is supplied by the owner. Contains no prices, clients or performance results.
 */

export const brand = {
  tagline: "Build fast. Build what works.",
  short: "Veloce builds fast, practical, and reliable digital systems for businesses that need to turn ideas into working solutions.",
  about: [
    "Veloce is a software development company focused on building practical digital systems quickly and effectively. We help businesses turn ideas, processes, and problems into working websites, web applications, and custom business systems.",
    "Our approach is simple: understand what needs to be solved, build what matters, and get a working system into your hands as quickly as possible. We focus on useful functionality, clear user experiences, and solutions that can grow with the business, without unnecessary complexity.",
  ],
  value: "Your idea shouldn't stay an idea.",
  valueFlow: ["Idea", "Build", "Working System"],
  valueBody:
    "Instead of spending months planning a system before anyone can use it, we focus on delivering a functional solution early, validating it through real use, and improving it from there.",
  promise: "We help businesses move faster from an idea to a working digital system.",
  promiseFocus: ["Speed", "Functionality", "Simplicity", "Practicality", "Reliability", "Continuous improvement"],
  message: "Think it. Build it. Make it work.",
} as const;

/**
 * Headline numbers. Deliberately 0 until the owner decides what is true and worth showing
 * (projects shipped, clients served, ...). Do not fill these with estimates or anything that cannot be backed up.
 */
/** The stats strip on the sales page is hidden until real numbers exist. Set to true to show it again. */
export const SHOW_STATS = false;

export const stats = [
  { value: 0, label: "Projects shipped" },
  { value: 0, label: "Clients served" },
  { value: 0, label: "Systems live" },
] as const;

export const philosophy = [
  { title: "Fast doesn't mean rushed.", body: "Speed comes from focus. We reduce unnecessary complexity, prioritize the functionality that matters, and build in practical iterations." },
  { title: "Working software comes first.", body: "A system should do something useful. We aim to get a meaningful working version in front of users early, rather than designing every possibility up front." },
  { title: "Build for the real business.", body: "Every business has different processes, customers, and constraints. We build around the actual problem being solved." },
  { title: "Improve as we learn.", body: "The first working version is not necessarily the final one. Real users give better information than assumptions, and we use that feedback to refine and expand the system." },
];

export const servicePaths = [
  { id: "customers", label: "Reach your customers", description: "A clearer presence. A simpler way to buy or get in touch.", icon: "globe", slugs: ["business-websites", "web-applications", "ecommerce"] },
  { id: "operations", label: "Run the day-to-day", description: "Give your team tools that fit the work they do.", icon: "flow", slugs: ["internal-systems", "automation", "dashboards-portals", "integrations"] },
  { id: "existing", label: "Improve what exists", description: "Keep the useful parts. Resolve what gets in the way.", icon: "refresh", slugs: ["modernization", "support"] },
] as const;

export interface ServiceItem {
  slug: string;
  title: string;
  description: string;
  benefit: string;
  icon: string;
}

export const defaultServices: ServiceItem[] = [
  { slug: "business-websites", title: "Business websites", description: "Websites that present your business clearly and give visitors a straightforward way to get in touch.", benefit: "Live quickly, ready to grow.", icon: "briefcase" },
  { slug: "web-applications", title: "Customer-facing web applications", description: "Web applications your customers use directly, built around the way they actually work with you.", benefit: "Software your customers can use.", icon: "app" },
  { slug: "internal-systems", title: "Internal business systems", description: "Systems that run your team's day-to-day work, shaped around your real processes.", benefit: "Tools that fit how you work.", icon: "building" },
  { slug: "automation", title: "Workflow and process automation", description: "Hand repetitive steps such as emails, approvals and updates to the system.", benefit: "Less manual repetition.", icon: "flow" },
  { slug: "dashboards-portals", title: "Custom dashboards and portals", description: "One place for your team or customers to see what matters and act on it.", benefit: "The right information, in one place.", icon: "dash" },
  { slug: "ecommerce", title: "E-commerce systems", description: "Online stores with shopping experiences and business rules shaped around how you sell.", benefit: "Sell the way your business works.", icon: "bag" },
  { slug: "integrations", title: "API and third-party integrations", description: "Connect your systems with the tools and services you already use.", benefit: "Fewer disconnected tools.", icon: "plug" },
  { slug: "modernization", title: "System improvements and modernization", description: "Improve or modernize an existing website or application without starting from zero.", benefit: "Keep what works, fix what doesn't.", icon: "refresh" },
  { slug: "support", title: "Ongoing development and support", description: "Continued development and support after the first version is live.", benefit: "Keep improving as you learn.", icon: "buoy" },
];

export const strengths = [
  { icon: "code", title: "Built to your requirements", body: "Designed around your business rather than adapted from a theme." },
  { icon: "phone", title: "Responsive design", body: "Reads and works well on phones, tablets and desktops." },
  { icon: "users", title: "Business-focused UX", body: "Journeys shaped around how your customers decide." },
  { icon: "layers", title: "Room to grow", body: "Structured so new pages and features can be added later." },
  { icon: "plug", title: "Third-party integrations", body: "Connects with the tools and services you already rely on." },
  { icon: "buoy", title: "Support after launch", body: "Help with updates and improvements, on terms we agree together." },
];

export const customVsTemplate = {
  intro: "Templates are a sensible starting point for many websites. Custom development earns its cost when your business has specific needs.",
  templateFits: {
    label: "A template is often enough when",
    points: [
      "You need a simple site up quickly",
      "Your needs match common layouts and plugins",
      "You have limited budget and few special requirements",
      "You are happy to adapt your process to the tool",
    ],
  },
  customFits: {
    label: "Custom development helps when",
    points: [
      "Your workflow is unusual and the site should follow it",
      "You need integrations a template can't provide",
      "You expect to add features or traffic over time",
      "You want full control over design, data and behavior",
    ],
  },
};

/**
 * Landing sections (hero, services carousel, "built around your business"). Layout follows the owner's reference design;
 * the copy describes how Veloce works and makes no claims about clients, results or speed.
 */
export const landing = {
  heroEyebrow: "Custom software & web development",
  heroSideLabel: "Custom development",
  heroSide: ["Made for", "your growth"],
  servicesEyebrow: "Tailored services",
  servicesTitle: "Services tailored to what you need. Built to help your business succeed.",
  featured: {
    badge: "Start here",
    title: "Talk to the builders",
    body: "Tell us what needs to work better. We'll suggest a first version worth building, in plain language.",
    cta: "Work with us",
  },
  /** Last card in the carousel: a photo card pointing to the full service list. */
  closing: {
    title: "Not sure where it fits?",
    body: "Browse every service by what needs to work better, then ask about the parts that matter to you.",
    cta: "Explore every service",
  },
  approachEyebrow: "Client-focused approach",
  approachTitle: "Built around your business, your team, and your customers.",
  approachLead: "No buzzwords and no overcomplicated process. We build around the problem you actually need solved, and improve it through real use.",
  approachCta: "See if we're a good fit",
  /** Decorative floating cards around the rings: how the work runs, never names, quotes or numbers. */
  approachCards: {
    early: { title: "Working version early", note: "Something real to try" },
    progress: { title: "Visible progress", note: "Review it as it's built" },
    scope: { title: "A scope you can change", note: "First things first" },
    improve: { title: "Improve from real use", note: "Learn, then refine" },
  },
};

/** Technology choices and their purpose; no vendor partnerships or delivery guarantees. */
export const modernTools = {
  eyebrow: "Built with modern tools",
  title: "The right tools for what you need.",
  lead: "We choose the technology around your workflows, existing systems, and plans for growth.",
  items: [
    {
      id: "web",
      title: "Web experiences",
      description: "Websites and web apps designed for phones, tablets, and desktops.",
      detail: "React · Next.js · TypeScript",
    },
    {
      id: "data",
      title: "Business data",
      description: "Structure the records your team needs to manage and use.",
      detail: "PostgreSQL · Prisma",
    },
    {
      id: "integrations",
      title: "Integrations & automation",
      description: "Connect existing tools and reduce repetitive steps.",
      detail: "APIs · Workflow automation",
    },
    {
      id: "deployment",
      title: "Deployment & support",
      description: "Plan how your system goes live and how it will be maintained.",
      detail: "Hosting and support scoped to the project",
    },
  ],
} as const;

export const processSteps = [
  { title: "Understand the problem", body: "We learn about your business, processes and constraints, and what needs to be solved." },
  { title: "Agree what matters", body: "We turn that into a clear scope: the functionality that matters first, and what can wait." },
  { title: "Design the key screens", body: "You see how the system will look and behave before the building begins." },
  { title: "Build a working version", body: "We build in practical iterations to get something useful in front of you early." },
  { title: "Test with real use", body: "Real use tells us more than assumptions. We check, fix and learn from it." },
  { title: "Improve and support", body: "We refine and extend the system from what we learn, with support as agreed." },
];

/** Three decision points, covering all six delivery steps without repeating a second process list. */
export const deliveryStages = [
  {
    id: "think", label: "Think it.", headline: "Build what matters.", icon: "map",
    summary: "Turn the problem into a first version worth building. We make the priorities clear before adding complexity.",
    steps: processSteps.slice(0, 2),
    yourPart: "Show us how the work happens today, where it gets stuck, and what a useful first version needs to do.",
    youReceive: "A proposed scope: what comes first, what can wait, and a discussion of timing and cost.",
    principle: "Speed comes from focus, with a scope you can question and change.",
  },
  {
    id: "build", label: "Build it.", headline: "Build what works.", icon: "hammer",
    summary: "See the key screens, then try a functional version. We build in practical iterations so there is something real to discuss.",
    steps: processSteps.slice(2, 4),
    yourPart: "Review the key journeys and try the working version against the tasks your customers or team need to complete.",
    youReceive: "Screen designs and a working version of the agreed functionality, ready for review and testing.",
    principle: "Working software gives us better information than assumptions.",
  },
  {
    id: "improve", label: "Make it work.", headline: "Improve as we learn.", icon: "refresh",
    summary: "Check the system through real use, fix what gets in the way, and agree what to improve next.",
    steps: processSteps.slice(4, 6),
    yourPart: "Share what happened in real use: useful features, awkward steps, and changes in your business needs.",
    youReceive: "Tested improvements and agreed next steps for further development and support.",
    principle: "The next improvement should earn its place through real use.",
  },
] as const;

/** Illustrations of a possible workflow, never presented as real clients, bookings, or approvals. */
export const workflowExamples = [
  {
    id: "booking", label: "Customer bookings", problem: "Booking requests are scattered across messages.",
    first: "Choose an available time", later: "Automated reminders", buildTitle: "Try choosing a time",
    options: ["09:00", "11:30", "14:00"], selectionLabel: "Choose a sample time", selectionResult: "Selected time",
    alternate: { title: "Try choosing a reminder channel", options: ["Email", "SMS"], selectionLabel: "Choose a sample reminder channel", selectionResult: "Reminder channel" },
    feedback: ["Send reminders", "Let customers reschedule"], feedbackLabel: "What would help next?",
    alternateFeedback: ["Let customers choose a time", "Add a reminder delivery log"],
  },
  {
    id: "approvals", label: "Team approvals", problem: "Requests get lost between email and spreadsheets.",
    first: "Review a request in one place", later: "Automatic escalation", buildTitle: "Try reviewing a request",
    options: ["Approve", "Request changes"], selectionLabel: "Choose a sample review action", selectionResult: "Review action",
    alternate: { title: "Try choosing an escalation rule", options: ["After 1 day", "After 3 days"], selectionLabel: "Choose a sample escalation rule", selectionResult: "Escalation rule" },
    feedback: ["Notify the requester", "Show overdue requests"], feedbackLabel: "What would help next?",
    alternateFeedback: ["Review requests in one place", "Allow a different escalation rule"],
  },
] as const;

export const capabilityGroups: { id: string; label: string; items: { icon: string; title: string; body: string }[] }[] = [
  {
    id: "customers",
    label: "For customers",
    items: [
      { icon: "form", title: "Contact forms", body: "Enquiry and quote forms that route to the right person." },
      { icon: "calendar", title: "Booking systems", body: "Online scheduling built around your availability rules." },
      { icon: "user", title: "Customer portals", body: "Secure areas for customers to view orders, files or accounts." },
      { icon: "shield", title: "Authentication", body: "Sign-in, roles and permissions for members or staff." },
    ],
  },
  {
    id: "operations",
    label: "For your team",
    items: [
      { icon: "dash", title: "Admin dashboards", body: "One place to manage content, customers and requests." },
      { icon: "pen", title: "CMS functionality", body: "Edit pages and content yourself, without a developer." },
      { icon: "chart", title: "Analytics", body: "See how visitors find and use your site." },
      { icon: "flow", title: "Automated workflows", body: "Hand repetitive steps such as emails, approvals and updates to the system." },
    ],
  },
  {
    id: "commerce",
    label: "Commerce & data",
    items: [
      { icon: "bag", title: "E-commerce functionality", body: "Catalogs, carts and checkout shaped to how you sell." },
      { icon: "card", title: "Payment integrations", body: "Accept payments through the providers you choose." },
      { icon: "plug", title: "API integrations", body: "Connect your CRM, inventory, accounting or other tools." },
      { icon: "calc", title: "Custom calculators", body: "Quotes, estimates or pricing tools specific to your offer." },
    ],
  },
];

export const expectations = [
  { title: "An initial discussion", body: "We start with a conversation about your business, before recommending anything." },
  { title: "Project requirements", body: "We work out what functionality, design and technology make sense." },
  { title: "A proposed scope", body: "You see what we propose to build, and what we don't, before you decide." },
  { title: "A timeline estimate", body: "We estimate timing once we understand the scope. Any estimate is discussed with you, not promised in advance." },
  { title: "A pricing discussion", body: "We talk about cost openly once scope is clear. There is no price list on this page." },
  { title: "Clear next steps", body: "You'll know what happens next, and you're free to say no." },
];

export const referralSteps = [
  { title: "Share", body: "Send the message below to someone who may need a website." },
  { title: "Introduce", body: "Tell us who you're introducing. The form takes a minute." },
  { title: "Build", body: "Our team reviews it and follows up about their needs." },
];

/** The "What we offer" walkthrough for the site builder at /build. Template ids match src/components/builder/templates.ts. */
export const builderGuide = {
  heading: "Design it yourself. We build it for real.",
  lead: "Not sure how to describe the website you want? Sketch it in our builder. No account, no code, nothing to install. When it looks right, send it to us and we'll turn it into a fast, finished site.",
  steps: [
    { title: "Pick a template", body: "Start from a business, restaurant, portfolio, product or shop layout, or a blank page." },
    { title: "Drag in blocks", body: "Add heroes, features, pricing, FAQs and more. Click any text to edit it in place." },
    { title: "Make it yours", body: "Change colours and fonts, save sections you like, or paste your own HTML." },
    { title: "Send it to us", body: "We review your design and reply with questions, a scope and an honest estimate." },
  ],
  templates: [
    { id: "business", label: "Business" },
    { id: "restaurant", label: "Restaurant" },
    { id: "portfolio", label: "Portfolio" },
    { id: "saas", label: "Product" },
    { id: "shop", label: "Shop" },
  ],
  note: "Your draft is saved in this browser as you work. Nothing is shared until you choose to send it.",
};

/** What the inquiry dialog adapts to when it is opened from a service card. */
export interface ServiceInquiry {
  projectType: string;
  websiteType?: string;
  goalsPlaceholder: string;
}

export const serviceInquiries: Record<string, ServiceInquiry> = {
  "business-websites": { projectType: "NEW_PROJECT", websiteType: "BUSINESS", goalsPlaceholder: "e.g. A website for our clinic with online booking" },
  "web-applications": { projectType: "CUSTOM_WEB_APP", goalsPlaceholder: "e.g. A portal where customers track their orders" },
  "internal-systems": { projectType: "CUSTOM_WEB_APP", goalsPlaceholder: "e.g. Replace our spreadsheet-based order tracking" },
  "automation": { projectType: "CUSTOM_WEB_APP", goalsPlaceholder: "e.g. Send approvals and reminders without manual emails" },
  "dashboards-portals": { projectType: "CUSTOM_WEB_APP", goalsPlaceholder: "e.g. One dashboard of sales and stock for the team" },
  "ecommerce": { projectType: "ECOMMERCE", websiteType: "ECOMMERCE_STORE", goalsPlaceholder: "e.g. An online store for 200 products with local delivery" },
  "integrations": { projectType: "INTEGRATION", goalsPlaceholder: "e.g. Sync our booking system with accounting software" },
  "modernization": { projectType: "REDESIGN", goalsPlaceholder: "e.g. Our current site is slow and hard to update" },
  "support": { projectType: "MAINTENANCE", goalsPlaceholder: "e.g. Ongoing fixes and new features for our app" },
};
