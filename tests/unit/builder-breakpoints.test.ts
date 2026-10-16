import { describe, expect, it } from "vitest";
import { deviceFor, deviceValues, ownOn, readStyle, scalesFromCss, writeDevice, writeStyle, type Scales } from "@/lib/builder/class-groups";

const s: Scales = scalesFromCss("[data-vt=x]{--vt-color-primary:#f2ca50;--vt-color-line:#ddd}");
const set = (c: string) => new Set(c.split(" ").filter(Boolean));
const pad = /^py-/;

describe("styles per device", () => {
  it("knows which device a canvas width shows", () => {
    expect([deviceFor(375), deviceFor(768), deviceFor(1280), deviceFor("100%"), deviceFor(undefined)]).toEqual(["phone", "tablet", "desktop", "desktop", "desktop"]);
  });

  it("reads each device's value from mobile-first classes, the design's own breakpoints included", () => {
    expect(deviceValues("vt:py-4 vt:md:py-8 vt:xl:py-16", pad)).toEqual({ phone: "py-4", tablet: "py-8", desktop: "py-16" });
    expect(deviceValues("vt:sm:py-6", pad)).toEqual({ phone: undefined, tablet: "py-6", desktop: "py-6" });
    // Other variants (hover, dark) are not screen sizes.
    expect(deviceValues("vt:hover:py-2 vt:py-4", pad)).toEqual({ phone: "py-4", tablet: "py-4", desktop: "py-4" });
  });

  it("cascades desktop-first: a desktop change reaches devices that matched it, never ones with their own value", () => {
    // All the same: one value everywhere, stored bare.
    expect(writeDevice("vt:py-4", pad, "desktop", "py-10")).toBe("vt:py-10");
    // Phones had their own: they keep it.
    expect(set(writeDevice("vt:py-4 vt:md:py-8", pad, "desktop", "py-12"))).toEqual(set("vt:py-4 vt:md:py-12"));
    // A tablet value reaches phones that matched, not the desktop.
    expect(set(writeDevice("vt:py-8", pad, "tablet", "py-6"))).toEqual(set("vt:py-6 vt:lg:py-8"));
    // A phone value is the phone's alone.
    expect(set(writeDevice("vt:py-8", pad, "phone", "py-2"))).toEqual(set("vt:py-2 vt:md:py-8"));
  });

  it("keeps the design's larger-screen values when one device changes (no more wiped md:/lg: padding)", () => {
    const design = "vt:px-6 vt:py-12 vt:md:py-20 vt:lg:py-32 vt:hover:py-14";
    const c = writeStyle(design, s, "padY", "8", "phone");
    expect(deviceValues(c, pad)).toEqual({ phone: "py-8", tablet: "py-20", desktop: "py-32" });
    expect(c).toContain("vt:hover:py-14");
    expect(c).toContain("vt:px-6");
  });

  it("splits shorthands per device so one side can change", () => {
    const c = writeStyle("vt:p-4 vt:md:p-8", s, "padY", "2", "phone");
    expect(readStyle(c, s, "phone")).toMatchObject({ padY: "2", padX: "4" });
    expect(readStyle(c, s, "tablet")).toMatchObject({ padY: "8", padX: "8" });
  });

  it("tells a device's own value from an inherited one, and resets to the inherited one", () => {
    const c = "vt:py-4 vt:md:py-8";
    // The tablet shows the desktop's 8 (inherited); the phone's 4 is its own.
    expect(ownOn(c, pad, "tablet")).toBe(false);
    expect(ownOn(c, pad, "phone")).toBe(true);
    expect(ownOn("vt:py-4 vt:md:py-8 vt:lg:py-12", pad, "tablet")).toBe(true);
    expect(ownOn("vt:py-8", pad, "phone")).toBe(false);
    // Reset the phone: it takes the tablet's value again.
    expect(writeDevice(c, pad, "phone", deviceValues(c, pad).tablet)).toBe("vt:py-8");
  });
});

describe("new style controls", () => {
  const round = <K extends Parameters<typeof writeStyle>[2]>(key: K, value: Parameters<typeof writeStyle<K>>[3], from = "") => readStyle(writeStyle(from, s, key, value), s)[key];

  it("round-trip on every device", () => {
    const cases: [Parameters<typeof writeStyle>[2], string][] = [
      ["marginTop", "6"], ["marginBottom", "-4"], ["marginX", "auto"], ["height", "screen"], ["minHeight", "96"],
      ["borderWidth", "2"], ["borderWidth", "1"], ["borderStyle", "dashed"], ["borderColor", "primary"], ["opacity", "50"], ["blur", "sm"],
      ["position", "absolute"], ["top", "4"], ["left", "-2"], ["z", "20"], ["leading", "tight"], ["tracking", "wide"], ["textCase", "uppercase"],
    ];
    for (const [key, value] of cases) expect(round(key, value as never), `${key}=${value}`).toBe(value);
  });

  it("split margin and inset shorthands into the side being changed", () => {
    expect(readStyle(writeStyle("vt:m-4", s, "marginTop", "8"), s)).toMatchObject({ marginTop: "8", marginBottom: "4", marginX: "4" });
    expect(readStyle(writeStyle("vt:absolute vt:inset-0", s, "top", "6"), s)).toMatchObject({ position: "absolute", top: "6", right: "0", bottom: "0", left: "0" });
  });

  it("keep border width, style and colour apart", () => {
    const v = readStyle("vt:border-2 vt:border-dashed vt:border-line vt:border-t-4", s);
    expect(v).toMatchObject({ borderWidth: "2", borderStyle: "dashed", borderColor: "line" });
  });
});
