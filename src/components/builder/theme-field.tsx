"use client";

import { FONT_CHOICES, THEME_PRESETS, normalizeTheme, withAccent, type ThemeTokens } from "@/lib/builder/theme";

/** The page panel's theme editor: presets, a brand colour and fonts. Fine-grained tokens come from templates. */
export function ThemeField({ value, onChange, readOnly }: { value: ThemeTokens | undefined; onChange: (v: ThemeTokens) => void; readOnly?: boolean }) {
  const theme = normalizeTheme(value);
  const fontOptions = (current: string) =>
    FONT_CHOICES.some((f) => f.value === current) ? FONT_CHOICES : [{ label: "Template font", value: current }, ...FONT_CHOICES];

  return (
    <div className="flex flex-col gap-4 text-sm">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-semibold">Theme</legend>
        <div className="grid grid-cols-4 gap-2">
          {THEME_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={readOnly}
              aria-pressed={theme.preset === p.id}
              title={p.label}
              onClick={() => onChange(p.theme)}
              className="flex flex-col items-center gap-1 rounded-md border p-1.5 text-[11px] aria-pressed:border-2 aria-pressed:border-current"
            >
              <span aria-hidden className="flex h-6 w-full overflow-hidden rounded" style={{ background: p.theme.bg }}>
                <span className="m-1 w-1/2 rounded-sm" style={{ background: p.theme.accent }} />
              </span>
              <span className="truncate">{p.label}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex items-center justify-between gap-3">
        <span className="font-semibold">Brand colour</span>
        <input
          type="color"
          disabled={readOnly}
          value={theme.accent}
          onChange={(e) => onChange(withAccent(theme, e.target.value))}
          className="h-9 w-14 cursor-pointer rounded border"
        />
      </label>

      {(["fontHeading", "fontBody"] as const).map((key) => (
        <label key={key} className="flex flex-col gap-1">
          <span className="font-semibold">{key === "fontHeading" ? "Heading font" : "Body font"}</span>
          <select
            disabled={readOnly}
            value={theme[key]}
            onChange={(e) => onChange({ ...theme, preset: undefined, [key]: e.target.value })}
            className="min-h-9 rounded border px-2"
          >
            {fontOptions(theme[key]).map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </label>
      ))}
    </div>
  );
}
