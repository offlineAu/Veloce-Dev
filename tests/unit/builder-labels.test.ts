import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cleanLabel, displayName, normalizePackage, sectionKind } from "@/lib/builder/section-labels";
import type { TemplatePackage } from "@/lib/builder/template-package";

describe("section names", () => {
  it("turns designers' labels into short plain names", () => {
    const cases: [string, string][] = [
      ["HERO", "Hero"],
      ["SERVICES (bento)", "Services"],
      ["BRANDS (Logo Slider)", "Brands"],
      ["HOW IT WORKS (text messages)", "How it works"],
      ["QUESTIONS (FAQ Accordion)", "FAQ"],
      ["Topbar", "Top bar"],
      ["Atmospheric Luxury Hero Section", "Atmospheric luxury hero"],
      ["Editorial Deep Dive: Strategic Boardroom Split", "Editorial deep dive"],
      ["Collector Testimonials & Editorial Accolades", "Collector testimonials"],
      ["Interactive Slide-Out Mini-Cart Drawer (Hidden by ", "Slide-out mini-cart drawer"],
      ["Interactive Appointment / Consultation Booking Anc", "Appointment"],
      ["Sticky Bottom Interaction Bar for Seamless Booking", "Bottom interaction bar"],
      ["Executive Acuity BI", "Executive acuity BI"],
      ["CTAContactSection", "CTA contact"],
    ];
    for (const [raw, clean] of cases) expect(cleanLabel(raw), raw).toBe(clean);
  });

  it("knows what a section is, from its label first, then its markup", () => {
    expect(sectionKind("QUESTIONS (FAQ Accordion)", undefined, 5, 10)).toBe("faq");
    expect(sectionKind("BRANDS (Logo Slider)", undefined, 2, 10)).toBe("logos");
    expect(sectionKind("Topbar", undefined, 0, 10)).toBe("navigation");
    expect(sectionKind("CLOSING BAND (Flip Text)", undefined, 8, 10)).toBe("cta");
    expect(sectionKind("Section 2", { t: "div", c: [{ t: "h1", c: ["Hi"] }] }, 1, 5)).toBe("hero");
    expect(sectionKind("Icons (used by the page)", { t: "svg", c: [{ t: "symbol" }] }, 0, 5)).toBe("utility");
  });

  it("cleans every shipped template the same way twice, and maps stored raw names", () => {
    const pkg = JSON.parse(readFileSync("public/builder-templates/aurelia-store/v1/template.json", "utf8")) as TemplatePackage;
    const once = normalizePackage(pkg);
    expect(normalizePackage(once)).toEqual(once);
    const labels = once.pages[0]!.sections.map((s) => s.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels).not.toContain("2");
    expect(displayName("Interactive Slide-Out Mini-Cart Drawer (Hidden by ", once)).toBe("Slide-out mini-cart drawer");
    expect(displayName("My own name", once)).toBe("My own name");
  });
});
