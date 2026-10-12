import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cleanKitClasses, deriveKit, kitOf } from "@/lib/builder/template-kit";
import type { TemplatePackage } from "@/lib/builder/template-package";

const noir = JSON.parse(readFileSync("public/builder-templates/noir-needle/v1/template.json", "utf8")) as TemplatePackage;
const noirCss = readFileSync("public/builder-templates/noir-needle/v1/theme.css", "utf8");

describe("design kit", () => {
  it("takes Noir's own headings, text, card, section and container", () => {
    const k = deriveKit(noir);
    expect(k.h2).toBe("vt:font-headline-lg vt:text-headline-lg vt:text-on-surface");
    expect(k.h3).toContain("vt:font-headline-sm");
    expect(k.text).toContain("vt:text-on-surface-variant");
    expect(k.card).toContain("vt:bg-surface-container-low");
    expect(k.section).toContain("vt:py-space-xxl");
    expect(k.container).toContain("vt:mx-auto");
    expect(k.button).toContain("vt:bg-primary");
  });

  it("ignores the header, nav and footer (logo, nav button, social icons)", () => {
    const k = deriveKit(noir);
    expect(k.image).not.toMatch(/vt:h-8\b/); // the logo
    expect(k.card).not.toContain("vt:rounded-full"); // social icon circles
  });

  it("keeps how a piece looks but not where it sits", () => {
    expect(cleanKitClasses("vt:hidden vt:sm:inline-flex vt:px-4 vt:mt-2 vt:-mt-20 vt:absolute vt:mx-auto vt:bg-primary")).toBe("vt:px-4 vt:mx-auto vt:bg-primary");
  });

  it("drops class names the stylesheet never defines (script hooks)", () => {
    expect(deriveKit(noir).button).toContain("vt:next-step-trigger");
    expect(kitOf(noir, noirCss)?.button).not.toContain("next-step-trigger");
  });
});
