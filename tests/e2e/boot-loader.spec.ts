import { expect, test, type Page } from "@playwright/test";

const loader = (page: Page) => page.locator("[data-boot-loader]");
const percent = async (page: Page) => Number(await page.getByRole("progressbar").getAttribute("aria-valuenow"));

test("builds the logo in step with the percentage, reaches 100% and leaves", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/", { waitUntil: "commit" });
  await expect(loader(page)).toBeVisible();
  await expect(loader(page)).toHaveAttribute("data-boot-mode", "full");
  const box = await page.getByRole("progressbar").boundingBox();
  const view = page.viewportSize()!;
  expect(Math.abs(box!.x + box!.width / 2 - view.width / 2)).toBeLessThan(2); // centred horizontally
  expect(Math.abs(box!.y + box!.height / 2 - view.height / 2)).toBeLessThan(view.height * 0.1); // and vertically

  const litTiles = () => loader(page).locator("rect").evaluateAll((r) => r.filter((t) => getComputedStyle(t).opacity === "1").length);
  await expect.poll(() => percent(page), { timeout: 10_000 }).toBeGreaterThan(20);
  const early = await litTiles();
  await expect.poll(litTiles, { timeout: 10_000 }).toBeGreaterThan(early);
  await expect(loader(page)).toHaveAttribute("data-boot-phase", "fading", { timeout: 10_000 });
  expect(await litTiles()).toBe(await loader(page).locator("rect").count()); // fully built at 100%
  await expect(loader(page)).toHaveCount(0);
  await expect(page.locator("main#main")).toBeVisible();
});

test("is shown once per session", async ({ page }) => {
  await page.goto("/");
  await expect(loader(page)).toHaveCount(0, { timeout: 10_000 });
  await page.reload();
  await expect(loader(page)).toBeHidden();
});

test("Reduce animations: finished mark, no tiles, no fade, leaves once loaded", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("veloce-motion", "reduced"));
  await page.goto("/", { waitUntil: "commit" });
  await expect(loader(page)).toHaveAttribute("data-boot-mode", "reduced");
  expect(await loader(page).locator("rect").count()).toBe(0);
  await expect(loader(page)).toHaveCount(0, { timeout: 10_000 });
});

test("Always play beats a device that asks for reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("veloce-motion", "full"));
  await page.goto("/", { waitUntil: "commit" });
  await expect(loader(page)).toHaveAttribute("data-boot-mode", "full");
});
