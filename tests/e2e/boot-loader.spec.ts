import { expect, test, type Page } from "@playwright/test";

const loader = "[data-boot-loader]";

/** The intro is skipped for automated browsers; pose as a regular visitor. */
async function asVisitor(page: Page) {
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, "webdriver", { get: () => false }));
}

test.describe("homepage intro", () => {
  test.use({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36" });

  test("starts on its own, then plays once per session", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await asVisitor(page);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");

    // The page is server-rendered underneath, but held still while the intro plays.
    await expect(page.locator(loader)).toBeVisible();
    await expect(page.locator("#hero-title")).toBeAttached();
    await expect(page.locator("html")).toHaveCSS("overflow", "hidden");
    await expect(page.getByRole("button", { name: /enter/i })).toHaveCount(0);

    await expect(page.locator(loader)).toHaveAttribute("data-boot-phase", "playing");
    await expect(page.locator(loader)).toBeHidden({ timeout: 12_000 });
    expect(await page.evaluate(() => document.documentElement.dataset.intro)).toBeUndefined();
    expect(await page.evaluate(() => sessionStorage.getItem("veloce-booted"))).toBe("1");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(errors).toEqual([]);

    await page.reload();
    await expect(page.locator(loader)).toBeHidden();
  });

  test("plays without the JavaScript bundle", async ({ page }) => {
    // The sequence runs from inline scripts, so a slow or failed bundle download cannot hold the intro up.
    await page.route(/\/_next\/static\/chunks\/.*\.js(\?|$)/, (route) => route.abort());
    await asVisitor(page);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/", { waitUntil: "commit" });

    await expect(page.locator(loader)).toHaveAttribute("data-boot-phase", "playing");
    await expect(page.locator(loader)).toBeHidden({ timeout: 12_000 });
    expect(await page.evaluate(() => document.documentElement.dataset.booted)).toBe("1");
    expect(await page.evaluate(() => sessionStorage.getItem("veloce-booted"))).toBe("1");
  });

  test("keeps playing when React hydrates mid-sequence", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    // A slow bundle: the sequence is already running when hydration lands.
    await page.route(/\/_next\/static\/chunks\/.*\.js(\?|$)/, async (route) => {
      await new Promise((r) => setTimeout(r, 2_500));
      await route.continue();
    });
    await asVisitor(page);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/", { waitUntil: "commit" });

    await expect(page.locator(loader)).toHaveAttribute("data-boot-phase", "playing");
    await expect(page.locator(loader)).toBeHidden({ timeout: 15_000 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(errors.filter((e) => /hydrat|did not match/i.test(e))).toEqual([]);
  });

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

test.describe("client navigation as a visitor", () => {
  test.use({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36" });
  test("client navigation home does not insert an inert script or show the intro", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await asVisitor(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/about");
  await page.getByRole("link", { name: /Veloce home/i }).first().click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator(loader)).toHaveCount(1);
  await expect(page.locator(loader)).toBeHidden();
  expect(errors.filter(error => /Encountered a script tag/i.test(error))).toEqual([]);
});
});
