"use client";

import { useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import type { Field } from "@puckeditor/core";
import { deviceFor, PER_DEVICE, readStyle, scalesFromCss, showClasses, storeClasses, textClassesOf, writeStyle, type Device, type Scales, type StyleValues } from "@/lib/builder/class-groups";
import { normalizeTheme, type ThemeTokens } from "@/lib/builder/theme";
import { siteThemeCss } from "@/lib/builder/theme-vars";
import { usePuck } from "./editor-hooks";
import { EditHtmlButton } from "./html-editor-dialog";
import { useFreeMode } from "./free-canvas";
import { colorVar, styleId, textStyleClasses, type SiteStyles } from "@/lib/builder/site-styles";
import { TemplateContext } from "./template-registry";

/*
 * The Style panel of a design piece: plain controls (spacing, columns, colours…) over its class list, using the
 * design's own colours, type scale and corners. Each control changes only its own classes (class-groups.ts). The raw
 * class list is behind "Show class names", remembered per browser.
 *
 * Most controls edit the device shown on the canvas (phone, tablet or desktop; see class-groups.ts): a desktop change
 * reaches smaller devices unless they have their own value, which the control marks with a way back ("Reset").
 */

export type StyleControl = "layout" | "spacing" | "size" | "colours" | "text" | "look" | "position" | "visibility";

const SPACE = ["0", "1", "2", "3", "4", "5", "6", "8", "10", "12", "16", "20", "24", "32"];
const spaceLabel = (n: string) => (n === "0" ? "None" : `${Number(n) * 4}px`);
const MARGIN: [string, string][] = [...SPACE.map((n): [string, string] => [n, spaceLabel(n)]), ...["1", "2", "4", "8", "16"].map((n): [string, string] => [`-${n}`, `Pull in ${Number(n) * 4}px`])];
const OFFSET: [string, string][] = [["0", "0"], ...["1", "2", "4", "6", "8", "12", "16", "24"].map((n): [string, string] => [n, spaceLabel(n)]), ["1/2", "Half way"], ["full", "Full"], ...["2", "4", "8"].map((n): [string, string] => [`-${n}`, `Out ${Number(n) * 4}px`])];
const HEIGHTS: [string, string][] = [["full", "Fill the space"], ["screen", "Whole screen"], ...["16", "24", "32", "48", "64", "80", "96"].map((n): [string, string] => [n, `${Number(n) * 4}px`])];
const DEVICE_LABEL: Record<Device, string> = { desktop: "Desktop", tablet: "Tablet", phone: "Phone" };
/** Canvas widths for each device (the editor's viewports, set in builder-app.tsx). */
export const DEVICE_WIDTH: Record<Device, number> = { desktop: 1280, tablet: 768, phone: 375 };
const LARGER: Record<Device, Device | null> = { desktop: null, tablet: "desktop", phone: "tablet" };

/** Marks a control whose value is this device's own (not cascading from the larger device), with a way back. */
type Own = { device: Device; reset: () => void } | undefined;
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
export const useAdvanced = () =>
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
    render: ({ value, onChange, readOnly }) => <StyleField value={value ?? ""} onChange={onChange} readOnly={readOnly} controls={controls} piece />,
  } as Field<string>;
}

export function StyleField({ value, onChange, readOnly, controls, piece }: { value: string; onChange: (v: string) => void; readOnly?: boolean; controls: StyleControl[]; piece?: boolean }) {
  const template = useContext(TemplateContext);
  const siteTheme = usePuck((s) => s.appState.data.root.props?.theme as ThemeTokens | undefined);
  const siteStyles = usePuck((s) => s.appState.data.root.props?.styles as SiteStyles | undefined);
  const base = useMemo(() => (template ? scalesFromCss(template.css) : siteScales(siteTheme)), [template, siteTheme]);
  // The site's colour styles come first in every swatch row; they're used by variable, so changing one changes all.
  const scales = useMemo<Scales>(() => ({ ...base, colors: [...(siteStyles?.colors ?? []).map((c) => ({ name: colorVar(c.id), value: c.value, label: c.name })), ...base.colors] }), [base, siteStyles]);
  const width = usePuck((s) => s.appState.ui.viewports.current.width);
  const selected = usePuck((s) => s.selectedItem);
  const freeMode = useFreeMode();
  // Groups of design pieces can be a free layout (items placed by position; free-canvas.tsx).
  const canFree = selected?.type === "Box" && !(selected.props as { decor?: boolean }).decor;
  const isFree = canFree && !!(selected!.props as { free?: boolean }).free;
  const device = deviceFor(width);
  const larger = LARGER[device];
  const v = readStyle(value, scales, device);
  const up = larger ? readStyle(value, scales, larger) : undefined;
  const perDevice = (key: keyof StyleValues) => PER_DEVICE.includes(key);
  const set = <K extends keyof StyleValues>(key: K, next: StyleValues[K]) => onChange(writeStyle(value, scales, key, next, perDevice(key) ? device : "desktop"));
  // A smaller device with a value of its own gets a "Reset" back to what the larger device has.
  const own = (key: keyof StyleValues): Own => (up && perDevice(key) && v[key] !== up[key] ? { device, reset: () => set(key, up[key] as never) } : undefined);
  const advanced = useAdvanced();
  const has = (c: StyleControl) => controls.includes(c);
  // Groups appear in a fixed order; the piece's most relevant one (listed first) starts open.

  return (
    <div className="flex flex-col gap-1 text-sm">
      <DeviceBar device={device} />
      <fieldset disabled={readOnly} className="flex flex-col gap-1">
        <legend className="sr-only">Style</legend>
        {has("layout") ? (
          <Group title="Layout" open={controls[0] === "layout"}>
            <Segmented
              label="Arrange contents"
              value={isFree ? "free" : v.arrange}
              options={[["plain", "Plain"], ["stack", "Stack"], ["row", "Side by side"], ["grid", "Grid"], ...(canFree ? [["free", "Free"] as ["free", string]] : [])]}
              onChange={(a) => {
                if (a === "free") {
                  if (device !== "phone" && selected) freeMode(String(selected.props.id), true);
                } else if (isFree && selected) freeMode(String(selected.props.id), false, (c) => writeStyle(c, scales, "arrange", a, "desktop"));
                else set("arrange", a);
              }}
            />
            {isFree || (canFree && device === "phone") ? (
              <p className="rounded bg-blue-50 px-2 py-1.5 text-xs text-blue-900">
                {device === "phone"
                  ? "Free placement is for tablets and desktops; on phones the items stack. Switch to Tablet or Desktop to place them."
                  : "Drag the items on the canvas to place them, pull a handle to resize, Shift-click to select several. Arrow keys nudge. On phones they stack."}
              </p>
            ) : null}
            {!isFree && v.arrange === "grid" ? (
              <Select label="Columns" value={v.columns ? String(v.columns) : ""} options={["1", "2", "3", "4", "5", "6"].map((n) => [n, n])} onChange={(n) => set("columns", Number(n) || 2)} />
            ) : null}
            {!isFree && (v.arrange === "grid" || v.arrange === "row") ? (
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={v.stackOnPhones} onChange={(e) => set("stackOnPhones", e.target.checked)} />
                <span>One column on phones</span>
              </label>
            ) : null}
            {!isFree && v.arrange !== "plain" ? (
              <>
                <Select label="Space between items" value={v.gap} options={SPACE.map((n) => [n, spaceLabel(n)])} onChange={(g) => set("gap", g)} own={own("gap")} />
                <Select
                  label={v.arrange === "row" ? "Line up vertically" : "Line up horizontally"}
                  own={own("items")}
                  value={v.items}
                  options={[["start", "Start"], ["center", "Centre"], ["end", "End"], ["stretch", "Stretch"], ...(v.arrange === "row" ? [["baseline", "Text baseline"] as [string, string]] : [])]}
                  onChange={(i) => set("items", i)}
                />
                {v.arrange !== "grid" ? (
                  <Select
                    label="Spread"
                    own={own("justify")}
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
            <Select label="Inside, top and bottom" value={v.padY} options={SPACE.map((n) => [n, spaceLabel(n)])} onChange={(p) => set("padY", p)} own={own("padY")} />
            <Select label="Inside, left and right" value={v.padX} options={SPACE.map((n) => [n, spaceLabel(n)])} onChange={(p) => set("padX", p)} own={own("padX")} />
            <Select label="Outside, above" value={v.marginTop} options={MARGIN} onChange={(m) => set("marginTop", m)} own={own("marginTop")} />
            <Select label="Outside, below" value={v.marginBottom} options={MARGIN} onChange={(m) => set("marginBottom", m)} own={own("marginBottom")} />
            <Select label="Outside, left and right" value={v.marginX} options={[["auto", "Centre it"], ...MARGIN]} onChange={(m) => set("marginX", m)} own={own("marginX")} />
          </Group>
        ) : null}

        {has("size") ? (
          <Group title="Size" open={controls[0] === "size"}>
            <Select
              label="Width (all screens)"
              value={v.width}
              options={[["full", "Fill the space"], ["wide", "Wide (page width)"], ["medium", "Medium"], ["narrow", "Narrow (reading width)"]]}
              onChange={(w) => set("width", w as StyleValues["width"])}
              emptyLabel="Fit the contents"
            />
            <Select label="Height" value={v.height} options={HEIGHTS} onChange={(h) => set("height", h)} own={own("height")} emptyLabel="Fit the contents" />
            <Select label="At least this tall" value={v.minHeight} options={HEIGHTS} onChange={(h) => set("minHeight", h)} own={own("minHeight")} emptyLabel="No minimum" />
          </Group>
        ) : null}

        {has("colours") ? (
          <Group title="Colours" open={controls[0] === "colours"}>
            <Swatches label="Background" value={v.bg} scales={scales} onChange={(c) => set("bg", c)} own={own("bg")} />
            <Swatches label="Text colour" value={v.color} scales={scales} onChange={(c) => set("color", c)} own={own("color")} />
          </Group>
        ) : null}

        {has("text") ? (
          <Group title="Text" open={controls[0] === "text"}>
            {piece ? <TextStylePicker className={value} styles={siteStyles} /> : null}
            <Select label="Size" value={v.textSize} options={scales.textSizes.map((n) => [n, pretty(n)])} onChange={(t) => set("textSize", t)} own={own("textSize")} />
            <Select label="Weight" value={v.weight} options={WEIGHTS} onChange={(w) => set("weight", w)} own={own("weight")} />
            {scales.fonts.length ? <Select label="Font" value={v.font} options={scales.fonts.map((f) => [f, pretty(f)])} onChange={(f) => set("font", f)} own={own("font")} /> : null}
            <Segmented label="Align" value={v.textAlign ?? ""} options={[["", "Auto"], ["left", "Left"], ["center", "Centre"], ["right", "Right"]]} onChange={(a) => set("textAlign", a || undefined)} own={own("textAlign")} />
            <Select label="Line spacing" value={v.leading} options={[["none", "Tight as can be"], ["tight", "Tight"], ["snug", "Snug"], ["normal", "Normal"], ["relaxed", "Relaxed"], ["loose", "Loose"]]} onChange={(l) => set("leading", l)} own={own("leading")} />
            <Select label="Letter spacing" value={v.tracking} options={[["tighter", "Tighter"], ["tight", "Tight"], ["normal", "Normal"], ["wide", "Wide"], ["wider", "Wider"], ["widest", "Widest"]]} onChange={(t) => set("tracking", t)} own={own("tracking")} />
            <Segmented label="Letters" value={v.textCase ?? ""} options={[["", "As typed"], ["uppercase", "CAPITALS"], ["capitalize", "Title Case"], ["lowercase", "lowercase"]]} onChange={(c) => set("textCase", (c || undefined) as StyleValues["textCase"])} own={own("textCase")} />
          </Group>
        ) : null}

        {has("look") ? (
          <Group title="Corners, border and effects" open={controls[0] === "look"}>
            <Select label="Corners" value={v.rounded} options={scales.radii.map((r) => [r, RADIUS_LABEL[r] ?? pretty(r)])} onChange={(r) => set("rounded", r)} own={own("rounded")} />
            <Select label="Shadow" value={v.shadow} options={SHADOWS} onChange={(s) => set("shadow", s)} own={own("shadow")} />
            <Select label="Border" value={v.borderWidth} options={[["0", "None"], ["1", "Thin"], ["2", "Medium"], ["4", "Thick"], ["8", "Heavy"]]} onChange={(b) => set("borderWidth", b)} own={own("borderWidth")} />
            {v.borderWidth && v.borderWidth !== "0" ? (
              <>
                <Segmented label="Border line" value={v.borderStyle ?? ""} options={[["", "Solid"], ["dashed", "Dashed"], ["dotted", "Dotted"], ["double", "Double"]]} onChange={(b) => set("borderStyle", b || undefined)} own={own("borderStyle")} />
                <Swatches label="Border colour" value={v.borderColor} scales={scales} onChange={(c) => set("borderColor", c)} own={own("borderColor")} />
              </>
            ) : null}
            <Select label="See-through" value={v.opacity} options={[["100", "Solid"], ["90", "90%"], ["75", "75%"], ["50", "Half"], ["25", "25%"], ["10", "Faint"], ["0", "Invisible"]]} onChange={(o) => set("opacity", o)} own={own("opacity")} />
            <Select label="Blur" value={v.blur} options={[["none", "None"], ["sm", "Slight"], ["DEFAULT", "Soft"], ["md", "Medium"], ["lg", "Strong"], ["xl", "Heavy"]]} onChange={(b) => set("blur", b)} own={own("blur")} />
          </Group>
        ) : null}

        {has("position") ? (
          <Group title="Position and stacking" open={controls[0] === "position"}>
            <Select
              label="Position"
              value={v.position}
              options={[["relative", "In the flow (anchor for pinned items)"], ["absolute", "Pinned inside its group"], ["sticky", "Stays on screen when scrolling"], ["fixed", "Fixed to the window"], ["static", "In the flow"]]}
              onChange={(p) => set("position", p as StyleValues["position"])}
              own={own("position")}
              emptyLabel="In the flow (design default)"
            />
            {v.position && v.position !== "static" && v.position !== "relative" ? (
              <div className="grid grid-cols-2 gap-2">
                <Select label="From top" value={v.top} options={OFFSET} onChange={(o) => set("top", o)} own={own("top")} emptyLabel="Auto" />
                <Select label="From bottom" value={v.bottom} options={OFFSET} onChange={(o) => set("bottom", o)} own={own("bottom")} emptyLabel="Auto" />
                <Select label="From left" value={v.left} options={OFFSET} onChange={(o) => set("left", o)} own={own("left")} emptyLabel="Auto" />
                <Select label="From right" value={v.right} options={OFFSET} onChange={(o) => set("right", o)} own={own("right")} emptyLabel="Auto" />
              </div>
            ) : null}
            <div className="flex flex-col gap-1">
              <span>Stacking</span>
              <div className="flex gap-1">
                <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => set("z", stack(v.z, -10))}>Send back</button>
                <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => set("z", stack(v.z, 10))}>Bring forward</button>
                {v.z ? <span className="self-center text-xs opacity-70">Layer {v.z}</span> : null}
              </div>
              <OwnNote own={own("z")} />
            </div>
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

      <AdvancedToggle />
      {advanced ? (
        <>
          <RawClasses key={value} value={value} onChange={onChange} readOnly={readOnly} />
          {readOnly ? null : <EditHtmlButton />}
        </>
      ) : null}
    </div>
  );
}

/** Layers step by 10 (z-0 … z-50, the Tailwind scale); below 0 sends behind the group's background. */
function stack(z: string | undefined, by: number): string | undefined {
  const next = Math.max(-10, Math.min(50, (Number(z) || 0) + by));
  return next === 0 ? undefined : String(next);
}

/** Which device the panel edits; switching also switches the canvas. */
function DeviceBar({ device }: { device: Device }) {
  const dispatch = usePuck((s) => s.dispatch);
  const viewports = usePuck((s) => s.appState.ui.viewports);
  return (
    <div className="mb-1 flex flex-col gap-1 rounded border px-2 py-1.5">
      <div role="radiogroup" aria-label="Editing for" className="flex items-center gap-1">
        <span className="mr-1 text-xs font-semibold">Editing for</span>
        {(["desktop", "tablet", "phone"] as Device[]).map((d) => (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={device === d}
            onClick={() => dispatch({ type: "setUi", ui: { viewports: { ...viewports, current: { width: DEVICE_WIDTH[d], height: "auto" } } } })}
            className="rounded border px-2 py-0.5 text-xs aria-checked:border-current aria-checked:bg-black aria-checked:text-white"
          >
            {DEVICE_LABEL[d]}
          </button>
        ))}
      </div>
      <span className="text-xs opacity-70">
        {device === "desktop" ? "Changes here also apply to tablets and phones, unless they have their own." : `Changes here are for ${device === "tablet" ? "tablets (and phones that match)" : "phones"} only.`}
      </span>
    </div>
  );
}

/** "Phone only · Reset" under a control whose value belongs to this device. */
function OwnNote({ own }: { own: Own }) {
  if (!own) return null;
  return (
    <span className="flex items-center gap-1 text-xs text-blue-800">
      <span aria-hidden>●</span> {DEVICE_LABEL[own.device]} only
      <button type="button" onClick={own.reset} className="underline">Reset</button>
    </span>
  );
}

/** The per-browser "advanced" switch: class names and Edit HTML. */
export function AdvancedToggle() {
  const advanced = useAdvanced();
  return (
    <label className="mt-2 flex items-center gap-2 text-xs opacity-80">
      <input type="checkbox" checked={advanced} onChange={(e) => setAdvanced(e.target.checked)} />
      <span>Show class names (advanced)</span>
    </label>
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

function Select({ label, value, options, onChange, emptyLabel = "Design default", own }: { label: string; value: string | undefined; options: [string, string][]; onChange: (v: string | undefined) => void; emptyLabel?: string; own?: Own }) {
  const known = value === undefined || options.some(([o]) => o === value);
  return (
    <div className="flex flex-col gap-1">
      <label className="flex flex-col gap-1">
        <span>{label}</span>
        <select value={known ? (value ?? "") : "__custom"} onChange={(e) => e.target.value !== "__custom" && onChange(e.target.value || undefined)} className="min-h-9 rounded border px-2">
          <option value="">{emptyLabel}</option>
          {!known ? <option value="__custom">From the design ({value})</option> : null}
          {options.map(([o, l]) => <option key={o} value={o}>{l}</option>)}
        </select>
      </label>
      <OwnNote own={own} />
    </div>
  );
}

function Segmented<T extends string>({ label, value, options, onChange, own }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void; own?: Own }) {
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
      <OwnNote own={own} />
    </div>
  );
}

function Swatches({ label, value, scales, onChange, own }: { label: string; value: string | undefined; scales: Scales; onChange: (v: string | undefined) => void; own?: Own }) {
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
            title={c.label ?? pretty(c.name)}
            className="size-7 rounded-full border aria-checked:ring-2 aria-checked:ring-current aria-checked:ring-offset-1"
            style={{ background: swatch(scales, c.value) }}
          >
            <span className="sr-only">{c.label ?? pretty(c.name)}</span>
          </button>
        ))}
      </div>
      {value && !colors.some((c) => c.name === base) ? <span className="text-xs opacity-70">From the design ({value})</span> : null}
      <OwnNote own={own} />
    </div>
  );
}

/**
 * A text piece's style: follow a named text style (the piece's own text classes give way to it), detach from it
 * (its look is copied onto the piece), or save the piece's look as a new style.
 */
function TextStylePicker({ className, styles }: { className: string; styles: SiteStyles | undefined }) {
  const selected = usePuck((s) => s.selectedItem);
  const getSelectorForId = usePuck((s) => s.getSelectorForId);
  const dispatch = usePuck((s) => s.dispatch);
  const root = usePuck((s) => s.appState.data.root);
  if (!selected) return null;
  const current = (selected.props as { textStyle?: string }).textStyle;
  const list = styles?.text ?? [];
  const update = (props: Record<string, unknown>) => {
    const where = getSelectorForId(String(selected.props.id));
    if (where) dispatch({ type: "replace", destinationIndex: where.index, destinationZone: where.zone, data: { ...selected, props: { ...selected.props, ...props } } as never });
  };
  const own = textClassesOf(className);
  return (
    <div className="flex flex-col gap-1 rounded bg-black/[0.03] p-2">
      <label className="flex flex-col gap-1">
        <span className="font-semibold">Text style</span>
        <select
          value={current ?? ""}
          onChange={(e) => {
            const id = e.target.value || undefined;
            // Following a style: the piece's own text classes would fight it, so they go.
            update(id ? { textStyle: id, className: stripTextClasses(className) } : { textStyle: undefined });
          }}
          className="min-h-9 rounded border px-2"
        >
          <option value="">None (its own look)</option>
          {list.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
      <div className="flex flex-wrap gap-1">
        {current ? (
          <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => update({ textStyle: undefined, className: `${textStyleClasses(styles, current)} ${className}`.trim() })}>
            Detach (keep the look)
          </button>
        ) : own ? (
          <button
            type="button"
            className="rounded border px-2 py-1 text-xs"
            onClick={() => {
              const name = `Text style ${list.length + 1}`;
              const id = styleId(name, list.map((t) => t.id));
              const next: SiteStyles = { ...styles, text: [...list, { id, name, className: own }] };
              dispatch({ type: "replaceRoot", root: { ...root, props: { ...root.props, styles: next } } as never });
              update({ textStyle: id, className: stripTextClasses(className) });
            }}
          >
            Save this look as a text style
          </button>
        ) : null}
      </div>
      {current ? <span className="text-xs opacity-70">Changes in the Styles panel apply to every text using “{list.find((t) => t.id === current)?.name ?? current}”. Settings below add to it.</span> : null}
    </div>
  );
}

const stripTextClasses = (className: string) => {
  const drop = new Set(textClassesOf(className).split(" "));
  return className.split(/\s+/).filter((t) => t && !drop.has(t)).join(" ");
};
