"use client";
import { useId, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

/*
 * Owner dashboard charts. Always rendered on the dark dashboard surface (--dash-surface), so the series steps below
 * were validated for that surface only: orange/teal/violet pass the colour checks in all pairs. A fourth category
 * folds into "Other" instead of getting a generated hue. Every value a hover shows is also printed or in a table.
 */
export const SERIES = ["#d4692e", "#2e9e8e", "#8c84e6"] as const;
const OTHER = "#6b625a";
const HIGHLIGHT = "#f08a4c";

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
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono font-medium ${up ? "border-[#d4692e]/40 bg-[#d4692e]/15 text-[#f3a877]" : "border-[var(--dash-line)] text-[var(--dash-ink)]"}`}>
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
        className="relative h-60 flex-1 touch-pan-y rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#f08a4c] sm:h-72"
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
          className="pointer-events-none absolute z-10 w-max min-w-40 rounded-2xl border border-[var(--dash-line-strong)] bg-[#2a2420] px-4 py-3 text-xs shadow-xl shadow-black/40"
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

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
/** Average pageviews per weekday as a dot column (one hue, magnitude); the busiest day is highlighted and named. */
export function WeekdayDots({ data }: { data: Day[] }) {
  const [active, setActive] = useState<number | null>(null);
  const DOTS = 6;
  const days = WEEKDAYS.map((name, weekday) => {
    const matches = data.filter(d => asDate(d.day).getUTCDay() === weekday);
    const views = matches.reduce((sum, d) => sum + d.views, 0);
    return { name, count: matches.length, views, average: matches.length ? views / matches.length : 0 };
  });
  const total = days.reduce((sum, d) => sum + d.views, 0);
  const peakAverage = Math.max(0, ...days.map(d => d.average));
  const peak = days.findIndex(d => d.average === peakAverage && d.average > 0);
  const shown = days[active ?? (peak < 0 ? 0 : peak)]!;
  return <div>
    <p className="min-h-10 text-sm text-[var(--dash-muted)]" aria-live="polite">
      {total ? <><strong className="font-semibold text-[var(--dash-ink)]">{shown.name}s</strong> average {number(Math.round(shown.average))} pageviews · {percent(shown.views / total)} of this period{active === null && peak >= 0 ? " · busiest" : ""}</> : "No recorded pageviews in this period."}
    </p>
    <div className="mt-4 grid grid-cols-7 gap-1">
      {days.map((d, i) => {
        const filled = d.average ? Math.max(1, Math.round(d.average / peakAverage * DOTS)) : 0;
        const on = active === i || (active === null && i === peak);
        return <button key={d.name} type="button" onPointerEnter={() => setActive(i)} onPointerLeave={() => setActive(null)} onFocus={() => setActive(i)} onBlur={() => setActive(null)}
          aria-label={`${d.name}: average ${number(Math.round(d.average))} pageviews over ${d.count} ${d.count === 1 ? "day" : "days"}`}
          className={`flex flex-col items-center gap-2 rounded-2xl py-3 transition-colors ${active === i ? "bg-white/[0.05]" : ""}`}>
          {Array.from({ length: DOTS }, (_, row) => {
            const lit = DOTS - row <= filled;
            return <span key={row} aria-hidden className="size-3.5 rounded-full transition-colors sm:size-4" style={{ background: lit ? (on ? HIGHLIGHT : "#d4692e66") : "var(--dash-line)" }} />;
          })}
          <span className={`mt-1 font-mono text-[11px] ${on ? "text-[var(--dash-ink)]" : "text-[var(--dash-muted)]"}`} aria-hidden>{d.name.slice(0, 3)}</span>
        </button>;
      })}
    </div>
  </div>;
}

/** Ranked breakdown with the count and share printed on every row. */
export function RankedList({ rows, label, empty = "No recorded pageviews in this period." }: { rows: Row[]; label: string; empty?: string }) {
  const total = rows.reduce((sum, row) => sum + row.views, 0);
  const max = Math.max(1, ...rows.map(row => row.views));
  if (!rows.length) return <p className="py-8 text-sm text-[var(--dash-muted)]">{empty}</p>;
  return <table className="w-full table-fixed text-left text-sm">
    <thead><tr className="text-[11px] uppercase tracking-wider text-[var(--dash-muted)]"><th className="w-7 pb-3 font-mono font-normal">#</th><th className="pb-3 font-mono font-normal">{label}</th><th className="w-20 pb-3 text-right font-mono font-normal">Views</th><th className="w-16 pb-3 text-right font-mono font-normal">Share</th></tr></thead>
    <tbody>{rows.map((row, i) => <tr key={row.name} className="group">
      <td className="py-2.5 align-top font-mono text-xs text-[var(--dash-muted)]">{String(i + 1).padStart(2, "0")}</td>
      <td className="py-2.5 pr-4">
        <div className="truncate text-[var(--dash-ink)]" title={row.name}>{row.name}</div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--dash-line)]"><div className="h-full rounded-full bg-[var(--bar)] transition-colors group-hover:bg-[#f08a4c]" style={{ width: `${row.views / max * 100}%`, "--bar": i === 0 ? SERIES[0] : "#d4692e99" } as CSSProperties} /></div>
      </td>
      <td className="py-2.5 text-right align-top font-mono text-xs text-[var(--dash-ink)]">{number(row.views)}</td>
      <td className="py-2.5 text-right align-top font-mono text-xs text-[var(--dash-muted)] group-hover:text-[var(--dash-ink)]">{percent(row.views / total, 1)}</td>
    </tr>)}</tbody>
  </table>;
}
