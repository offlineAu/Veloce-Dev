/* eslint-disable @next/next/no-img-element -- visitor images are arbitrary addresses or uploads */
import type { ComponentConfig } from "@puckeditor/core";
import { isMediaSrc } from "@/lib/builder/media";
import { imageField } from "../media-tools";
import { kitFor, looks, toneOptions, withLook, type Look, type Tone } from "./shared";

/*
 * More ready-made sections: numbers, steps, a gallery, a team and a row of logos. Like the others (marketing.tsx), they
 * take on a template's own headings, text, cards and images with "Match design" (template-kit.ts), and the site theme
 * otherwise.
 */

const showable = (src: string | undefined) => !!src && (/^https:\/\//i.test(src) || src.startsWith("/build/t/") || src.startsWith("/builder-templates/") || isMediaSrc(src));

/** A section's title and intro, the same in every one of these. */
function Head({ title, intro, l }: { title: string; intro?: string; l: ReturnType<typeof looks> }) {
  return (
    <div className="flex max-w-2xl flex-col gap-3">
      <h2 className={l.h2}>{title}</h2>
      {intro ? <p className={l.lead}>{intro}</p> : null}
    </div>
  );
}

const sectionFields = {
  title: { type: "text", label: "Title", contentEditable: true },
  intro: { type: "textarea", label: "Intro" },
  tone: { type: "select", label: "Background", options: [...toneOptions] },
} as const;

export type StatsProps = { title: string; intro: string; tone: Tone; items: { value: string; label: string }[]; look?: Look };

export const Stats: ComponentConfig<StatsProps> = withLook({
  label: "Numbers",
  fields: {
    ...sectionFields,
    items: {
      type: "array",
      label: "Numbers",
      arrayFields: { value: { type: "text", label: "Number" }, label: { type: "text", label: "What it counts" } },
      defaultItemProps: { value: "100+", label: "Something worth counting" },
      getItemSummary: (i) => i.value || "Number",
    },
  },
  defaultProps: {
    title: "In numbers",
    intro: "",
    tone: "tinted",
    items: [
      { value: "12 yrs", label: "In business" },
      { value: "450+", label: "Projects delivered" },
      { value: "4.9/5", label: "Average review" },
      { value: "24 h", label: "Typical reply time" },
    ],
  },
  render: ({ title, intro, tone, items, look, puck }) => {
    const l = looks(kitFor(puck, look), tone);
    return (
      <section className={l.section}>
        <div className={`flex flex-col gap-10 ${l.container}`}>
          <Head title={title} intro={intro} l={l} />
          <dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((s, i) => (
              <div key={i} className={`flex flex-col gap-1 ${l.card}`}>
                <dt className={`order-2 ${l.text}`}>{s.label}</dt>
                <dd className={`order-1 ${l.h2}`}>{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    );
  },
}, ["tone"]);

export type StepsProps = { title: string; intro: string; tone: Tone; items: { title: string; body: string }[]; look?: Look };

export const Steps: ComponentConfig<StepsProps> = withLook({
  label: "How it works",
  fields: {
    ...sectionFields,
    items: {
      type: "array",
      label: "Steps",
      arrayFields: { title: { type: "text", label: "Step" }, body: { type: "textarea", label: "Description" } },
      defaultItemProps: { title: "Another step", body: "What happens, in a sentence." },
      getItemSummary: (i) => i.title || "Step",
    },
  },
  defaultProps: {
    title: "How it works",
    intro: "Three steps from first message to finished work.",
    tone: "light",
    items: [
      { title: "Tell us what you need", body: "A short message or call is enough to start." },
      { title: "Get a clear plan", body: "A fixed price and a date, before any work begins." },
      { title: "See it done", body: "We keep you posted until it's finished." },
    ],
  },
  render: ({ title, intro, tone, items, look, puck }) => {
    const l = looks(kitFor(puck, look), tone);
    return (
      <section className={l.section}>
        <div className={`flex flex-col gap-10 ${l.container}`}>
          <Head title={title} intro={intro} l={l} />
          <ol className="grid gap-6 md:grid-cols-3">
            {items.map((s, i) => (
              <li key={i} className={`flex flex-col gap-3 ${l.card}`}>
                <span aria-hidden className={l.label}>{String(i + 1).padStart(2, "0")}</span>
                <h3 className={l.h3}>{s.title}</h3>
                <p className={l.text}>{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    );
  },
}, ["tone"]);

export type GalleryProps = { title: string; intro: string; tone: Tone; shape: "square" | "4/3" | "3/4"; items: { src: string; alt: string }[]; look?: Look };

export const Gallery: ComponentConfig<GalleryProps> = withLook({
  label: "Gallery",
  fields: {
    ...sectionFields,
    shape: { type: "radio", label: "Shape", options: [{ label: "Square", value: "square" }, { label: "Landscape", value: "4/3" }, { label: "Portrait", value: "3/4" }] },
    items: {
      type: "array",
      label: "Pictures",
      arrayFields: { src: imageField("Picture"), alt: { type: "text", label: "Description (for screen readers)" } },
      defaultItemProps: { src: "", alt: "" },
      getItemSummary: (i) => i.alt || "Picture",
    },
  },
  defaultProps: { title: "Our work", intro: "", tone: "light", shape: "square", items: [{ src: "", alt: "" }, { src: "", alt: "" }, { src: "", alt: "" }] },
  render: ({ title, intro, tone, shape, items, look, puck }) => {
    const l = looks(kitFor(puck, look), tone);
    const aspect = shape === "4/3" ? "aspect-[4/3]" : shape === "3/4" ? "aspect-[3/4]" : "aspect-square";
    return (
      <section className={l.section}>
        <div className={`flex flex-col gap-10 ${l.container}`}>
          <Head title={title} intro={intro} l={l} />
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {items.map((g, i) => (
              <li key={i} className={aspect}>
                {showable(g.src) ? (
                  <img src={g.src} alt={g.alt} loading="lazy" className={`size-full object-cover ${l.image}`} />
                ) : (
                  <div className="grid size-full place-items-center rounded-xl border border-dashed border-current/30 text-sm opacity-60">Add a picture</div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  },
}, ["tone"]);

export type TeamProps = { title: string; intro: string; tone: Tone; items: { photo: string; name: string; role: string }[]; look?: Look };

export const Team: ComponentConfig<TeamProps> = withLook({
  label: "Team",
  fields: {
    ...sectionFields,
    items: {
      type: "array",
      label: "People",
      arrayFields: { photo: imageField("Photo"), name: { type: "text", label: "Name" }, role: { type: "text", label: "Role" } },
      defaultItemProps: { photo: "", name: "New person", role: "Role" },
      getItemSummary: (i) => i.name || "Person",
    },
  },
  defaultProps: {
    title: "Meet the team",
    intro: "",
    tone: "light",
    items: [
      { photo: "", name: "Alex Rivera", role: "Founder" },
      { photo: "", name: "Sam Lee", role: "Design" },
      { photo: "", name: "Jordan Cruz", role: "Support" },
    ],
  },
  render: ({ title, intro, tone, items, look, puck }) => {
    const l = looks(kitFor(puck, look), tone);
    return (
      <section className={l.section}>
        <div className={`flex flex-col gap-10 ${l.container}`}>
          <Head title={title} intro={intro} l={l} />
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p, i) => (
              <li key={i} className={`flex flex-col gap-3 ${l.card}`}>
                {showable(p.photo) ? (
                  <img src={p.photo} alt="" loading="lazy" className={`aspect-square w-full object-cover ${l.image}`} />
                ) : (
                  <div aria-hidden className="grid aspect-square w-full place-items-center rounded-xl bg-current/10 text-4xl font-semibold opacity-60">
                    {p.name.trim().charAt(0).toUpperCase() || "?"}
                  </div>
                )}
                <h3 className={l.h3}>{p.name}</h3>
                <p className={l.text}>{p.role}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  },
}, ["tone"]);

export type LogosProps = { title: string; tone: Tone; items: { src: string; name: string }[]; look?: Look };

export const Logos: ComponentConfig<LogosProps> = withLook({
  label: "Logos",
  fields: {
    title: { type: "text", label: "Title", contentEditable: true },
    tone: sectionFields.tone,
    items: {
      type: "array",
      label: "Logos",
      arrayFields: { src: imageField("Logo"), name: { type: "text", label: "Name" } },
      defaultItemProps: { src: "", name: "Client" },
      getItemSummary: (i) => i.name || "Logo",
    },
  },
  defaultProps: {
    title: "Trusted by",
    tone: "light",
    items: [{ src: "", name: "Northwind" }, { src: "", name: "Acme Co." }, { src: "", name: "Globex" }, { src: "", name: "Initech" }, { src: "", name: "Umbrella" }],
  },
  render: ({ title, tone, items, look, puck }) => {
    const l = looks(kitFor(puck, look), tone);
    return (
      <section className={l.section}>
        <div className={`flex flex-col items-center gap-8 ${l.container}`}>
          <p className={l.label}>{title}</p>
          <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
            {items.map((g, i) => (
              <li key={i}>
                {showable(g.src) ? <img src={g.src} alt={g.name} loading="lazy" className="h-8 w-auto object-contain opacity-80" /> : <span className={`${l.h3} opacity-70`}>{g.name}</span>}
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  },
}, ["tone"]);
