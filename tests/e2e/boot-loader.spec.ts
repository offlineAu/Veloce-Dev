import { expect, test, type Page } from "@playwright/test";

const loader = "[data-boot-loader]";

/** The intro is skipped for automated browsers (they could never click through it); pose as a regular visitor. */
async function asVisitor(page: Page) {
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, "webdriver", { get: () => false }));
}

test.describe("homepage intro", () => {
  test.use({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36" });

  for (const choice of ["Enter with sound", "Enter without sound"] as const) {
    test(`waits at the gate, then plays once per session (${choice})`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await asVisitor(page);
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.goto("/");

      const gate = page.getByRole("dialog", { name: /Welcome to/ });
      await expect(gate).toBeVisible();
      await expect(gate).toContainText("Turn up your volume");
      await expect(page.getByRole("button", { name: "Enter with sound" })).toBeFocused();
      // The page is server-rendered underneath, but held still until the visitor enters.
      await expect(page.locator("#hero-title")).toBeAttached();
      await expect(page.locator("html")).toHaveCSS("overflow", "hidden");

      await page.getByRole("button", { name: choice }).click();
      await expect(page.locator(loader)).toHaveCount(0, { timeout: 12_000 });
      expect(await page.evaluate(() => document.documentElement.dataset.intro)).toBeUndefined();
      expect(await page.evaluate(() => sessionStorage.getItem("veloce-booted"))).toBe("1");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(errors).toEqual([]);

      await page.reload();
      await expect(page.locator(loader)).toBeHidden();
    });
  }

  test("is skipped before paint for reduced motion", async ({ page }) => {
    await asVisitor(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.locator(loader)).toBeHidden();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.dataset.intro)).toBeUndefined();
  });
});

test("crawlers and automated browsers get the page without the intro", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(loader)).toBeHidden();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

for (const reducedMotion of ["reduce", "no-preference"] as const) {
  test(`other marketing pages have no intro with ${reducedMotion} motion`, async ({ page }) => {
    await asVisitor(page);
    await page.emulateMedia({ reducedMotion });
    for (const path of ["/about", "/services/business-websites"]) {
      await page.goto(path);
      await expect(page.locator(loader)).toHaveCount(0);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  });
}
