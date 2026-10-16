import { expect, test, type Page } from "@playwright/test";

async function landingOffset(page: Page, id: string) {
  return page.locator(id).evaluate(el => Math.abs(el.getBoundingClientRect().top - parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop)));
}

for (const motion of ["full", "reduced"]) {
  test.describe(`navigation alignment with ${motion} motion`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => sessionStorage.setItem("veloce-booted", "1"));
      await page.goto("/?nav-check=1");
      await page.evaluate(value => { document.documentElement.dataset.motion = value; }, motion);
    });

    test("section and search jumps preserve query parameters and Back/Forward stops", async ({ page }) => {
      if ((page.viewportSize()?.width ?? 0) < 768) {
        await page.getByRole("button", { name: "Open menu", exact: true }).click();
        await page.getByRole("navigation", { name: "Mobile", exact: true }).getByRole("link", { name: "Services", exact: true }).click();
      } else {
        await page.locator("header").getByRole("link", { name: "Services", exact: true }).click();
      }
      await expect.poll(() => landingOffset(page, "#services")).toBeLessThan(2);
      await page.keyboard.press("ControlOrMeta+k");
      const dialog = page.getByRole("dialog", { name: "Search this site" });
      await dialog.getByRole("combobox").fill("booking");
      await dialog.getByRole("option", { name: /Booking systems/ }).click();
      await expect(dialog).toBeHidden();
      await expect(page).toHaveURL(/\?nav-check=1#capabilities$/);
      await expect.poll(() => landingOffset(page, "#capabilities")).toBeLessThan(2);
      await expect(page.locator('header a[href="#capabilities"]')).toHaveAttribute("aria-current", "location");
      await page.goBack();
      await expect(page).toHaveURL(/\?nav-check=1#services$/);
      await expect.poll(() => landingOffset(page, "#services")).toBeLessThan(2);
      await page.goForward();
      await expect(page).toHaveURL(/\?nav-check=1#capabilities$/);
      await expect.poll(() => landingOffset(page, "#capabilities")).toBeLessThan(2);
      await page.locator("#all-services").evaluate(el => el.scrollIntoView({ behavior: "instant" }));
      await expect(page.locator("header a[aria-current=location]")).toHaveCount(0);
    });

    test("book and list mode keep the toolbar in place", async ({ page }) => {
      const book = page.locator("[data-services-book]");
      const mode = book.getByRole("button", { name: "View all services", exact: true });
      await mode.scrollIntoViewIfNeeded();
      const original = await mode.evaluate(el => el.getBoundingClientRect().top);
      await mode.click();
      const returnToBook = book.getByRole("button", { name: "View service book", exact: true });
      await expect(returnToBook).toBeFocused();
      expect(Math.abs(await returnToBook.evaluate(el => el.getBoundingClientRect().top) - original)).toBeLessThan(2);
      await returnToBook.click();
      await expect(mode).toBeFocused();
      expect(Math.abs(await mode.evaluate(el => el.getBoundingClientRect().top) - original)).toBeLessThan(2);
    });

    test("approach switches reserve the same space and expose only the active panel", async ({ page }) => {
      const workbench = page.locator("[data-approach-workbench]");
      const geometry = () => workbench.evaluate(el => ({
        height: el.getBoundingClientRect().height,
        following: document.querySelector("#capabilities")!.getBoundingClientRect().top + scrollY,
      }));
      // Wait for web fonts before comparing text-driven layout.
      await page.evaluate(() => document.fonts.ready);
      const initial = await geometry();
      for (const name of [/Build it/, /Make it work/, /Think it/]) {
        await workbench.getByRole("tab", { name }).click();
        await expect(workbench.getByRole("tabpanel")).toHaveCount(1);
        await expect.poll(async () => Math.abs((await geometry()).height - initial.height)).toBeLessThan(2);
        expect(Math.abs((await geometry()).following - initial.following)).toBeLessThan(2);
      }
      // Reflow at another width must size from content again, without stale pixel heights.
      const viewport = page.viewportSize()!;
      await page.setViewportSize({ ...viewport, width: viewport.width - 40 });
      const resized = await geometry();
      for (const name of [/Build it/, /Make it work/, /Think it/]) {
        await workbench.getByRole("tab", { name }).click();
        await expect.poll(async () => Math.abs((await geometry()).height - resized.height)).toBeLessThan(2);
      }
    });
  });
}

test("internal route navigation keeps the document and Back restores an off-anchor viewport", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1024, "desktop header exposes the route link at every scroll position");
  await page.addInitScript(() => sessionStorage.setItem("veloce-booted", "1"));
  await page.goto("/");
  await page.locator("header").getByRole("link", { name: "Services", exact: true }).click();
  await expect.poll(() => landingOffset(page, "#services")).toBeLessThan(2);
  const previous = await page.evaluate(() => {
    document.documentElement.setAttribute("data-navigation-document", "original");
    window.scrollTo({ top: scrollY + 175, behavior: "instant" });
    return scrollY;
  });
  await page.locator("header").getByRole("link", { name: "About", exact: true }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.locator("html")).toHaveAttribute("data-navigation-document", "original");
  await page.goBack();
  await expect(page).toHaveURL(/\/#services$/);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(previous, 0);
});

test("returning from a meeting restores the visible invitation after a stage switch", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("veloce-booted", "1"));
  await page.goto("/");
  const workbench = page.locator("[data-approach-workbench]");
  await workbench.getByRole("tab", { name: /Build it/ }).click();
  const invitation = workbench.locator("[data-workbench-meeting]");
  await expect(invitation).toHaveCount(1);
  await invitation.click();
  await expect(page.locator("#veloce-meeting-title")).toBeFocused();
  await workbench.getByRole("tab", { name: /Make it work/ }).click();
  await page.getByRole("button", { name: "Back to example" }).click();
  await expect(invitation).toBeFocused();
  await expect(invitation).toBeVisible();
});

test("the nav highlight moves directly to a clicked destination and keeps its geometry in gaps", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1024, "desktop uses the sliding header highlight");
  await page.addInitScript(() => sessionStorage.setItem("veloce-booted", "1"));
  await page.goto("/");
  await page.evaluate(() => { document.documentElement.dataset.motion = "full"; });
  const header = page.locator("header");
  const highlight = header.locator("[data-nav-highlight]");
  await header.getByRole("link", { name: "Services", exact: true }).click();
  await expect.poll(() => landingOffset(page, "#services")).toBeLessThan(2);
  await header.getByRole("link", { name: "Offer", exact: true }).click();
  const samples = await highlight.evaluate(el => new Promise<{ x: number; width: number }[]>(resolve => {
    const result: { x: number; width: number }[] = [];
    const start = performance.now();
    const sample = () => {
      const box = el.getBoundingClientRect();
      result.push({ x: box.x, width: box.width });
      if (performance.now() - start < 1400) requestAnimationFrame(sample);
      else resolve(result);
    };
    sample();
  }));
  expect(Math.min(...samples.map(sample => sample.width))).toBeGreaterThan(50);
  for (let i = 1; i < samples.length; i++) expect(samples[i]!.x).toBeGreaterThanOrEqual(samples[i - 1]!.x - 1);
  const finalBox = await highlight.boundingBox();
  const targetBox = await header.getByRole("link", { name: "Offer", exact: true }).boundingBox();
  expect(Math.abs(finalBox!.x - targetBox!.x)).toBeLessThan(1);
  await page.locator("#all-services").evaluate(el => el.scrollIntoView({ behavior: "instant" }));
  await expect(highlight).toHaveCSS("opacity", "0");
  const hiddenBox = await highlight.boundingBox();
  expect(Math.abs(hiddenBox!.x - finalBox!.x)).toBeLessThan(1);
  expect(Math.abs(hiddenBox!.width - finalBox!.width)).toBeLessThan(1);
});
