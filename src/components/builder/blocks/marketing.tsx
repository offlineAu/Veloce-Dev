/* eslint-disable @next/next/no-img-element -- visitor images are arbitrary external URLs */
import type { ComponentConfig, PuckContext } from "@puckeditor/core";
import { linkField, linkProps } from "../links";
import {
  accentTextOn, alignClass, alignOptions, cardOn, cardRadius, headingFont, labelClass, mutedOn, siteButton, toneClass, toneOptions,
  type Align, type Tone,
} from "./shared";

const cta = (label: string, href: string, tone: Tone, variant: "solid" | "outline", puck: PuckContext) =>
  label ? (
    <a {...linkProps(href, puck)} className={siteButton(tone, variant)}>
      {label}
    </a>
  ) : null;

export type HeroProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
  image: string;
  layout: "split" | "centered";
  tone: Tone;
};

export const Hero: ComponentConfig<HeroProps> = {
  label: "Hero",
  fields: {
    eyebrow: { type: "text", label: "Small label above", contentEditable: true },
    title: { type: "text", label: "Headline", contentEditable: true },
    subtitle: { type: "textarea", label: "Supporting line", contentEditable: true },
    primaryLabel: { type: "text", label: "Main button" },
    primaryHref: linkField("Main button link"),
    secondaryLabel: { type: "text", label: "Second button (optional)" },
    secondaryHref: linkField("Second button link"),
    image: { type: "text", label: "Image URL (optional)" },
    layout: { type: "radio", label: "Layout", options: [{ label: "Split", value: "split" }, { label: "Centred", value: "centered" }] },
    tone: { type: "select", label: "Background", options: [...toneOptions] },
  },
  defaultProps: {
    eyebrow: "New in town",
    title: "Your business, explained in one line",
    subtitle: "Say who you help and the result they get. Keep it short enough to read in three seconds.",
    primaryLabel: "Book a call",
    primaryHref: "#contact",
    secondaryLabel: "See our work",
    secondaryHref: "#work",
    image: "",
    layout: "split",
    tone: "tinted",
  },
  render: ({ eyebrow, title, subtitle, primaryLabel, primaryHref, secondaryLabel, secondaryHref, image, layout, tone, puck }) => {
    const centred = layout === "centered";
    const media = /^https?:\/\//i.test(image) ? (
      <img src={image} alt="" className={`aspect-[4/3] w-full object-cover ${cardRadius}`} />
    ) : (
      <div aria-hidden className={`aspect-[4/3] w-full bg-(--site-accent) opacity-20 ${cardRadius}`} />
    );
    return (
      <section className={`${toneClass[tone]} px-6 py-20 md:py-28`}>
        <div className={`mx-auto grid max-w-6xl items-center gap-12 ${centred ? "" : "md:grid-cols-2"}`}>
          <div className={`flex flex-col gap-5 ${centred ? "mx-auto max-w-3xl items-center text-center" : "items-start"}`}>
            {eyebrow ? <span className={`${labelClass} ${accentTextOn(tone)}`}>{eyebrow}</span> : null}
            <h1 className={`${headingFont} text-5xl leading-[1.05] tracking-tight md:text-6xl`}>{title}</h1>
            <p className={`max-w-[50ch] text-lg leading-relaxed ${mutedOn(tone)}`}>{subtitle}</p>
            <div className="mt-2 flex flex-wrap gap-3">
              {cta(primaryLabel, primaryHref, tone, "solid", puck)}
              {cta(secondaryLabel, secondaryHref, tone, "outline", puck)}
            </div>
          </div>
          {centred ? null : media}
        </div>
      </section>
    );
  },
};

export type FeaturesProps = { title: string; intro: string; columns: "2" | "3" | "4"; tone: Tone; items: { icon: string; title: string; body: string }[] };

export const Features: ComponentConfig<FeaturesProps> = {
  label: "Features grid",
  fields: {
    title: { type: "text", label: "Title", contentEditable: true },
    intro: { type: "textarea", label: "Intro" },
    columns: { type: "radio", label: "Columns", options: [{ label: "2", value: "2" }, { label: "3", value: "3" }, { label: "4", value: "4" }] },
    tone: { type: "select", label: "Background", options: [...toneOptions] },
    items: {
      type: "array",
      label: "Features",
      arrayFields: { icon: { type: "text", label: "Emoji or symbol" }, title: { type: "text", label: "Title" }, body: { type: "textarea", label: "Description" } },
      defaultItemProps: { icon: "★", title: "Another benefit", body: "One sentence on why it matters." },
      getItemSummary: (i) => i.title || "Feature",
    },
  },
  defaultProps: {
    title: "Why people choose us",
    intro: "",
    columns: "3",
    tone: "light",
    items: [
      { icon: "⚡", title: "Fast", body: "Quick turnaround without cutting corners." },
      { icon: "🤝", title: "Personal", body: "You talk to the people doing the work." },
      { icon: "🛡️", title: "Reliable", body: "Clear prices, honest timelines, no surprises." },
    ],
  },
  render: ({ title, intro, columns, tone, items }) => (
    <section className={`${toneClass[tone]} px-6 py-16 md:py-24`}>
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <div className="flex max-w-2xl flex-col gap-3">
          <h2 className={`${headingFont} text-4xl tracking-tight`}>{title}</h2>
          {intro ? <p className={`text-lg ${mutedOn(tone)}`}>{intro}</p> : null}
        </div>
        <div className={`grid gap-6 sm:grid-cols-2 ${columns === "4" ? "lg:grid-cols-4" : columns === "3" ? "lg:grid-cols-3" : ""}`}>
          {items.map((f, i) => (
            <div key={i} className={`flex flex-col gap-3 p-6 ${cardOn(tone)}`}>
              <span aria-hidden className="text-3xl">{f.icon}</span>
              <h3 className="text-xl font-semibold">{f.title}</h3>
              <p className={mutedOn(tone)}>{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  ),
};

export type PricingProps = {
  title: string;
  tone: Tone;
  plans: { name: string; price: string; period: string; features: string; cta: string; highlighted: boolean }[];
};

export const Pricing: ComponentConfig<PricingProps> = {
  label: "Pricing table",
  fields: {
    title: { type: "text", label: "Title", contentEditable: true },
    tone: { type: "select", label: "Background", options: [...toneOptions] },
    plans: {
      type: "array",
      label: "Plans",
      max: 4,
      arrayFields: {
        name: { type: "text", label: "Plan name" },
        price: { type: "text", label: "Price" },
        period: { type: "text", label: "Per (e.g. /month)" },
        features: { type: "textarea", label: "Features (one per line)" },
        cta: { type: "text", label: "Button label" },
        highlighted: { type: "radio", label: "Highlight", options: [{ label: "Yes", value: true }, { label: "No", value: false }] },
      },
      defaultItemProps: { name: "Plan", price: "$0", period: "/month", features: "Feature one\nFeature two", cta: "Choose", highlighted: false },
      getItemSummary: (p) => p.name || "Plan",
    },
  },
  defaultProps: {
    title: "Simple pricing",
    tone: "tinted",
    plans: [
      { name: "Starter", price: "$29", period: "/month", features: "1 location\nEmail support", cta: "Start", highlighted: false },
      { name: "Growth", price: "$79", period: "/month", features: "3 locations\nPriority support\nMonthly report", cta: "Choose Growth", highlighted: true },
      { name: "Pro", price: "$149", period: "/month", features: "Unlimited locations\nDedicated manager", cta: "Talk to us", highlighted: false },
    ],
  },
  render: ({ title, tone, plans, puck }) => (
    <section className={`${toneClass[tone]} px-6 py-16 md:py-24`}>
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-10">
        <h2 className={`${headingFont} text-center text-4xl tracking-tight`}>{title}</h2>
        <div className={`grid w-full gap-6 ${plans.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2"} ${plans.length === 4 ? "lg:grid-cols-4" : ""}`}>
          {plans.map((p, i) => (
            <div key={i} className={`flex flex-col gap-4 border border-(--site-line) bg-(--site-bg) p-8 text-(--site-fg) ${cardRadius} ${p.highlighted ? "ring-4 ring-(--site-accent)" : ""}`}>
              <h3 className="text-lg font-semibold">{p.name}</h3>
              <p><span className={`${headingFont} text-5xl`}>{p.price}</span><span className="text-(--site-muted)">{p.period}</span></p>
              <ul className="flex flex-1 flex-col gap-2 text-(--site-muted)">
                {p.features.split("\n").filter(Boolean).map((f) => <li key={f} className="flex gap-2"><span aria-hidden className="text-(--site-accent)">✓</span>{f}</li>)}
              </ul>
              {cta(p.cta, "#contact", "light", p.highlighted ? "solid" : "outline", puck)}
            </div>
          ))}
        </div>
      </div>
    </section>
  ),
};

export type TestimonialsProps = { title: string; tone: Tone; quotes: { quote: string; name: string; role: string }[] };

export const Testimonials: ComponentConfig<TestimonialsProps> = {
  label: "Testimonials",
  fields: {
    title: { type: "text", label: "Title", contentEditable: true },
    tone: { type: "select", label: "Background", options: [...toneOptions] },
    quotes: {
      type: "array",
      label: "Quotes",
      arrayFields: { quote: { type: "textarea", label: "Quote" }, name: { type: "text", label: "Name" }, role: { type: "text", label: "Role or company" } },
      defaultItemProps: { quote: "A short, specific sentence from a happy customer.", name: "Customer name", role: "Role, Company" },
      getItemSummary: (q) => q.name || "Quote",
    },
  },
  defaultProps: {
    title: "What our customers say",
    tone: "light",
    quotes: [
      { quote: "They understood what we needed in the first meeting.", name: "Alex R.", role: "Owner, Corner Café" },
      { quote: "Our bookings doubled within two months.", name: "Sam T.", role: "Manager, City Physio" },
    ],
  },
  render: ({ title, tone, quotes }) => (
    <section className={`${toneClass[tone]} px-6 py-16 md:py-24`}>
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <h2 className={`${headingFont} text-4xl tracking-tight`}>{title}</h2>
        <div className="grid gap-6 md:grid-cols-2">
          {quotes.map((q, i) => (
            <figure key={i} className={`flex flex-col gap-4 p-8 ${cardOn(tone)}`}>
              <blockquote className="text-xl leading-relaxed">“{q.quote}”</blockquote>
              <figcaption className={`text-sm ${mutedOn(tone)}`}><strong className="font-semibold">{q.name}</strong>{q.role ? ` · ${q.role}` : ""}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  ),
};

export type FaqProps = { title: string; align: Align; items: { question: string; answer: string }[] };

export const Faq: ComponentConfig<FaqProps> = {
  label: "FAQ",
  fields: {
    title: { type: "text", label: "Title", contentEditable: true },
    align: { type: "radio", label: "Title align", options: [...alignOptions] },
    items: {
      type: "array",
      label: "Questions",
      arrayFields: { question: { type: "text", label: "Question" }, answer: { type: "textarea", label: "Answer" } },
      defaultItemProps: { question: "A question people ask?", answer: "A short, honest answer." },
      getItemSummary: (q) => q.question || "Question",
    },
  },
  defaultProps: {
    title: "Questions, answered",
    align: "left",
    items: [
      { question: "How long does it take?", answer: "Most projects take two to four weeks." },
      { question: "Do you offer refunds?", answer: "Yes, within 30 days if you're not happy." },
    ],
  },
  render: ({ title, align, items }) => (
    <section className="bg-(--site-bg) px-6 py-16 text-(--site-fg) md:py-24">
      <div className={`mx-auto flex max-w-3xl flex-col gap-8 ${alignClass[align]}`}>
        <h2 className={`${headingFont} text-4xl tracking-tight`}>{title}</h2>
        <div className="flex w-full flex-col divide-y divide-(--site-line) text-left">
          {items.map((q, i) => (
            <details key={i} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">
                {q.question}
                <span aria-hidden className="text-(--site-accent) transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-(--site-muted)">{q.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  ),
};

export type CtaBandProps = { title: string; body: string; buttonLabel: string; buttonHref: string; tone: Tone };

export const CtaBand: ComponentConfig<CtaBandProps> = {
  label: "Call to action",
  fields: {
    title: { type: "text", label: "Title", contentEditable: true },
    body: { type: "textarea", label: "Text", contentEditable: true },
    buttonLabel: { type: "text", label: "Button label" },
    buttonHref: linkField("Button link"),
    tone: { type: "select", label: "Background", options: [...toneOptions] },
  },
  defaultProps: { title: "Ready when you are", body: "Tell us what you need and we'll reply within a day.", buttonLabel: "Get started", buttonHref: "#contact", tone: "accent" },
  render: ({ title, body, buttonLabel, buttonHref, tone, puck }) => (
    <section className="px-6 py-12">
      <div className={`${toneClass[tone]} mx-auto flex max-w-6xl flex-col items-center gap-5 px-8 py-16 text-center ${cardRadius}`}>
        <h2 className={`${headingFont} text-4xl tracking-tight md:text-5xl`}>{title}</h2>
        <p className={`max-w-[50ch] text-lg ${mutedOn(tone)}`}>{body}</p>
        {cta(buttonLabel, buttonHref, tone, "solid", puck)}
      </div>
    </section>
  ),
};

export type ContactProps = { title: string; body: string; email: string; phone: string; address: string; showForm: boolean; tone: Tone };

export const Contact: ComponentConfig<ContactProps> = {
  label: "Contact",
  fields: {
    title: { type: "text", label: "Title", contentEditable: true },
    body: { type: "textarea", label: "Text" },
    email: { type: "text", label: "Email" },
    phone: { type: "text", label: "Phone" },
    address: { type: "textarea", label: "Address" },
    showForm: { type: "radio", label: "Contact form", options: [{ label: "Show", value: true }, { label: "Hide", value: false }] },
    tone: { type: "select", label: "Background", options: [...toneOptions] },
  },
  defaultProps: { title: "Get in touch", body: "We usually reply within one working day.", email: "hello@yourbusiness.com", phone: "", address: "", showForm: true, tone: "tinted" },
  render: ({ title, body, email, phone, address, showForm, tone }) => (
    <section id="contact" className={`${toneClass[tone]} px-6 py-16 md:py-24`}>
      <div className={`mx-auto grid max-w-6xl gap-12 ${showForm ? "md:grid-cols-2" : ""}`}>
        <div className="flex flex-col gap-4">
          <h2 className={`${headingFont} text-4xl tracking-tight`}>{title}</h2>
          <p className={`text-lg ${mutedOn(tone)}`}>{body}</p>
          <dl className="mt-2 flex flex-col gap-2">
            {email ? <div><dt className="sr-only">Email</dt><dd className="font-semibold">{email}</dd></div> : null}
            {phone ? <div><dt className="sr-only">Phone</dt><dd>{phone}</dd></div> : null}
            {address ? <div><dt className="sr-only">Address</dt><dd className="whitespace-pre-line">{address}</dd></div> : null}
          </dl>
        </div>
        {showForm ? (
          // A visual stand-in: the working form is built with the real site.
          <div aria-label="Contact form preview" role="group" className={`flex flex-col gap-3 border border-(--site-line) bg-(--site-bg) p-6 text-(--site-fg) ${cardRadius}`}>
            {["Name", "Email", "Message"].map((f) => (
              <div key={f} className="flex flex-col gap-1">
                <span className="text-sm font-semibold">{f}</span>
                <div className={`rounded-[min(var(--site-button-radius),0.75rem)] border border-(--site-line) ${f === "Message" ? "h-24" : "h-11"}`} />
              </div>
            ))}
            <span className={`${siteButton("light")} mt-2 self-start`}>Send message</span>
          </div>
        ) : null}
      </div>
    </section>
  ),
};
