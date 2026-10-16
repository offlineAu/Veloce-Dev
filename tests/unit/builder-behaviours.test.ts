import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/server/db", () => ({ db: {} }));
vi.mock("server-only", () => ({}));
import {
  BEHAVIOUR_ATTR, behavioursOf, columnsOf, countParts, formatCount, marqueeLayout, marqueeStart, parseBehaviour, stackOffset, visibleRange,
} from "@/lib/builder/behaviours";
import { PIECE_ATTRS } from "@/lib/builder/elements";
import { docFromTemplate } from "@/lib/builder/template-doc";
import { siteDraftSchema } from "@/schemas/site-draft";

describe("interaction attributes", () => {
  it("accept only known behaviours with valid values, normalised", () => {
    expect(parseBehaviour("data-vt-marquee", "y up 24 pause")).toBe("y up 24 pause");
    expect(parseBehaviour("data-vt-marquee", "y up 9999")).toBe("y up 400");
    expect(parseBehaviour("data-vt-marquee", "y left 20")).toBeNull();
    expect(parseBehaviour("data-vt-reveal", "150 stagger:140 from:center")).toBe("150 stagger:140 from:center");
    expect(parseBehaviour("data-vt-reveal", "javascript:alert(1)")).toBeNull();
    expect(parseBehaviour("data-vt-toggle", "mobile-nav close-links")).toBe("mobile-nav close-links");
    expect(parseBehaviour("data-vt-toggle", "#nav")).toBeNull();
    expect(parseBehaviour("data-vt-alt", "−")).toBe("−");
    expect(parseBehaviour("data-vt-alt", "<b>x</b>")).toBeNull();
    expect(parseBehaviour("data-vt-stack", "swipe status:rev-count")).toBe("swipe status:rev-count");
    expect(parseBehaviour("data-vt-seq", "400 900")).toBe("400 900");
    expect(parseBehaviour("data-vt-count", true)).toBe("");
    expect(parseBehaviour("data-vt-state", "open")).toBeNull();
    expect(parseBehaviour("data-vt-onclick", "")).toBeNull();
    expect(behavioursOf({ "data-vt-spy": "", "data-vt-split": "words", "data-vt-tabs": "bad id!", id: "x" })).toEqual({ spy: "", split: "words" });
  });

  it("are kept by pieces, and the runtime's own markers never are", () => {
    expect(PIECE_ATTRS.test("data-vt-marquee")).toBe(true);
    expect(PIECE_ATTRS.test("hidden")).toBe(true);
    expect(PIECE_ATTRS.test("data-vt-state")).toBe(false);
    expect(PIECE_ATTRS.test("data-vt-clone")).toBe(false);
    expect(PIECE_ATTRS.test("data-foo")).toBe(false);
    expect(BEHAVIOUR_ATTR.test("data-vt-form")).toBe(true);
  });

  it("are checked when a design is sent", async () => {
    const pkg = JSON.parse(readFileSync("public/builder-templates/noir-needle/v1/template.json", "utf8"));
    const send = async (attrs: Record<string, unknown>) => {
      const doc = docFromTemplate(pkg, "pieces");
      doc.pages[0]!.data.content.push({ type: "Box", props: { id: "Box-x", tag: "div", className: "", attrs, items: [] } });
      return (await siteDraftSchema.safeParseAsync({ templateId: "noir-needle", data: doc })).success;
    };
    expect(await send({ "data-vt-marquee": "x left 40 pause", "data-vt-reveal": "" })).toBe(true);
    expect(await send({ "data-vt-marquee": "sideways" })).toBe(false);
    expect(await send({ "data-vt-state": "open" })).toBe(false);
    expect(await send({ "data-tracking": "1" })).toBe(false);
  });
});

describe("runtime maths", () => {
  it("fills a marquee with enough copies to loop seamlessly", () => {
    expect(marqueeLayout(800, 12, 760, 24)).toEqual({ shift: 812, copies: 2, seconds: 812 / 24 });
    expect(marqueeLayout(100, 0, 760, 40).copies).toBe(9);
    // Columns side by side start at different points of their loops, never all at their first item.
    const starts = [0, 1, 2].map(marqueeStart);
    expect(new Set(starts.map((x) => x.toFixed(2))).size).toBe(3);
    expect(starts.every((x) => x > 0.05 && x < 1)).toBe(true);
  });

  it("counts up in the number's own format", () => {
    const p = countParts("$1,600")!;
    expect(p).toMatchObject({ before: "$", value: 1600, grouped: true, decimals: 0 });
    expect(formatCount(p, 820.4)).toBe("$820");
    expect(formatCount(countParts("4.9")!, 2.45)).toBe("2.5");
    expect(formatCount(countParts("24 h")!, 24)).toBe("24 h");
    expect(countParts("★★★★★")).toBeNull();
  });

  it("stacks cards from the top one, and finds grid columns", () => {
    expect([0, 1, 2, 3, 4].map((i) => stackOffset(i, 1, 5))).toEqual([4, 0, 1, 2, 3]);
    expect(columnsOf([0, 300.4, 600, 0, 300])).toEqual([0, 1, 2, 0, 1]);
  });

  it("works out what's on screen inside the editor's scaled-down frame", () => {
    // A 1264px-tall page view drawn 794px tall (scale .628), 182px down a 1000px window.
    const r = visibleRange({ top: 182, height: 794 }, 1264, 1000);
    expect(r.top).toBe(0);
    expect(Math.round(r.bottom)).toBe(1264);
    // Scrolled so the frame starts above the window: its top part is off screen.
    expect(Math.round(visibleRange({ top: -314, height: 794 }, 1264, 1000).top)).toBe(500);
    expect(visibleRange(null, 900, 900)).toEqual({ top: 0, bottom: 900 });
  });
});
