import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("veloce-booted", "1"));
});

test("sample carousel opens previews and returns to the selected example", async ({ page }) => {
  await page.goto("/");
  const examples = page.locator("#examples");
  const carousel = examples.getByRole("region", { name: "Sample websites" });
  await expect(carousel).toBeVisible();
  // A click before hydration is lost, so select until the details column follows.
  await expect(async () => {
    await carousel.getByRole("button", { name: /Show slide .*Tattoo studio/ }).click();
    await expect(examples.getByRole("heading", { name: "Tattoo studio" })).toBeVisible({ timeout: 1000 });
  }).toPass();
  await examples.getByRole("link", { name: "View live preview" }).click();
  await expect(page).toHaveURL(/\/build\/preview\//);
  await page.getByRole("link", { name: /Back to/ }).first().click();
  await expect(page).toHaveURL(/sample=.*#examples/);
  await expect(page.locator("#examples").getByRole("heading", { name: "Tattoo studio" })).toBeVisible();
});

test("legacy sample links return to the selected example", async ({ page }) => {
  await page.goto("/?sample=5SehrWX_9G4mKjbiKebxSQ#services");
  await expect(page.locator("#examples").getByRole("heading", { name: "Tattoo studio" })).toBeVisible();
  await expect.poll(() => page.locator("#examples").evaluate(el => Math.abs(el.getBoundingClientRect().top - parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop)))).toBeLessThan(5);
});

test("search reveals the matching capabilities", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox", { name: "Search" }).fill("Admin dashboards");
  await page.getByRole("option", { name: /Admin dashboards/ }).click();
  await expect(page.locator("#capabilities details")).toHaveAttribute("open", "");
  await expect(page.locator("#capabilities").getByText("Admin dashboards", { exact: true })).toBeVisible();
});

test("meeting and example workflow remain accessible", async ({ page }) => {
  await page.goto("/");
  await page.locator("[data-hero-cta]").click();
  await expect(page.locator("#veloce-meeting-panel")).toBeVisible();
  await expect(page.locator("#veloce-meeting-title")).toBeFocused();
  await page.locator("#veloce-meeting-panel").getByRole("button", { name: "Return to page" }).click();
  await expect(page.locator("[data-hero-cta]")).toBeFocused();
  const disclosure = page.locator("#approach details");
  if (!await disclosure.evaluate(el => (el as HTMLDetailsElement).open)) await disclosure.locator("summary").click();
  await expect(page.locator("[data-approach-workbench]").getByRole("tab", { name: "Think it." })).toBeVisible();
});

test("old theme choices migrate before rendering and can be changed", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("veloce-theme", "ember"));
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await page.evaluate(() => localStorage.getItem("veloce-theme"))).toBe("dark");
  await page.getByRole("button", { name: "Change colour palette" }).click();
  await page.getByRole("radio", { name: /Light/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("builder offers a reachable preview and send action", async ({ page }) => {
  await page.goto("/build?template=business");
  const send = page.getByRole("button", { name: "Send design", exact: true });
  await expect(send).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  if ((page.viewportSize()?.width ?? 0) < 1024) await page.getByText("Tools", { exact: true }).click();
  else await page.getByText("More", { exact: true }).click();
  await page.getByRole("button", { name: "Import HTML" }).click();
  await expect(page.getByRole("dialog", { name: "Import HTML" })).toBeVisible();
  await page.keyboard.press("Escape");
  await send.click();
  await expect(page.getByRole("dialog", { name: "Send us your design" })).toBeVisible();
});

test("editor theme changes do not recolor the authored site", async ({ page }) => {
  await page.goto("/build?template=business");
  const frame = page.frameLocator("iframe").first();
  await expect(frame.getByRole("heading", { name: "Your business, explained in one line" })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("iframe#preview-frame")).toHaveAttribute("title", "Website design preview");
  const before = await frame.locator("body").evaluate(el => getComputedStyle(el).backgroundColor);
  await page.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
  await expect.poll(() => frame.locator("body").evaluate(el => getComputedStyle(el).backgroundColor)).toBe(before);
});

test("marketing navigation and content have no serious accessibility violations", async ({ page }) => {
  await page.goto("/");
  const violations = (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations;
  expect(violations.filter(v => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
