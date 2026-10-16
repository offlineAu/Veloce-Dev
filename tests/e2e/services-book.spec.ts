import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("the book centers its cover and open spread, and finishes turns before queued navigation", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => { document.documentElement.dataset.motion = "full"; });
  const book = page.locator("[data-services-book]");
  const stage = book.locator("[data-cover-phase]");
  const cover = book.locator("[data-book-cover]");
  const spread = book.locator('[id$="-page"]');
  const sheet = book.locator("[data-page-turn]");
  const pagePosition = () => spread.evaluate(element => element.getBoundingClientRect().left - element.closest("[data-services-book]")!.getBoundingClientRect().left);
  const centerOffset = (target: typeof cover) => target.evaluate(element => {
    const box = element.getBoundingClientRect();
    const stage = element.closest("[data-cover-phase]")!.getBoundingClientRect();
    return box.left + box.width / 2 - stage.left - stage.width / 2;
  });
  await expect.poll(async () => Math.abs(await centerOffset(cover))).toBeLessThan(1);
  const initialPosition = await pagePosition();

  await book.getByRole("button", { name: "Open service book", exact: true }).click();
  await expect(stage).toHaveAttribute("data-cover-phase", "opening");
  await expect(sheet).toHaveCount(0);
  await expect(cover).toHaveCSS("opacity", "1");
  await expect(stage).toHaveAttribute("data-cover-phase", "open");
  await expect.poll(async () => Math.abs(await centerOffset(spread))).toBeLessThan(1);
  const openPosition = await pagePosition();
  if ((page.viewportSize()?.width ?? 0) > 600) expect(openPosition).toBeGreaterThan(initialPosition);
  else expect(openPosition).toBeCloseTo(initialPosition, 0);

  await book.getByRole("button", { name: "Next service", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(sheet).toHaveCount(1);
  const firstTurn = await sheet.getAttribute("data-page-turn");
  await page.keyboard.press("ArrowRight");
  // A second click is accepted without replacing the sheet already in flight.
  await expect(sheet).toHaveAttribute("data-page-turn", firstTurn!);
  await expect(book.getByRole("heading", { name: "Customer-facing web applications", exact: true })).toBeVisible();
  await expect(book.getByRole("heading", { name: "Internal business systems", exact: true })).toBeVisible();
  await expect(sheet).toHaveCount(0);
  expect(await pagePosition()).toBeCloseTo(openPosition, 0);

  await book.getByRole("button", { name: "Close book", exact: true }).click();
  await expect(stage).toHaveAttribute("data-cover-phase", "closing");
  await expect(sheet).toHaveCount(0);
  await expect(spread).toHaveCSS("display", "grid");
  await expect(spread.locator('article[aria-labelledby$="-title"] h3')).toHaveText("Internal business systems");
  await expect(cover).toHaveCSS("opacity", "1");
  await expect(stage).toHaveAttribute("data-cover-phase", "closed");
  await expect.poll(async () => Math.abs(await centerOffset(cover))).toBeLessThan(1);
  expect(await pagePosition()).toBeCloseTo(initialPosition, 0);
  await expect(book.getByRole("button", { name: "Open service book", exact: true })).toBeFocused();
});

test("cover and page surfaces stay clickable across their area and during page turns", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => { document.documentElement.dataset.motion = "full"; });
  const book = page.locator("[data-services-book]");
  const cover = book.getByRole("button", { name: "Open service book", exact: true });
  await cover.scrollIntoViewIfNeeded();
  // Verify actual browser hit targets across the cover, including artwork and footer.
  expect(await cover.evaluate((button) => {
    const box = button.getBoundingClientRect();
    return [.1, .3, .5, .7, .9].flatMap(y => [.1, .3, .5, .7, .9].filter(x =>
      document.elementFromPoint(box.x + box.width * x, box.y + box.height * y)?.closest("button") !== button,
    ).map(x => ({ x, y })));
  })).toEqual([]);
  await cover.click({ position: { x: 20, y: 20 } });
  const next = book.getByRole("button", { name: "Turn to next service", exact: true });
  await next.scrollIntoViewIfNeeded();
  expect(await next.evaluate((button) => {
    const box = button.getBoundingClientRect();
    return [.1, .3, .5, .7, .9].flatMap(y => [.1, .3, .5, .7, .9].filter(x => {
      const target = document.elementFromPoint(box.x + box.width * x, box.y + box.height * y);
      return !target?.closest("button, a");
    }).map(x => ({ x, y })));
  })).toEqual([]);
  const corner = await next.boundingBox();
  // These physical clicks happen before the 1.3-second decorative flip finishes.
  await page.mouse.click(corner!.x + 15, corner!.y + 15);
  await expect(book.getByRole("heading", { name: "Customer-facing web applications", exact: true })).toBeVisible();
  await page.mouse.click(corner!.x + 15, corner!.y + 15);
  await expect(book.getByRole("heading", { name: "Internal business systems", exact: true })).toBeVisible();
});

test("service book supports direct selection, navigation, inquiry and list mode", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  // Explicit motion choice makes cover behavior deterministic on low-power machines.
  await page.evaluate(() => { document.documentElement.dataset.motion = "full"; });
  const book = page.locator("[data-services-book]");
  await expect(book.getByRole("heading", { name: /Explore every service/ })).toBeVisible();
  await expect(book.getByRole("link", { name: "Explore this service" })).toHaveCount(0);
  expect((await new AxeBuilder({ page }).include("[data-services-book]").analyze()).violations).toEqual([]);
  // The cover illustration is part of the opening target, outside the visible pill.
  await book.getByRole("heading", { name: /Explore every service/ }).scrollIntoViewIfNeeded();
  const coverTitle = await book.getByRole("heading", { name: /Explore every service/ }).boundingBox();
  await page.mouse.click(coverTitle!.x + 20, coverTitle!.y + 20);
  await expect(book.getByRole("heading", { name: "Business websites", exact: true })).toBeVisible();
  await expect(book.getByRole("button", { name: "Previous service", exact: true })).toBeDisabled();
  // Text and empty page space turn pages through the full-surface buttons.
  await book.getByRole("heading", { name: "Business websites", exact: true }).scrollIntoViewIfNeeded();
  const pageTitle = await book.getByRole("heading", { name: "Business websites", exact: true }).boundingBox();
  await page.mouse.click(pageTitle!.x + 20, pageTitle!.y + 20);
  await expect(book.getByRole("heading", { name: "Customer-facing web applications" })).toBeVisible();
  if ((page.viewportSize()?.width ?? 0) > 600) {
    await book.getByRole("button", { name: "Turn to previous service" }).click({ position: { x: 25, y: 60 } });
  } else {
    await book.getByRole("button", { name: "Previous service", exact: true }).click();
  }
  await expect(book.getByRole("heading", { name: "Business websites", exact: true })).toBeVisible();
  await book.getByRole("button", { name: "Next service", exact: true }).click();
  await expect(book.getByRole("heading", { name: "Customer-facing web applications" })).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(book.getByRole("heading", { name: "Business websites", exact: true })).toBeVisible();
  await book.getByRole("link", { name: "Explore this service" }).click();
  await expect(page).toHaveURL(/\/services\/business-websites$/);
  await page.goBack();
  if ((page.viewportSize()?.width ?? 0) <= 600) await book.getByLabel("Choose a service").selectOption("8");
  else await book.getByRole("button", { name: /09 Ongoing development and support/ }).click();
  await expect(book.getByRole("button", { name: "Next service", exact: true })).toBeDisabled();
  await expect(book.getByRole("button", { name: "Turn to next service" })).toBeDisabled();
  await book.getByRole("button", { name: "Ask about Ongoing development and support" }).click();
  const dialog = page.getByRole("dialog", { name: "Ask about Ongoing development and support" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(book.getByRole("heading", { name: "Ongoing development and support", exact: true })).toBeVisible();
  await book.getByRole("button", { name: "Close book", exact: true }).click();
  await expect(book.getByRole("button", { name: "Open service book" })).toBeFocused();
  await book.getByRole("button", { name: "View all services" }).click();
  await expect(book.locator("[data-services-explorer]").getByRole("heading", { name: "Business websites" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("static service book remains readable, accessible and within its container", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const book = page.locator("[data-services-book]");
  await expect(book.getByRole("heading", { name: "Business websites", exact: true })).toBeVisible();
  await expect(book.getByRole("button", { name: "Open service book" })).toHaveCount(0);
  await book.getByRole("button", { name: "Next service", exact: true }).click();
  await expect(book.getByRole("heading", { name: "Customer-facing web applications" })).toBeVisible();
  const bounds = await book.evaluate((element) => {
    const root = element.getBoundingClientRect();
    const spread = element.querySelector('[id$="-page"]')!.getBoundingClientRect();
    return { left: spread.left - root.left, right: root.right - spread.right, overflow: element.scrollWidth - element.clientWidth };
  });
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeGreaterThanOrEqual(0);
  expect(bounds.overflow).toBe(0);
  expect((await new AxeBuilder({ page }).include("[data-services-book]").analyze()).violations).toEqual([]);
});

test("services remain readable without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/");
  const book = page.locator("[data-services-book]");
  await expect(book.getByRole("heading", { name: "Business websites", exact: true })).toBeVisible();
  await expect(book.locator("noscript p").filter({ hasText: "Websites that present your business clearly" })).toBeVisible();
  await expect(book.getByRole("link", { name: "Explore this service" }).first()).toHaveAttribute("href", "/services/business-websites");
  await context.close();
});
