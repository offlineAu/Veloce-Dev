import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Automated browsers get the flat laptop (their WebGL is software-rendered at a few frames a second), which plays the
// same build on a 2D canvas. "Always play" keeps the site from switching itself to lite mode on a slow machine.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { sessionStorage.setItem("veloce-booted", "1"); localStorage.setItem("veloce-motion", "full"); });
});

test("the hero laptop codes, deploys and shows each kind of work", async ({ page }) => {
  await page.goto("/");
  const showcase = page.locator("[data-laptop-showcase]");
  const choices = showcase.getByRole("group", { name: "Choose what to build" });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Websites that work for your business");
  await expect(choices.getByRole("button", { name: "Website" })).toHaveAttribute("aria-pressed", "true");
  // The flat laptop's screen and the phone's.
  await expect(showcase.locator("canvas")).toHaveCount(2, { timeout: 20_000 });
  await expect(showcase.locator("canvas").first()).toBeVisible();
  await choices.getByRole("button", { name: "Online store" }).click();
  await expect(choices.getByRole("button", { name: "Online store" })).toHaveAttribute("aria-pressed", "true");
  await expect(showcase.getByText("Coding an online store…")).toBeVisible({ timeout: 15_000 });
  await expect(showcase.getByText("Deploying…")).toBeVisible({ timeout: 15_000 });
  await expect(showcase.getByText("Sample build: Homeware store")).toBeVisible({ timeout: 15_000 });
  await showcase.getByRole("link", { name: "View the Homeware store sample" }).click();
  await expect(page).toHaveURL(/\/build\/preview\//);
});

test("the loop pauses on a finished build, and the story order holds", async ({ page }) => {
  await page.goto("/");
  const showcase = page.locator("[data-laptop-showcase]");
  await expect(showcase.locator("canvas")).toHaveCount(2, { timeout: 20_000 });
  // The lid control belongs to the 3D laptop only.
  await expect(showcase.getByRole("button", { name: /the lid/ })).toHaveCount(0);
  await showcase.getByRole("button", { name: "Pause the build loop" }).click();
  await expect(showcase.getByRole("button", { name: "Play the build loop" })).toBeVisible();
  await showcase.getByRole("button", { name: "Business system" }).click();
  await expect(showcase.getByText("Sample build: Client portal")).toBeVisible();
  await expect(page.locator("#examples").getByRole("region", { name: "Sample websites" })).toBeVisible();
  await expect(page.locator("[data-services-book]")).toBeVisible();
  const order = await page.evaluate(() => ["#examples", "#services", "#approach"].map(id => document.querySelector(id)?.getBoundingClientRect().top));
  expect(order[0]!).toBeLessThan(order[1]!);
  expect(order[1]!).toBeLessThan(order[2]!);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("reduced motion and dark mode show the finished build, still", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => { localStorage.removeItem("veloce-motion"); localStorage.setItem("veloce-theme", "dark"); });
  await page.goto("/");
  const showcase = page.locator("[data-laptop-showcase]");
  await expect(showcase.getByText("Sample build: Advisory firm")).toBeVisible();
  await expect(showcase.getByRole("button", { name: /build loop|the lid/ })).toHaveCount(0);
  await showcase.getByRole("button", { name: "Online store" }).click();
  await expect(showcase.getByText("Sample build: Homeware store")).toBeVisible();
  const violations = (await new AxeBuilder({ page }).include("[data-laptop-showcase]").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations;
  expect(violations.filter(item => item.impact === "serious" || item.impact === "critical")).toEqual([]);
  expect(errors.filter(message => /hydrat|Encountered a script tag|unmount a root/i.test(message))).toEqual([]);
});

test("without JavaScript the hero shows the finished first sample", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 700 } });
  const page = await context.newPage();
  await page.goto("/?nojs=1");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Websites that work for your business");
  await expect(page.locator("[data-laptop-showcase]").getByRole("link", { name: "View the Advisory firm sample" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await context.close();
});
