import { expect, test, type Page } from "@playwright/test";

const loader = (page: Page) => page.locator("[data-boot-loader]");
const percent = async (page: Page) => Number(await page.getByRole("progressbar").getAttribute("aria-valuenow"));

test("builds the logo in step with the percentage, reaches 100% and leaves", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    // "fading" only lasts the 350ms fade, which polling can miss: record the tiles at the moment the phase changes.
    const w = window as unknown as { __bootFade?: { lit: number; total: number } };
    new MutationObserver(() => {
      const el = document.querySelector("[data-boot-loader]");
      if (!el || w.__bootFade || el.getAttribute("data-boot-phase") !== "fading") return;
      const rects = [...el.querySelectorAll("rect")];
      w.__bootFade = { lit: rects.filter((t) => getComputedStyle(t).opacity === "1").length, total: rects.length };
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-boot-phase"] });
  });
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
  const fade = () => page.evaluate(() => (window as unknown as { __bootFade?: { lit: number; total: number } }).__bootFade ?? null);
  await expect.poll(fade, { timeout: 10_000 }).not.toBeNull();
  const { lit, total } = (await fade())!;
  expect(lit).toBe(total); // fully built at 100%
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
  await page.addInitScript(() => {
    localStorage.setItem("veloce-motion", "reduced");
    // The server renders the full loader (it cannot know the choice); after hydration it switches to "reduced" and, if the
    // page has already loaded, leaves in the same frame. Record each mode the loader shows so a short-lived state is not missed.
    const seen: { mode: string | null; rects: number }[] = ((window as unknown as { __bootModes: typeof seen }).__bootModes = []);
    new MutationObserver(() => {
      const el = document.querySelector("[data-boot-loader]");
      if (el) seen.push({ mode: el.getAttribute("data-boot-mode"), rects: el.querySelectorAll("rect").length });
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-boot-mode"] });
  });
  await page.goto("/", { waitUntil: "commit" });
  const seen = () => page.evaluate(() => (window as unknown as { __bootModes: { mode: string | null; rects: number }[] }).__bootModes);
  await expect.poll(async () => (await seen()).some((s) => s.mode === "reduced"), { timeout: 20_000 }).toBe(true);
  expect((await seen()).filter((s) => s.mode === "reduced").every((s) => s.rects === 0)).toBe(true); // finished mark only, no tiles
  await expect(loader(page)).toHaveCount(0, { timeout: 10_000 });
});

test("Always play beats a device that asks for reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("veloce-motion", "full"));
  await page.goto("/", { waitUntil: "commit" });
  await expect(loader(page)).toHaveAttribute("data-boot-mode", "full");
});
