import { describe, expect, it } from "vitest";
import { deviceValues } from "@/lib/builder/class-groups";
import { align, distribute, fitGroup, flowItemClasses, freeGroupClasses, freeItemClasses, placeItem, readItemRect, snap } from "@/lib/builder/free-layout";

const set = (c: string) => new Set(c.split(" ").filter(Boolean));

describe("free layout classes", () => {
  it("places items from tablets up and leaves phones in the flow", () => {
    const c = freeItemClasses("vt:text-lg vt:md:mt-4 vt:hover:underline", { x: 120, y: 48, w: 320, h: 80 }, false);
    expect(set(c)).toEqual(set("vt:text-lg vt:md:mt-4 vt:hover:underline vt:md:absolute vt:md:left-[120px] vt:md:top-[48px] vt:md:w-[320px]"));
    expect(readItemRect(c, "desktop")).toEqual({ x: 120, y: 48, w: 320, h: undefined });
    expect(set(freeGroupClasses("vt:flex vt:gap-4", 640))).toEqual(set("vt:flex vt:gap-4 vt:md:relative vt:md:min-h-[640px]"));
  });

  it("drops the design's own offsets, insets and translations, which would fight the new position", () => {
    const c = freeItemClasses("vt:absolute vt:inset-0 vt:-translate-x-1/2 vt:left-1/2", { x: 10, y: 20, w: 30, h: 40 }, true);
    expect(c).not.toMatch(/inset|translate|left-1\/2/);
    expect(c).toContain("vt:md:h-[40px]");
  });

  it("moves on the desktop, reaching the tablet when they matched; phones never change", () => {
    const start = freeItemClasses("", { x: 100, y: 100, w: 200, h: 50 }, false);
    const moved = placeItem(start, { x: 160 }, "desktop");
    expect(readItemRect(moved, "desktop").x).toBe(160);
    expect(readItemRect(moved, "tablet").x).toBe(160);
    expect(deviceValues(moved, /^-?left-/).phone).toBeUndefined();
    // Then the tablet gets its own place; the desktop keeps 160.
    const tablet = placeItem(moved, { x: 40 }, "tablet");
    expect([readItemRect(tablet, "tablet").x, readItemRect(tablet, "desktop").x]).toEqual([40, 160]);
    expect(deviceValues(tablet, /^(static|relative|absolute|fixed|sticky)$/).phone).toBeUndefined();
  });

  it("gives an item that had no place yet one from tablets up", () => {
    const c = placeItem("vt:text-lg", { x: 8, y: 8, w: 100 }, "desktop");
    expect(deviceValues(c, /^-?left-/)).toEqual({ phone: undefined, tablet: "left-[8px]", desktop: "left-[8px]" });
    expect(deviceValues(c, /^absolute$/).phone).toBeUndefined();
  });

  it("goes back to the flow", () => {
    const c = flowItemClasses(freeItemClasses("vt:text-lg", { x: 1, y: 2, w: 3, h: 4 }, true));
    expect(c).toBe("vt:text-lg");
  });

  it("grows the group to fit, never shrinks it", () => {
    const g = freeGroupClasses("", 400);
    expect(fitGroup(g, 300, "desktop")).toBe(g);
    expect(deviceValues(fitGroup(g, 520, "desktop"), /^min-h-/).desktop).toBe("min-h-[520px]");
  });
});

describe("smart guides", () => {
  const group = { w: 1000, h: 600 };
  it("snaps a moved item to a neighbour's edge and the group's centre", () => {
    const other = { x: 300, y: 100, w: 200, h: 100 };
    const { rect, guides } = snap({ x: 504, y: 297, w: 100, h: 10 }, [other], group, { move: true });
    expect(rect.x).toBe(500); // its left on the neighbour's right
    expect(rect.y).toBe(295); // its middle on the group's middle (300)
    expect(guides).toEqual({ x: [500], y: [300] });
  });

  it("snaps only the edges being resized", () => {
    const { rect } = snap({ x: 10, y: 10, w: 495, h: 100 }, [], group, { right: true });
    expect(rect).toEqual({ x: 10, y: 10, w: 490, h: 100 }); // right edge to the centre (500)
  });

  it("leaves it alone when nothing is close", () => {
    expect(snap({ x: 123, y: 77, w: 50, h: 50 }, [], group, { move: true }).guides).toEqual({ x: [], y: [] });
  });
});

describe("align and distribute", () => {
  const rs = [{ x: 0, y: 0, w: 100, h: 20 }, { x: 150, y: 40, w: 50, h: 20 }, { x: 400, y: 10, w: 100, h: 60 }];
  it("aligns on the selection's bounds", () => {
    expect(align(rs, "right").map((r) => r.x + r.w)).toEqual([500, 500, 500]);
    expect(align(rs, "middle").map((r) => r.y + r.h / 2)).toEqual([35, 35, 35]);
  });
  it("spaces items evenly between the first and the last", () => {
    const d = distribute(rs, "x");
    expect(d[0]!.x).toBe(0);
    expect(d[2]!.x).toBe(400);
    expect(d[1]!.x - (d[0]!.x + d[0]!.w)).toBeCloseTo(d[2]!.x - (d[1]!.x + d[1]!.w));
  });
});
