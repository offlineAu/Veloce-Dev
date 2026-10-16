"use client";

import { useContext, useMemo, useState, type ReactNode } from "react";
import { Palette, Plus, RotateCcw, Trash2, Type } from "lucide-react";
import { DEFAULT_TEXT_SIZES, scalesFromCss, textClassesOf, type Scales } from "@/lib/builder/class-groups";
import { fontStack, styleId, webFontOf, WEB_FONTS, type ColorStyle, type SiteStyles, type TextStyle } from "@/lib/builder/site-styles";
import { normalizeTheme, type ThemeTokens } from "@/lib/builder/theme";
import { siteThemeCss } from "@/lib/builder/theme-vars";
import { usePuck } from "./editor-hooks";
import { StyleField } from "./style-field";
import { TemplateContext } from "./template-registry";

/*
 * The Styles panel (left sidebar): the site's design system in one place.
 *   Colours and fonts  every colour and font of the design (the template's, or the site theme's), changeable
 *   Text sizes         the template's own named sizes
 *   Colour styles      named colours to use anywhere; changing one changes it everywhere
 *   Text styles        named text looks ("Heading 1"); pieces that use one follow its changes
 * Styles are site-wide (every page's root carries them; builder-app keeps them in step).
 */

const SITE_COLOURS: [keyof ThemeTokens, string][] = [["accent", "Brand"], ["bg", "Page background"], ["surface", "Surfaces"], ["fg", "Text"], ["muted", "Quiet text"], ["line", "Lines"]];
const pretty = (n: string) => n.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/** Any CSS colour as #rrggbb (for the colour input), resolving the design's own variables first. */
function toHex(value: string, scales?: Scales, depth = 0): string {
  const ref = value.match(/^var\(--vt-color-([\w-]+)\)$/);
  if (ref && scales && depth < 5) {
    const next = scales.colors.find((c) => c.name === ref[1]);
    return next ? toHex(next.value, scales, depth + 1) : "#000000";
  }
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();
  if (typeof document === "undefined") return "#000000";
  // Any CSS colour (oklch, rgb, named…): paint one pixel with it and read the pixel back.
  const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (!ctx) return "#000000";
  ctx.fillStyle = "#000";
  ctx.fillStyle = value;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `#${[r, g, b].map((n) => n!.toString(16).padStart(2, "0")).join("")}`;
}

/** Tailwind's stock palette and font names (amber-400, sans…): listed after the design's own, folded away. */
const stock = (name: string) => /-(50|[1-9]00|950)$/.test(name) || /^(sans|serif|mono)$/.test(name);

export function StylesPanel() {
  const template = useContext(TemplateContext);
  const root = usePuck((s) => s.appState.data.root);
  const dispatch = usePuck((s) => s.dispatch);
  const props = (root.props ?? {}) as { styles?: SiteStyles; theme?: ThemeTokens };
  const styles = props.styles ?? {};
  const theme = normalizeTheme(props.theme);
  const scales = useMemo(() => (template ? scalesFromCss(template.css) : scalesFromCss(siteThemeCss(theme).replace(/\s--/g, " --vt-"))), [template, theme]);
  // The design's own named text sizes (not Tailwind's defaults).
  const sizes = useMemo(() => (template ? [...template.css.matchAll(/--vt-text-([a-z][\w-]*?):([^;}]+)/g)].filter(([, n]) => !/--|line-height|letter-spacing|font-weight/.test(n!) && !DEFAULT_TEXT_SIZES.includes(n!)).map(([, n, v]) => ({ name: n!, value: v!.trim() })) : []), [template]);

  const setRoot = (next: { styles?: SiteStyles; theme?: ThemeTokens }) => dispatch({ type: "replaceRoot", root: { ...root, props: { ...root.props, ...next } } as never });
  const setStyles = (next: SiteStyles) => setRoot({ styles: next });
  const setToken = (key: string, value: string | undefined) => {
    const tokens = { ...styles.tokens };
    if (value === undefined) delete tokens[key];
    else tokens[key] = value;
    setStyles({ ...styles, tokens });
  };

  return (
    <div className="flex flex-col gap-5 p-4 text-sm">
      <Section title="Colours" icon={<Palette size={16} aria-hidden />}>
        {template
          ? (() => {
              const row = (c: Scales["colors"][number]) => {
                const key = `--vt-color-${c.name}`;
                const own = styles.tokens?.[key];
                return <ColourRow key={c.name} label={pretty(c.name)} value={own ?? toHex(c.value, scales)} changed={!!own} onChange={(v) => setToken(key, v)} onReset={() => setToken(key, undefined)} />;
              };
              const all = scales.colors.filter((c) => !/^(white|black|transparent|current)$/.test(c.name));
              const more = all.filter((c) => stock(c.name));
              return (
                <>
                  {all.filter((c) => !stock(c.name)).map(row)}
                  {more.length ? (
                    <details>
                      <summary className="cursor-pointer text-xs opacity-70">More colours ({more.length})</summary>
                      <div className="mt-2 flex flex-col gap-2">{more.map(row)}</div>
                    </details>
                  ) : null}
                </>
              );
            })()
          : SITE_COLOURS.map(([k, label]) => (
              <ColourRow key={k} label={label} value={String(theme[k])} changed={false} onChange={(v) => setRoot({ theme: { ...theme, preset: undefined, [k]: v } })} />
            ))}
      </Section>

      <Section title="Fonts" icon={<Type size={16} aria-hidden />}>
        {template
          ? [...scales.fonts.filter((f) => !stock(f)), ...scales.fonts.filter(stock)].map((f) => {
              const key = `--vt-font-${f}`;
              return <FontRow key={f} label={pretty(f)} value={styles.tokens?.[key]} designLabel="Design's own" onChange={(v) => setToken(key, v)} />;
            })
          : (
              <>
                <FontRow label="Headings" value={webFontOf(theme.fontHeading)} designLabel="Theme font" onChange={(v) => setRoot({ theme: { ...theme, fontHeading: v ? fontStack(v)! : normalizeTheme(undefined).fontHeading } })} />
                <FontRow label="Body text" value={webFontOf(theme.fontBody)} designLabel="Theme font" onChange={(v) => setRoot({ theme: { ...theme, fontBody: v ? fontStack(v)! : normalizeTheme(undefined).fontBody } })} />
              </>
            )}
        <p className="text-xs opacity-70">Web fonts load from this site, so visitors&apos; browsers never contact another.</p>
      </Section>

      {sizes.length ? (
        <Section title="Text sizes">
          {sizes.map((t) => {
            const key = `--vt-text-${t.name}`;
            const own = styles.tokens?.[key];
            return <SizeRow key={t.name} label={pretty(t.name)} value={own ?? t.value} changed={!!own} onChange={(v) => setToken(key, v)} onReset={() => setToken(key, undefined)} />;
          })}
        </Section>
      ) : null}

      <ColourStyles styles={styles} onChange={setStyles} />
      <TextStyles styles={styles} onChange={setStyles} />
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em] opacity-70">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

function ColourRow({ label, value, changed, onChange, onReset }: { label: string; value: string; changed: boolean; onChange: (v: string) => void; onReset?: () => void }) {
  const hex = toHex(value);
  return (
    <div className="flex items-center gap-2">
      <input type="color" aria-label={label} value={hex} onChange={(e) => onChange(e.target.value)} className="size-7 shrink-0 cursor-pointer rounded border p-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <code className="text-xs opacity-60">{hex}</code>
      {changed && onReset ? (
        <button type="button" title={`Back to the design's ${label.toLowerCase()}`} aria-label={`Reset ${label}`} onClick={onReset} className="rounded p-1 hover:bg-black/5">
          <RotateCcw size={14} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

function FontRow({ label, value, designLabel, onChange }: { label: string; value: string | undefined; designLabel: string; onChange: (v: string | undefined) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span>{label}</span>
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)} className="min-h-9 rounded border px-2" style={{ fontFamily: value ? fontStack(value) : undefined }}>
        <option value="">{designLabel}</option>
        {(["sans", "serif", "display", "mono"] as const).map((kind) => (
          <optgroup key={kind} label={{ sans: "Sans serif", serif: "Serif", display: "Display", mono: "Monospace" }[kind]}>
            {WEB_FONTS.filter((f) => f.kind === kind).map((f) => <option key={f.family} value={f.family}>{f.family}</option>)}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

function SizeRow({ label, value, changed, onChange, onReset }: { label: string; value: string; changed: boolean; onChange: (v: string) => void; onReset: () => void }) {
  const [draft, setDraft] = useState(value);
  const apply = () => /^\d{1,3}(\.\d{1,3})?(px|rem)$/.test(draft.trim()) ? onChange(draft.trim()) : setDraft(value);
  return (
    <div className="flex items-center gap-2">
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <input aria-label={`${label} size`} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={apply} onKeyDown={(e) => e.key === "Enter" && apply()} className="w-20 rounded border px-2 py-1 font-mono text-xs" />
      {changed ? (
        <button type="button" aria-label={`Reset ${label}`} onClick={() => { setDraft(value); onReset(); }} className="rounded p-1 hover:bg-black/5">
          <RotateCcw size={14} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

function ColourStyles({ styles, onChange }: { styles: SiteStyles; onChange: (s: SiteStyles) => void }) {
  const colors = styles.colors ?? [];
  const put = (next: ColorStyle[]) => onChange({ ...styles, colors: next });
  return (
    <Section title="Colour styles">
      {colors.length ? null : <p className="text-xs opacity-70">Name a colour once and use it anywhere (backgrounds, text, borders). Change it here and it changes everywhere.</p>}
      {colors.map((c) => (
        <div key={c.id} className="flex items-center gap-2">
          <input type="color" aria-label={`${c.name} colour`} value={toHex(c.value)} onChange={(e) => put(colors.map((x) => (x.id === c.id ? { ...x, value: e.target.value } : x)))} className="size-7 shrink-0 cursor-pointer rounded border p-0" />
          <input aria-label="Colour style name" value={c.name} maxLength={40} onChange={(e) => put(colors.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)))} className="min-w-0 flex-1 rounded border px-2 py-1" />
          <button type="button" aria-label={`Delete ${c.name}`} title="Delete (things using it keep the design's colour)" onClick={() => put(colors.filter((x) => x.id !== c.id))} className="rounded p-1 hover:bg-black/5">
            <Trash2 size={14} aria-hidden />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => {
          const name = `Colour ${colors.length + 1}`;
          put([...colors, { id: styleId(name, colors.map((c) => c.id)), name, value: "#2563eb" }]);
        }}
        className="inline-flex w-fit items-center gap-1 rounded border px-2 py-1 text-xs"
      >
        <Plus size={14} aria-hidden /> Add colour style
      </button>
    </Section>
  );
}

function TextStyles({ styles, onChange }: { styles: SiteStyles; onChange: (s: SiteStyles) => void }) {
  const text = styles.text ?? [];
  const selected = usePuck((s) => s.selectedItem);
  const [open, setOpen] = useState<string>();
  const put = (next: TextStyle[]) => onChange({ ...styles, text: next });
  const fromSelected = selected && typeof (selected.props as { className?: unknown }).className === "string" ? textClassesOf(String((selected.props as { className: string }).className)) : "";
  return (
    <Section title="Text styles">
      {text.length ? null : <p className="text-xs opacity-70">Save a text&apos;s look as a style (“Heading 1”, “Caption”), then apply it to other texts. Change the style and they all follow.</p>}
      {text.map((t) => (
        <div key={t.id} className="rounded border">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <input aria-label="Text style name" value={t.name} maxLength={40} onChange={(e) => put(text.map((x) => (x.id === t.id ? { ...x, name: e.target.value } : x)))} className="min-w-0 flex-1 rounded border px-2 py-1" />
            <button type="button" aria-expanded={open === t.id} onClick={() => setOpen(open === t.id ? undefined : t.id)} className="rounded border px-2 py-1 text-xs">
              Edit
            </button>
            <button type="button" aria-label={`Delete ${t.name}`} title="Delete (texts using it keep their own look)" onClick={() => put(text.filter((x) => x.id !== t.id))} className="rounded p-1 hover:bg-black/5">
              <Trash2 size={14} aria-hidden />
            </button>
          </div>
          {open === t.id ? (
            <div className="border-t px-2 py-2">
              <StyleField value={t.className} onChange={(className) => put(text.map((x) => (x.id === t.id ? { ...x, className } : x)))} controls={["text", "colours"]} />
            </div>
          ) : null}
        </div>
      ))}
      <button
        type="button"
        onClick={() => {
          const name = `Text style ${text.length + 1}`;
          const id = styleId(name, text.map((t) => t.id));
          put([...text, { id, name, className: fromSelected || "vt:text-lg vt:font-semibold" }]);
          setOpen(id);
        }}
        className="inline-flex w-fit items-center gap-1 rounded border px-2 py-1 text-xs"
      >
        <Plus size={14} aria-hidden /> {fromSelected ? "New text style from the selected text" : "New text style"}
      </button>
    </Section>
  );
}
