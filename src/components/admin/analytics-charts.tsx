"use client";
import { useId, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { STAGE_LABEL } from "@/lib/admin-labels";

/*
 * Owner dashboard charts, in the Ember palette. Always rendered on the dark dashboard surface (--dash-surface), so the
 * series steps below were validated for that surface only: ember coral/teal/violet pass the colour checks in all pairs. A fourth category
 * folds into "Other" instead of getting a generated hue. Every value a hover shows is also printed or in a table.
 */
export const SERIES = ["#d66b5c", "#1fa093", "#8c84e6"] as const;
const OTHER = "#6e6260";
const HIGHLIGHT = "#e8afa1";

export type Day = { day: string; views: number; visitors: number };
export type Row = { name: string; views: number };

const number = (value: number) => new Intl.NumberFormat("en").format(value);
const percent = (value: number, digits = 0) => `${(value * 100).toFixed(digits)}%`;
// Manila calendar days arrive as YYYY-MM-DD; read them at UTC noon so the weekday never shifts.
const asDate = (day: string) => new Date(`${day}T12:00:00Z`);
const dayLabel = (day: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en", { ...options, timeZone: "UTC" }).format(asDate(day));
function niceStep(raw: number) {
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  return Math.max(1, (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * power);
}

/** Period-over-period change. Shown as text with an arrow, never colour alone. */
export function Delta({ current, previous, days }: { current: number; previous?: number; days: number }) {
  if (previous === undefined) return null;
  const text = current === previous ? "No change" : previous === 0 ? "New" : `${current >= previous ? "+" : "−"}${Math.abs((current - previous) / previous * 100).toFixed(1)}%`;
  const up = current > previous, down = current < previous;
  const Icon = down ? ArrowDownRight : ArrowUpRight;
  return <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--dash-muted)]">
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono font-medium ${up ? "border-[var(--dash-mark)]/40 bg-[var(--dash-mark)]/15 text-[var(--dash-accent)]" : "border-[var(--dash-line)] text-[var(--dash-ink)]"}`}>
      {up || down ? <Icon className="size-3" aria-hidden /> : null}{text}
    </span>
    <span>vs previous {days} days</span>
  </p>;
}

/** Decorative trend line for a stat tile; the main traffic chart carries the readable values. */
export function Sparkline({ values, color = SERIES[0] }: { values: number[]; color?: string }) {
  const id = useId();
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const points = values.map((v, i) => `${(i / (values.length - 1)) * 100},${38 - (v / max) * 34}`);
  return <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="mt-5 h-10 w-full" aria-hidden>
    <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity="0.28" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
    <path d={`M0,40 L${points.join(" L")} L100,40 Z`} fill={`url(#${id})`} />
    <path d={`M${points.join(" L")}`} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
  </svg>;
}

/** Daily pageviews (bars) and visitors (line) on one count axis, with a per-day readout on hover, focus and arrow keys. */
export function TrafficChart({ data }: { data: Day[] }) {
  const [active, setActive] = useState<number | null>(null);
  const n = data.length;
  const step = niceStep(Math.max(1, ...data.map(d => d.views)) / 4);
  const max = Math.max(step, Math.ceil(Math.max(1, ...data.map(d => d.views)) / step) * step);
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => max - i * step);
  const x = (i: number) => (i + 0.5) / n * 100;
  const y = (v: number) => 100 - v / max * 100;
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.visitors)}`).join(" ");
  // Fewer date labels on phones so they never collide.
  const labels = (every: number) => data.map((d, i) => (i % every === 0 || i === n - 1) && !(i !== n - 1 && n - 1 - i < every / 2));
  const wide = labels(n <= 7 ? 1 : Math.ceil(n / 6)), narrow = labels(n <= 7 ? 1 : Math.ceil(n / 3));
  const pick = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    setActive(Math.min(n - 1, Math.max(0, Math.floor((event.clientX - box.left) / box.width * n))));
  };
  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    const move = { ArrowLeft: -1, ArrowRight: 1, Home: -n, End: n }[event.key];
    if (move === undefined) return;
    event.preventDefault();
    setActive(current => Math.min(n - 1, Math.max(0, (current ?? (move > 0 ? -1 : n)) + move)));
  };
  const day = active === null ? null : data[active];
  const prior = active ? data[active - 1] : undefined;
  const change = day && prior ? (prior.views ? `${day.views >= prior.views ? "+" : "−"}${Math.abs((day.views - prior.views) / prior.views * 100).toFixed(0)}% vs day before` : day.views ? "Up from none the day before" : null) : null;
  const left = active === null ? 0 : x(active);
  const top = day ? Math.min(y(day.views), y(day.visitors)) : 0;
  return <div>
    <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[var(--dash-muted)]">
      <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: SERIES[0] }} aria-hidden />Pageviews</span>
      <span className="inline-flex items-center gap-2"><span className="h-0.5 w-4 rounded-full" style={{ background: SERIES[1] }} aria-hidden />Visitors</span>
      <span className="ml-auto hidden font-mono sm:inline">Hover or use ← → for each day</span>
    </div>
    <div className="flex gap-3">
      <div className="relative w-8 shrink-0 font-mono text-[11px] text-[var(--dash-muted)]" aria-hidden>
        {ticks.map(t => <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${y(t)}%` }}>{number(t)}</span>)}
      </div>
      <div
        tabIndex={0} role="group" aria-label="Daily traffic chart. Use the left and right arrow keys to read each day."
        onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setActive(null)} onKeyDown={keys} onBlur={() => setActive(null)}
        className="relative h-60 flex-1 touch-pan-y rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--dash-hi)] sm:h-72"
      >
        {ticks.map(t => <div key={t} className={`absolute inset-x-0 border-t ${t === 0 ? "border-[var(--dash-line-strong)]" : "border-dashed border-[var(--dash-line)]"}`} style={{ top: `${y(t)}%` }} aria-hidden />)}
        {active !== null ? <div className="absolute inset-y-0 rounded-md bg-white/[0.045]" style={{ left: `${active / n * 100}%`, width: `${100 / n}%` }} aria-hidden /> : null}
        <div className="absolute inset-0 flex items-end gap-[2px]" aria-hidden>
          {data.map((d, i) => <div key={d.day} className="flex h-full min-w-0 flex-1 items-end justify-center">
            <div className={`${n > 45 ? "w-full" : "w-[62%]"} max-w-8 rounded-t-[4px] transition-[background-color,opacity] duration-150`} style={{ height: `${d.views / max * 100}%`, background: active === i ? HIGHLIGHT : SERIES[0], opacity: active === null || active === i ? 1 : 0.4 }} />
          </div>)}
        </div>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
          <path d={line} fill="none" stroke={SERIES[1]} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
        {data.map((d, i) => (n <= 14 || active === i) ? <span key={d.day} aria-hidden className={`pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--dash-surface)] ${active === i ? "size-3.5" : ""}`} style={{ left: `${x(i)}%`, top: `${y(d.visitors)}%`, background: SERIES[1] }} /> : null)}
        {day ? <div
          aria-hidden
          className="pointer-events-none absolute z-10 w-max min-w-40 rounded-2xl border border-[var(--dash-line-strong)] bg-[var(--dash-raised)] px-4 py-3 text-xs shadow-xl shadow-black/40"
          style={{ left: `${left}%`, top: `${top}%`, transform: `translate(${left < 18 ? "-12%" : left > 82 ? "-88%" : "-50%"}, calc(-100% - 14px))` }}
        >
          <p className="font-mono text-[11px] text-[var(--dash-muted)]">{dayLabel(day.day, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</p>
          <p className="mt-2 flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: SERIES[0] }} /><strong className="font-heading text-base font-semibold text-[var(--dash-ink)]">{number(day.views)}</strong><span className="text-[var(--dash-muted)]">pageviews</span></p>
          <p className="mt-1 flex items-center gap-2"><span className="h-0.5 w-2.5 rounded-full" style={{ background: SERIES[1] }} /><strong className="font-heading text-base font-semibold text-[var(--dash-ink)]">{number(day.visitors)}</strong><span className="text-[var(--dash-muted)]">visitors</span></p>
          {change ? <p className="mt-2 border-t border-[var(--dash-line)] pt-2 text-[var(--dash-muted)]">{change}</p> : null}
        </div> : null}
        <p className="sr-only" aria-live="polite">{day ? `${dayLabel(day.day, { weekday: "long", month: "long", day: "numeric" })}: ${number(day.views)} pageviews, ${number(day.visitors)} visitors.${change ? ` ${change}.` : ""}` : ""}</p>
      </div>
    </div>
    <div className="relative ml-11 mt-3 h-4 font-mono text-[11px] text-[var(--dash-muted)]" aria-hidden>
      {data.map((d, i) => wide[i] || narrow[i] ? <span key={d.day} className={`absolute -translate-x-1/2 whitespace-nowrap ${narrow[i] ? "" : "hidden sm:inline"} ${wide[i] ? "" : "sm:hidden"} ${active === i ? "text-[var(--dash-ink)]" : ""}`} style={{ left: `${x(i)}%` }}>
        {dayLabel(d.day, n <= 7 ? { weekday: "short" } : { month: "short", day: "numeric" })}
      </span> : null)}
    </div>
  </div>;
}

/** Share of pageviews by device as a segmented half-ring; the legend prints every value, hover just focuses one. */
export function DeviceArc({ rows }: { rows: Row[] }) {
  const [active, setActive] = useState<number | null>(null);
  const total = rows.reduce((sum, row) => sum + row.views, 0);
  const top = rows.slice(0, SERIES.length);
  const rest = rows.slice(SERIES.length).reduce((sum, row) => sum + row.views, 0);
  const parts = [...top.map((row, i) => ({ ...row, color: SERIES[i] as string })), ...(rest ? [{ name: "Other", views: rest, color: OTHER }] : [])];
  if (!total) return <p className="py-10 text-sm text-[var(--dash-muted)]">No recorded pageviews in this period.</p>;
  const gap = parts.length > 1 ? 2.5 : 0;
  let angle = 180;
  const arcs = parts.map(part => {
    const sweep = part.views / total * 180;
    const from = angle, to = angle - sweep;
    angle = to;
    return { ...part, from: from - (from === 180 ? 0 : gap / 2), to: to + (to <= 0.001 ? 0 : gap / 2) };
  });
  const point = (deg: number, r = 82) => [100 + r * Math.cos(deg * Math.PI / 180), 100 - r * Math.sin(deg * Math.PI / 180)];
  const shown = parts[active ?? 0]!;
  const title = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);
  return <div>
    <div className="relative mx-auto max-w-72">
      <svg viewBox="0 0 200 108" className="w-full" aria-hidden>
        <path d={`M18,100 A82,82 0 0 1 182,100`} fill="none" stroke="var(--dash-line)" strokeWidth="16" />
        {Array.from({ length: 37 }, (_, i) => { const [x1, y1] = point(i * 5, 66), [x2, y2] = point(i * 5, i % 9 === 0 ? 58 : 62); return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--dash-line-strong)" strokeWidth="1" />; })}
        {arcs.map((arc, i) => { if (arc.from - arc.to <= 0) return null; const [x1, y1] = point(arc.from), [x2, y2] = point(arc.to); return <path key={arc.name} d={`M${x1},${y1} A82,82 0 0 1 ${x2},${y2}`} fill="none" stroke={arc.color} strokeWidth={active === i ? 20 : 16} opacity={active === null || active === i ? 1 : 0.35} className="transition-all duration-150" />; })}
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <p className="font-heading text-5xl font-light tracking-tight tabular-nums text-[var(--dash-ink)]">{Math.round(shown.views / total * 100)}<span className="ml-0.5 text-xl text-[var(--dash-muted)]">%</span></p>
        <p className="mt-1 text-xs text-[var(--dash-muted)]">{title(shown.name)} · {number(shown.views)} views</p>
      </div>
    </div>
    <ul className="mt-6 space-y-1">
      {parts.map((part, i) => <li key={part.name}>
        <button type="button" onPointerEnter={() => setActive(i)} onPointerLeave={() => setActive(null)} onFocus={() => setActive(i)} onBlur={() => setActive(null)} aria-label={`${title(part.name)}: ${number(part.views)} pageviews, ${percent(part.views / total, 1)}`}
          className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm transition-colors ${active === i ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"}`}>
          <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: part.color }} aria-hidden />
          <span className="flex-1 truncate text-[var(--dash-ink)]">{title(part.name)}</span>
          <span className="font-mono text-xs text-[var(--dash-muted)]">{number(part.views)}</span>
          <span className="w-14 text-right font-mono text-xs text-[var(--dash-ink)]">{percent(part.views / total, 1)}</span>
        </button>
      </li>)}
    </ul>
  </div>;
}

/** Ranked breakdown with the count and share printed on every row. */
const duration = (seconds: number) => seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
export function RankedList({ rows, label, valueLabel = "Views", unit = "count", share = true, empty = "No recorded pageviews in this period." }: { rows: Row[]; label: string; valueLabel?: string; unit?: "count" | "seconds"; share?: boolean; empty?: string }) {
  const format = unit === "seconds" ? duration : number;
  const total = rows.reduce((sum, row) => sum + row.views, 0);
  const max = Math.max(1, ...rows.map(row => row.views));
  if (!rows.length) return <p className="py-8 text-sm text-[var(--dash-muted)]">{empty}</p>;
  return <table className="w-full table-fixed text-left text-sm">
    <thead><tr className="text-[11px] uppercase tracking-wider text-[var(--dash-muted)]"><th className="w-7 pb-3 font-mono font-normal">#</th><th className="pb-3 font-mono font-normal">{label}</th><th className="w-20 pb-3 text-right font-mono font-normal">{valueLabel}</th>{share ? <th className="w-16 pb-3 text-right font-mono font-normal">Share</th> : null}</tr></thead>
    <tbody>{rows.map((row, i) => <tr key={row.name} className="group">
      <td className="py-2.5 align-top font-mono text-xs text-[var(--dash-muted)]">{String(i + 1).padStart(2, "0")}</td>
      <td className="py-2.5 pr-4">
        <div className="truncate text-[var(--dash-ink)]" title={row.name}>{row.name}</div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--dash-line)]"><div className="h-full rounded-full bg-[var(--bar)] transition-colors group-hover:bg-[var(--dash-hi)]" style={{ width: `${row.views / max * 100}%`, "--bar": i === 0 ? SERIES[0] : "#d66b5c99" } as CSSProperties} /></div>
      </td>
      <td className="py-2.5 text-right align-top font-mono text-xs text-[var(--dash-ink)]">{format(row.views)}</td>
      {share ? <td className="py-2.5 text-right align-top font-mono text-xs text-[var(--dash-muted)] group-hover:text-[var(--dash-ink)]">{percent(row.views / total, 1)}</td> : null}
    </tr>)}</tbody>
  </table>;
}

const STEP_LABEL = { visit: "Visited the site", cta: "Clicked a call to action", opened: "Opened a form", started: "Started filling it in", inquiry: "Sent an inquiry", booking: "Confirmed a meeting" } as const;
/** Consenting people reaching each step. Bars are relative to the first step; each row prints the count, the share of
 *  all visitors and the step-to-step rate, so the biggest drop-off is readable without hovering. */
export function Funnel({ steps }: { steps: { step: keyof typeof STEP_LABEL; people: number }[] }) {
  const top = Math.max(1, steps[0]?.people ?? 0);
  const rates = steps.map((s, i) => i && steps[i - 1]!.people ? s.people / steps[i - 1]!.people : null);
  const worst = rates.reduce<number | null>((w, r, i) => r !== null && (w === null || r < rates[w]!) ? i : w, null);
  if (!steps[0]?.people) return <p className="py-8 text-sm text-[var(--dash-muted)]">No recorded visits in this period.</p>;
  return <ol className="space-y-3">
    {steps.map((s, i) => <li key={s.step} className="group grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5">
      <span className="flex items-center gap-2 text-sm text-[var(--dash-ink)]"><span className="font-mono text-[11px] text-[var(--dash-muted)]">{String(i + 1).padStart(2, "0")}</span>{STEP_LABEL[s.step]}</span>
      <span className="text-right font-mono text-xs"><strong className="font-semibold text-[var(--dash-ink)]">{number(s.people)}</strong><span className="ml-2 text-[var(--dash-muted)]">{percent(s.people / top, 1)}</span></span>
      <div className="h-7 overflow-hidden rounded-lg bg-[var(--dash-line)]"><div className="h-full rounded-lg bg-[var(--bar)] transition-colors group-hover:bg-[var(--dash-hi)]" style={{ width: `${Math.max(s.people ? 1.5 : 0, s.people / top * 100)}%`, "--bar": i === 0 ? SERIES[0] : "#d66b5c99" } as CSSProperties} /></div>
      <span className={`w-24 whitespace-nowrap text-right font-mono text-[11px] sm:w-44 ${worst === i ? "text-[var(--dash-accent)]" : "text-[var(--dash-muted)]"}`}>{rates[i] === null ? (i ? "—" : "start") : `${percent(rates[i]!)} of step ${i}`}{worst === i ? <span className="hidden sm:inline"> · biggest drop</span> : ""}</span>
    </li>)}
  </ol>;
}

const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const hourLabel = (h: number) => `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;
/** Pageviews by weekday and hour (Asia/Manila), one hue from faint to full. Hover or focus a cell to read it. */
export function HourHeatmap({ cells }: { cells: { weekday: number; hour: number; views: number }[] }) {
  const [active, setActive] = useState<{ weekday: number; hour: number } | null>(null);
  const value = (weekday: number, hour: number) => cells.find(c => c.weekday === weekday && c.hour === hour)?.views ?? 0;
  const max = Math.max(0, ...cells.map(c => c.views));
  const peak = cells.reduce<(typeof cells)[number] | null>((p, c) => !p || c.views > p.views ? c : p, null);
  const shown = active ?? (peak ? { weekday: peak.weekday, hour: peak.hour } : null);
  if (!max) return <p className="py-8 text-sm text-[var(--dash-muted)]">No recorded pageviews in this period.</p>;
  return <div>
    <p className="min-h-6 text-sm text-[var(--dash-muted)]" aria-live="polite">{shown ? <><strong className="font-semibold text-[var(--dash-ink)]">{DAY_SHORT[shown.weekday - 1]} {hourLabel(shown.hour)}–{hourLabel((shown.hour + 1) % 24)}</strong> · {number(value(shown.weekday, shown.hour))} pageviews{active ? "" : " · busiest hour"}</> : null}</p>
    <div className="mt-4 overflow-x-auto pb-1">
      <div className="grid min-w-[560px] grid-cols-[2.5rem_repeat(24,minmax(0,1fr))] gap-[3px]" role="grid" aria-label="Pageviews by weekday and hour">
        {DAY_SHORT.map((day, d) => <div key={day} role="row" className="contents">
          <span role="rowheader" className="self-center font-mono text-[11px] text-[var(--dash-muted)]">{day}</span>
          {Array.from({ length: 24 }, (_, hour) => {
            const v = value(d + 1, hour), on = shown?.weekday === d + 1 && shown.hour === hour;
            return <button key={hour} type="button" role="gridcell" aria-label={`${day} ${hourLabel(hour)}: ${number(v)} pageviews`}
              onPointerEnter={() => setActive({ weekday: d + 1, hour })} onPointerLeave={() => setActive(null)} onFocus={() => setActive({ weekday: d + 1, hour })} onBlur={() => setActive(null)}
              className={`aspect-square rounded-[4px] outline-none transition-[box-shadow] focus-visible:ring-2 focus-visible:ring-[var(--dash-hi)] ${on ? "ring-2 ring-[var(--dash-hi)]" : ""}`}
              style={{ background: v ? `color-mix(in oklab, ${SERIES[0]} ${Math.round(18 + v / max * 82)}%, var(--dash-surface))` : "var(--dash-line)" }} />;
          })}
        </div>)}
        <span aria-hidden />
        {Array.from({ length: 24 }, (_, hour) => <span key={hour} aria-hidden className="pt-1 text-center font-mono text-[10px] text-[var(--dash-muted)]">{hour % 6 === 0 ? hourLabel(hour) : ""}</span>)}
      </div>
    </div>
  </div>;
}

/** Open inquiries by stage as a segmented strip plus a labelled count per stage. */
export function PipelineStages({ stages }: { stages: { status: string; count: number }[] }) {
  const total = stages.reduce((sum, s) => sum + s.count, 0);
  const tone = (status: string) => status === "CONVERTED" ? SERIES[1] : status === "NOT_PROCEEDING" ? OTHER : status === "NEW" ? HIGHLIGHT : SERIES[0];
  return <div>
    <div className="flex h-3 gap-[2px] overflow-hidden rounded-full bg-[var(--dash-line)]" aria-hidden>
      {total ? stages.filter(s => s.count).map(s => <div key={s.status} className="h-full first:rounded-l-full last:rounded-r-full" style={{ flexGrow: s.count, background: tone(s.status) }} />) : null}
    </div>
    <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
      {stages.map(s => <div key={s.status}>
        <dt className="flex items-center gap-2 text-xs text-[var(--dash-muted)]"><span className="h-2 w-2 rounded-full" style={{ background: tone(s.status) }} aria-hidden />{STAGE_LABEL[s.status] ?? s.status}</dt>
        <dd className="mt-1 font-heading text-3xl font-light tabular-nums text-[var(--dash-ink)]">{number(s.count)}</dd>
      </div>)}
    </dl>
  </div>;
}
