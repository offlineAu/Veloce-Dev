import type { ComponentConfig, Slot } from "@puckeditor/core";
import { toneClass, toneOptions, type Tone } from "./shared";

const padClass = { sm: "py-8", md: "py-14", lg: "py-24" } as const;
const widthClass = { narrow: "max-w-3xl", wide: "max-w-6xl", full: "max-w-none" } as const;

export type SectionProps = {
  tone: Tone;
  padding: keyof typeof padClass;
  width: keyof typeof widthClass;
  content: Slot;
};

export const Section: ComponentConfig<SectionProps> = {
  label: "Section",
  fields: {
    tone: { type: "select", label: "Background", options: [...toneOptions] },
    padding: { type: "radio", label: "Spacing", options: [{ label: "S", value: "sm" }, { label: "M", value: "md" }, { label: "L", value: "lg" }] },
    width: { type: "radio", label: "Width", options: [{ label: "Narrow", value: "narrow" }, { label: "Wide", value: "wide" }, { label: "Full", value: "full" }] },
    content: { type: "slot" },
  },
  defaultProps: { tone: "light", padding: "md", width: "wide", content: [] },
  render: ({ tone, padding, width, content: Content }) => (
    <section className={`${toneClass[tone]} ${padClass[padding]} px-6`}>
      <Content className={`mx-auto flex min-h-16 flex-col gap-6 ${widthClass[width]}`} />
    </section>
  ),
};

export type ColumnsProps = {
  count: "2" | "3";
  gap: "sm" | "lg";
  col1: Slot;
  col2: Slot;
  col3: Slot;
};

export const Columns: ComponentConfig<ColumnsProps> = {
  label: "Columns",
  fields: {
    count: { type: "radio", label: "Columns", options: [{ label: "2", value: "2" }, { label: "3", value: "3" }] },
    gap: { type: "radio", label: "Gap", options: [{ label: "Tight", value: "sm" }, { label: "Roomy", value: "lg" }] },
    col1: { type: "slot" },
    col2: { type: "slot" },
    col3: { type: "slot" },
  },
  defaultProps: { count: "2", gap: "lg", col1: [], col2: [], col3: [] },
  render: ({ count, gap, col1: A, col2: B, col3: C }) => (
    <div className={`grid grid-cols-1 ${count === "3" ? "md:grid-cols-3" : "md:grid-cols-2"} ${gap === "sm" ? "gap-4" : "gap-10"}`}>
      <A className="flex min-h-16 flex-col gap-4" />
      <B className="flex min-h-16 flex-col gap-4" />
      {count === "3" ? <C className="flex min-h-16 flex-col gap-4" /> : null}
    </div>
  ),
};

export const Spacer: ComponentConfig<{ size: "sm" | "md" | "lg" }> = {
  label: "Spacer",
  fields: { size: { type: "radio", label: "Height", options: [{ label: "S", value: "sm" }, { label: "M", value: "md" }, { label: "L", value: "lg" }] } },
  defaultProps: { size: "md" },
  render: ({ size }) => <div aria-hidden className={size === "sm" ? "h-6" : size === "md" ? "h-12" : "h-24"} />,
};

export const Divider: ComponentConfig<{ inset: boolean }> = {
  label: "Divider",
  fields: { inset: { type: "radio", label: "Inset", options: [{ label: "Yes", value: true }, { label: "No", value: false }] } },
  defaultProps: { inset: true },
  render: ({ inset }) => <hr className={`border-current opacity-15 ${inset ? "mx-6" : ""}`} />,
};
