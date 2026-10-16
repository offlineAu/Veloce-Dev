/*
 * Free layout (the Figma-style canvas): a group whose items are placed by position and size instead of flowing.
 * Everything is ordinary classes, per device, so validation, rendering and the team preview need nothing new:
 *
 *   group  vt:md:relative vt:md:min-h-[640px]
 *   item   vt:md:absolute vt:md:left-[120px] vt:md:top-[48px] vt:md:w-[320px] (vt:md:h-[…] once resized)
 *
 * Free placement applies from tablets up (`md:`); on phones the items stay in the normal flow and stack, so a design
 * never runs off a small screen. Desktop and tablet can differ (lg: values), as with any style. No React, no DOM.
 */
import { deviceValues, encodeDevices, writeDevice, type Device, type Matcher } from "./class-groups";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const POSITION: Matcher = /^(static|relative|absolute|fixed|sticky)$/;
const LEFT: Matcher = /^-?left-/;
const TOP: Matcher = /^-?top-/;
const RIGHT: Matcher = /^-?right-/;
const BOTTOM: Matcher = /^-?bottom-/;
const WIDTH: Matcher = /^w-/;
const HEIGHT: Matcher = /^h-/;
const MIN_HEIGHT: Matcher = /^min-h-/;
const INSET: Matcher = /^-?inset(-[xy])?-/;
const TRANSLATE: Matcher = /^-?translate-[xy]-/;

const px = (n: number) => `[${Math.round(n)}px]`;
/** A class list without the given groups at any screen size (state variants such as hover: are kept). */
function clear(className: string, groups: Matcher[]): string {
  let c = className;
  for (const m of groups) c = encodeDevices(c, m, { phone: undefined, tablet: undefined, desktop: undefined });
  return c;
}
/** Sets a group on tablets and desktops only (phones keep the flow). */
const fromTablet = (c: string, m: Matcher, v: string | undefined) => encodeDevices(c, m, { phone: undefined, tablet: v, desktop: v });

/** The group's classes once it is free: positioned for its items, tall enough to hold them. */
export function freeGroupClasses(className: string, height: number): string {
  let c = fromTablet(className, POSITION, "relative");
  c = fromTablet(c, MIN_HEIGHT, `min-h-${px(height)}`);
  return c;
}

/** An item's classes once its group is free, at the place it had in the flow. */
export function freeItemClasses(className: string, r: Rect, keepHeight: boolean): string {
  // Offsets, insets and translations from the design would fight the new position: they go.
  let c = clear(className, [LEFT, TOP, RIGHT, BOTTOM, INSET, TRANSLATE]);
  c = fromTablet(c, POSITION, "absolute");
  c = fromTablet(c, LEFT, `left-${px(r.x)}`);
  c = fromTablet(c, TOP, `top-${px(r.y)}`);
  c = fromTablet(c, WIDTH, `w-${px(r.w)}`);
  if (keepHeight) c = fromTablet(c, HEIGHT, `h-${px(r.h)}`);
  return c;
}

/** Back to the flow: the item loses its free position and size (and the group its height and anchor). */
export function flowItemClasses(className: string): string {
  return clear(className, [POSITION, LEFT, TOP, WIDTH, HEIGHT]);
}
export function flowGroupClasses(className: string): string {
  return clear(className, [MIN_HEIGHT]);
}

/**
 * Moves or resizes an item on one device. The desktop's change reaches the tablet when they matched (as every style
 * does); phones are never touched, they stack.
 */
export function placeItem(className: string, r: Partial<Rect>, device: Exclude<Device, "phone">): string {
  const set = (c: string, m: Matcher, v: string) => {
    const phone = deviceValues(c, m).phone;
    const next = writeDevice(c, m, device, v);
    // Phones stack: whatever the cascade did, the phone keeps exactly what it had.
    return encodeDevices(next, m, { ...deviceValues(next, m), phone });
  };
  let c = fromTablet(className, POSITION, "absolute");
  if (r.x !== undefined) c = set(c, LEFT, `left-${px(r.x)}`);
  if (r.y !== undefined) c = set(c, TOP, `top-${px(r.y)}`);
  if (r.w !== undefined) c = set(c, WIDTH, `w-${px(Math.max(8, r.w))}`);
  if (r.h !== undefined) c = set(c, HEIGHT, `h-${px(Math.max(8, r.h))}`);
  return c;
}

/** Grows a free group so its items fit (never shrinks it: an empty area at the bottom can be deliberate). */
export function fitGroup(className: string, bottom: number, device: Exclude<Device, "phone">): string {
  const cur = deviceValues(className, MIN_HEIGHT)[device];
  const n = cur?.match(/^min-h-\[(\d+)px\]$/)?.[1];
  if (n && Number(n) >= bottom) return className;
  return writeDevice(className, MIN_HEIGHT, device, `min-h-${px(bottom)}`);
}

/* ------------------------------------------------------------------------------------------------------------------
 * Smart guides: snapping a moving or resizing rectangle to its neighbours and to the group's edges and centre.
 * ---------------------------------------------------------------------------------------------------------------- */

export interface Guides {
  /** Vertical lines (x positions) and horizontal lines (y positions) to draw, in the group's coordinates. */
  x: number[];
  y: number[];
}

/** Which edges move: all of them when dragging, the handle's when resizing (e.g. "right" + "bottom"). */
export type Edges = { left?: boolean; right?: boolean; top?: boolean; bottom?: boolean; move?: boolean };

export function snap(r: Rect, others: Rect[], group: { w: number; h: number }, edges: Edges, threshold = 6): { rect: Rect; guides: Guides } {
  const xs = [0, group.w / 2, group.w, ...others.flatMap((o) => [o.x, o.x + o.w / 2, o.x + o.w])];
  const ys = [0, group.h / 2, group.h, ...others.flatMap((o) => [o.y, o.y + o.h / 2, o.y + o.h])];
  const best = (lines: number[], candidates: number[]) => {
    let hit: { delta: number; line: number } | undefined;
    for (const c of candidates) for (const l of lines) {
      const d = l - c;
      if (Math.abs(d) <= threshold && (!hit || Math.abs(d) < Math.abs(hit.delta))) hit = { delta: d, line: l };
    }
    return hit;
  };
  const out = { ...r };
  const guides: Guides = { x: [], y: [] };
  if (edges.move) {
    const hx = best(xs, [r.x, r.x + r.w / 2, r.x + r.w]);
    if (hx) {
      out.x += hx.delta;
      guides.x.push(hx.line);
    }
    const hy = best(ys, [r.y, r.y + r.h / 2, r.y + r.h]);
    if (hy) {
      out.y += hy.delta;
      guides.y.push(hy.line);
    }
    return { rect: out, guides };
  }
  if (edges.left) {
    const h = best(xs, [r.x]);
    if (h) {
      out.x += h.delta;
      out.w -= h.delta;
      guides.x.push(h.line);
    }
  }
  if (edges.right) {
    const h = best(xs, [r.x + r.w]);
    if (h) {
      out.w += h.delta;
      guides.x.push(h.line);
    }
  }
  if (edges.top) {
    const h = best(ys, [r.y]);
    if (h) {
      out.y += h.delta;
      out.h -= h.delta;
      guides.y.push(h.line);
    }
  }
  if (edges.bottom) {
    const h = best(ys, [r.y + r.h]);
    if (h) {
      out.h += h.delta;
      guides.y.push(h.line);
    }
  }
  return { rect: out, guides };
}

/* ------------------------------------------------------------------------------------------------------------------
 * Align and distribute (several items selected in one group).
 * ---------------------------------------------------------------------------------------------------------------- */

export type Align = "left" | "center" | "right" | "top" | "middle" | "bottom";

/** New positions for the items, lined up on the selection's own bounds. */
export function align(rects: Rect[], how: Align): Rect[] {
  const left = Math.min(...rects.map((r) => r.x));
  const right = Math.max(...rects.map((r) => r.x + r.w));
  const top = Math.min(...rects.map((r) => r.y));
  const bottom = Math.max(...rects.map((r) => r.y + r.h));
  return rects.map((r) => {
    switch (how) {
      case "left":
        return { ...r, x: left };
      case "center":
        return { ...r, x: (left + right) / 2 - r.w / 2 };
      case "right":
        return { ...r, x: right - r.w };
      case "top":
        return { ...r, y: top };
      case "middle":
        return { ...r, y: (top + bottom) / 2 - r.h / 2 };
      case "bottom":
        return { ...r, y: bottom - r.h };
    }
  });
}

/** Equal gaps between the items, keeping the first and last where they are. */
export function distribute(rects: Rect[], axis: "x" | "y"): Rect[] {
  if (rects.length < 3) return rects;
  const size = axis === "x" ? "w" : "h";
  const order = rects.map((r, i) => ({ r, i })).sort((a, b) => a.r[axis] - b.r[axis]);
  const first = order[0]!.r;
  const last = order.at(-1)!.r;
  const span = last[axis] + last[size] - first[axis];
  const gap = (span - order.reduce((n, o) => n + o.r[size], 0)) / (order.length - 1);
  const out = [...rects];
  let at = first[axis];
  for (const o of order) {
    out[o.i] = { ...o.r, [axis]: at };
    at += o.r[size] + gap;
  }
  return out;
}

/** The free position an item has on a device, read back from its classes. */
export function readItemRect(className: string, device: Exclude<Device, "phone">): Partial<Rect> {
  const num = (u: string | undefined, prefix: string) => {
    const m = u?.match(new RegExp(`^${prefix}-\\[(-?\\d+(?:\\.\\d+)?)px\\]$`));
    return m ? Number(m[1]) : undefined;
  };
  return {
    x: num(deviceValues(className, LEFT)[device], "left"),
    y: num(deviceValues(className, TOP)[device], "top"),
    w: num(deviceValues(className, WIDTH)[device], "w"),
    h: num(deviceValues(className, HEIGHT)[device], "h"),
  };
}
