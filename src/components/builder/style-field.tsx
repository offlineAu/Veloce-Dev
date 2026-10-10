"use client";

import { useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import type { Field } from "@puckeditor/core";
import { readStyle, scalesFromCss, showClasses, storeClasses, writeStyle, type Scales, type StyleValues } from "@/lib/builder/class-groups";
import { normalizeTheme, type ThemeTokens } from "@/lib/builder/theme";
import { siteThemeCss } from "@/lib/builder/theme-vars";
import { usePuck } from "./editor-hooks";
import { TemplateContext } from "./template-registry";

/*
 * The Style panel of a design piece: plain controls (spacing, columns, colours…) over its class list, using the
 * design's own colours, type scale and corners. Each control changes only its own classes (class-groups.ts). The raw
 * class list is behind "Show class names", remembered per browser.
 */

export type StyleControl = "layout" | "spacing" | "size" | "colours" | "text" | "look" | "visibility";

const SPACE = ["0", "1", "2", "3", "4", "5", "6", "8", "10", "12", "16", "20", "24", "32"];
const spaceLabel = (n: string) => (n === "0" ? "None" : `${Number(n) * 4}px`);
const WEIGHTS: [string, string][] = [["light", "Light"], ["normal", "Regular"], ["medium", "Medium"], ["semibold", "Semibold"], ["bold", "Bold"], ["black", "Heavy"]];
const SHADOWS: [string, string][] = [["none", "None"], ["sm", "Soft"], ["DEFAULT", "Light"], ["md", "Medium"], ["lg", "Strong"], ["2xl", "Dramatic"]];
const RADIUS_LABEL: Record<string, string> = { none: "Square", sm: "Slight", DEFAULT: "Small", md: "Small+", lg: "Medium", xl: "Large", "2xl": "Larger", "3xl": "Very round", full: "Pill" };
const pretty = (name: string) => name.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/** Site themes without a template: the builder's tokens, under the same names the "site" stylesheet compiles. */
function siteScales(theme: ThemeTokens | undefined): Scales {
  return scalesFromCss(siteThemeCss(normalizeTheme(theme)).replace(/\s--/g, " --vt-"));
}

function swatch(scales: Scales, value: string, depth = 0): string {
  const ref = value.match(/^var\(--vt-color-([\w-]+)\)$/);
  if (!ref || depth > 4) return value;
  const next = scales.colors.find((c) => c.name === ref[1]);
  return next ? swatch(scales, next.value, depth + 1) : "transparent";
}

// "Show class names" is a per-browser preference.
const ADVANCED_KEY = "veloce:builder-advanced";
const listeners = new Set<() => void>();
const readAdvanced = () => {
  try {
    return localStorage.getItem(ADVANCED_KEY) === "1";
  } catch {
    return false;
  }
};
function setAdvanced(on: boolean) {
  try {
    localStorage.setItem(ADVANCED_KEY, on ? "1" : "0");
  } catch {
    // Private windows: the switch still works until reload.
  }
  listeners.forEach((l) => l());
}
const useAdvanced = () =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    readAdvanced,
    () => false,
  );

/** A Puck field for a piece's `className`, offering the given groups of controls. */
export function styleField(controls: StyleControl[]): Field<string> {
  return {
    type: "custom",
    label: "Style",
    render: ({ value, onChange, readOnly }) => <StyleField value={value ?? ""} onChange={onChange} readOnly={readOnly} controls={controls} />,
  } as Field<string>;
}

export function StyleField({ value, onChange, readOnly, controls }: { value: string; onChange: (v: string) => void; readOnly?: boolean; controls: StyleControl[] }) {
  const template = useContext(TemplateContext);
  const siteTheme = usePuck((s) => s.appState.data.root.props?.theme as ThemeTokens | undefined);
  const scales = useMemo(() => (template ? scalesFromCss(template.css) : siteScales(siteTheme)), [template, siteTheme]);
  const v = readStyle(value, scales);
  const set = <K extends keyof StyleValues>(key: K, next: StyleValues[K]) => onChange(writeStyle(value, scales, key, next));
  const advanced = useAdvanced();
  const has = (c: StyleControl) => controls.includes(c);
  // Groups appear in a fixed order; the piece's most relevant one (listed first) starts open.

  return (
    <div className="flex flex-col gap-1 text-sm">
      <fieldset disabled={readOnly} className="flex flex-col gap-1">
        <legend className="sr-only">Style</legend>
        {has("layout") ? (
          <Group title="Layout" open={controls[0] === "layout"}>
            <Segmented
              label="Arrange contents"
              value={v.arrange}
              options={[["plain", "Plain"], ["stack", "Stack"], ["row", "Side by side"], ["grid", "Grid"]]}
              onChange={(a) => set("arrange", a)}
            />
            {v.arrange === "grid" ? (
              <Select label="Columns" value={v.columns ? String(v.columns) : ""} options={["1", "2", "3", "4", "5", "6"].map((n) => [n, n])} onChange={(n) => set("columns", Number(n) || 2)} />
            ) : null}
            {v.arrange === "grid" || v.arrange === "row" ? (
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={v.stackOnPhones} onChange={(e) => set("stackOnPhones", e.target.checked)} />
                <span>One column on phones</span>
              </label>
            ) : null}
            {v.arrange !== "plain" ? (
              <>
                <Select label="Space between items" value={v.gap} options={SPACE.map((n) => [n, spaceLabel(n)])} onChange={(g) => set("gap", g)} />
                <Select
                  label={v.arrange === "row" ? "Line up vertically" : "Line up horizontally"}
                  value={v.items}
                  options={[["start", "Start"], ["center", "Centre"], ["end", "End"], ["stretch", "Stretch"], ...(v.arrange === "row" ? [["baseline", "Text baseline"] as [string, string]] : [])]}
                  onChange={(i) => set("items", i)}
                />
                {v.arrange !== "grid" ? (
                  <Select
                    label="Spread"
                    value={v.justify}
                    options={[["start", "Start"], ["center", "Centre"], ["end", "End"], ["between", "Spread out"]]}
                    onChange={(j) => set("justify", j)}
                  />
                ) : null}
              </>
            ) : null}
          </Group>
        ) : null}

        {has("spacing") ? (
          <Group title="Spacing" open={controls[0] === "spacing"}>
            <Select label="Inside, top and bottom" value={v.padY} options={SPACE.map((n) => [n, spaceLabel(n)])} onChange={(p) => set("padY", p)} />
            <Select label="Inside, left and right" value={v.padX} options={SPACE.map((n) => [n, spaceLabel(n)])} onChange={(p) => set("padX", p)} />
          </Group>
        ) : null}

        {has("size") ? (
          <Group title="Width" open={controls[0] === "size"}>
            <Select
              label="Width"
              value={v.width}
              options={[["full", "Fill the space"], ["wide", "Wide (page width)"], ["medium", "Medium"], ["narrow", "Narrow (reading width)"]]}
              onChange={(w) => set("width", w as StyleValues["width"])}
              emptyLabel="Fit the contents"
            />
          </Group>
        ) : null}

        {has("colours") ? (
          <Group title="Colours" open={controls[0] === "colours"}>
            <Swatches label="Background" value={v.bg} scales={scales} onChange={(c) => set("bg", c)} />
            <Swatches label="Text colour" value={v.color} scales={scales} onChange={(c) => set("color", c)} />
          </Group>
        ) : null}

        {has("text") ? (
          <Group title="Text" open={controls[0] === "text"}>
            <Select label="Size" value={v.textSize} options={scales.textSizes.map((n) => [n, pretty(n)])} onChange={(t) => set("textSize", t)} />
            <Select label="Weight" value={v.weight} options={WEIGHTS} onChange={(w) => set("weight", w)} />
            {scales.fonts.length ? <Select label="Font" value={v.font} options={scales.fonts.map((f) => [f, pretty(f)])} onChange={(f) => set("font", f)} /> : null}
            <Segmented label="Align" value={v.textAlign ?? ""} options={[["", "Auto"], ["left", "Left"], ["center", "Centre"], ["right", "Right"]]} onChange={(a) => set("textAlign", a || undefined)} />
          </Group>
        ) : null}

        {has("look") ? (
          <Group title="Corners and shadow" open={controls[0] === "look"}>
            <Select label="Corners" value={v.rounded} options={scales.radii.map((r) => [r, RADIUS_LABEL[r] ?? pretty(r)])} onChange={(r) => set("rounded", r)} />
            <Select label="Shadow" value={v.shadow} options={SHADOWS} onChange={(s) => set("shadow", s)} />
          </Group>
        ) : null}

        {has("visibility") ? (
          <Group title="Show on" open={controls[0] === "visibility"}>
            <Segmented
              label="Show on"
              value={v.visibility}
              options={[["all", "All screens"], ["hide-phones", "Not on phones"], ["phones-only", "Phones only"]]}
              onChange={(s) => set("visibility", s)}
            />
          </Group>
        ) : null}
      </fieldset>

      <label className="mt-2 flex items-center gap-2 text-xs opacity-80">
        <input type="checkbox" checked={advanced} onChange={(e) => setAdvanced(e.target.checked)} />
        <span>Show class names (advanced)</span>
      </label>
      {advanced ? <RawClasses key={value} value={value} onChange={onChange} readOnly={readOnly} /> : null}
    </div>
  );
}

function RawClasses({ value, onChange, readOnly }: { value: string; onChange: (v: string) => void; readOnly?: boolean }) {
  const [draft, setDraft] = useState(() => showClasses(value));
  const [refused, setRefused] = useState<string[]>([]);
  const apply = () => {
    const r = storeClasses(draft);
    setRefused(r.refused);
    if (r.className !== value) onChange(r.className);
  };
  return (
    <label className="flex flex-col gap-1">
      <span className="font-semibold">Classes (Tailwind)</span>
      <textarea
        value={draft}
        readOnly={readOnly}
        spellCheck={false}
        rows={4}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={apply}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            apply();
          }
        }}
        className="rounded border px-2 py-1 font-mono text-xs"
      />
      <span className="text-xs opacity-70">Press Enter to apply. New classes use this design&apos;s colours and sizes.</span>
      {refused.length ? <span role="alert" className="text-xs text-red-700">Not allowed: {refused.join(" ")}</span> : null}
    </label>
  );
}

function Group({ title, open, children }: { title: string; open?: boolean; children: ReactNode }) {
  return (
    <details open={open} className="group rounded border px-2 py-1.5">
      <summary className="cursor-pointer font-semibold">{title}</summary>
      <div className="mt-2 flex flex-col gap-3 pb-1">{children}</div>
    </details>
  );
}

function Select({ label, value, options, onChange, emptyLabel = "Design default" }: { label: string; value: string | undefined; options: [string, string][]; onChange: (v: string | undefined) => void; emptyLabel?: string }) {
  const known = value === undefined || options.some(([o]) => o === value);
  return (
    <label className="flex flex-col gap-1">
      <span>{label}</span>
      <select value={known ? (value ?? "") : "__custom"} onChange={(e) => e.target.value !== "__custom" && onChange(e.target.value || undefined)} className="min-h-9 rounded border px-2">
        <option value="">{emptyLabel}</option>
        {!known ? <option value="__custom">From the design ({value})</option> : null}
        {options.map(([o, l]) => <option key={o} value={o}>{l}</option>)}
      </select>
    </label>
  );
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-1">
      <span aria-hidden>{label}</span>
      <div className="flex flex-wrap gap-1">
        {options.map(([o, l]) => (
          <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onChange(o)} className="rounded border px-2 py-1 text-xs aria-checked:border-current aria-checked:bg-black aria-checked:text-white">
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

function Swatches({ label, value, scales, onChange }: { label: string; value: string | undefined; scales: Scales; onChange: (v: string | undefined) => void }) {
  const colors = [...scales.colors, { name: "white", value: "#fff" }, { name: "black", value: "#000" }];
  const base = value?.replace(/\/.*$/, "");
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-1">
      <span aria-hidden>{label}</span>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" role="radio" aria-checked={!value} onClick={() => onChange(undefined)} title="Design default" className="grid size-7 place-items-center rounded-full border text-[10px] aria-checked:ring-2 aria-checked:ring-current">
          <span aria-hidden>—</span>
          <span className="sr-only">Design default</span>
        </button>
        {colors.map((c) => (
          <button
            key={c.name}
            type="button"
            role="radio"
            aria-checked={base === c.name}
            onClick={() => onChange(c.name)}
            title={pretty(c.name)}
            className="size-7 rounded-full border aria-checked:ring-2 aria-checked:ring-current aria-checked:ring-offset-1"
            style={{ background: swatch(scales, c.value) }}
          >
            <span className="sr-only">{pretty(c.name)}</span>
          </button>
        ))}
      </div>
      {value && !colors.some((c) => c.name === base) ? <span className="text-xs opacity-70">From the design ({value})</span> : null}
    </div>
  );
}
