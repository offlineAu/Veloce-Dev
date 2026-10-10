import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { TOKENS, resetFixtures, uniqueEmail } from "./helpers";

test.beforeEach(async () => {
  await resetFixtures();
});

function holdAction(page: Page, fail = false) {
  let release!: () => void;
  let requests = 0;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const ready = page.route("**/*", async (route) => {
    if (route.request().method() === "POST" && route.request().headers()["next-action"]) {
      requests++;
      await gate;
      if (fail) await route.abort();
      else await route.continue();
    } else await route.continue();
  });
  return { ready, release: () => release(), requests: () => requests };
}

async function openInquiry(page: Page) {
  await page.goto("/");
  await page.locator("[data-hero-cta]").click();
  const dialog = page.getByRole("dialog", { name: "Tell us about your project" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/^Name/).fill("Loader Test");
  await dialog.getByLabel(/^Email/).fill(uniqueEmail("loader"));
  await dialog.getByText("Website redesign", { exact: true }).click();
  await dialog.getByLabel(/What are you looking to build/).fill("Booking website");
  await dialog.getByLabel(/I agree that/).check();
  await page.waitForTimeout(1700); // Existing server minimum form-fill time.
  return dialog;
}

test("streams a branded home fallback, then replaces it without changing referral 404s", async ({ page }) => {
  const blocker = new Client({ connectionString: process.env.DATABASE_URL });
  await blocker.connect();
  try {
    await blocker.query("BEGIN");
    await blocker.query('LOCK TABLE "Company" IN ACCESS EXCLUSIVE MODE');
    await page.goto("/", { waitUntil: "commit" });
    const loader = page.locator('[data-pixel-loader="page"]');
    await expect(loader).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Loading…" })).toBeVisible();
    await expect(page.locator("main#main")).toBeVisible();
    // Check real CSS animations, not just animation-name: CSS modules must resolve keyframes.
    await page.emulateMedia({ reducedMotion: "no-preference" });
    // The loader's CSS-module stylesheet streams in just after the markup, so wait for the animation to attach.
    await expect.poll(() => loader.locator("rect").first().evaluate((tile) => tile.getAnimations().length)).toBe(1);
    const assembled = await loader.evaluate((svg) => {
      for (const animation of svg.getAnimations({ subtree: true })) {
        animation.pause();
        animation.currentTime = 700;
      }
      return [...svg.querySelectorAll("rect")].map((rect) => getComputedStyle(rect).opacity);
    });
    expect(assembled).toContain("0");
    expect(assembled).toContain("1");
    await loader.evaluate((svg) => {
      for (const animation of svg.getAnimations({ subtree: true })) animation.currentTime = 1500;
    });
    await expect(loader.locator("g").last()).toHaveCSS("opacity", "1");
    await blocker.query("ROLLBACK");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(loader).toHaveCount(0);
  } finally {
    await blocker.query("ROLLBACK");
    await blocker.end();
  }
  expect((await page.goto("/refer/not-a-real-token-1234"))?.status()).toBe(404);
});

test("inquiry loader respects motion preferences, inherits theme color, and clears on failure", async ({ page }) => {
  const dialog = await openInquiry(page);
  const action = holdAction(page, true);
  await action.ready;
  try {
    await dialog.getByRole("button", { name: "Send project inquiry" }).click();
    const loader = dialog.locator('[data-pixel-loader="compact"]');
    await expect(loader).toBeVisible();
    await expect(loader).toHaveAttribute("aria-hidden", "true");
    await expect(dialog.locator("form")).toHaveAttribute("aria-busy", "true");
    await expect(dialog.getByRole("button", { name: "Sending…" })).toBeDisabled();
    await expect(dialog.getByRole("status")).toHaveText("Sending…");
    expect(await dialog.getByRole("status").evaluate((status) => !!status.closest('[aria-busy="true"]'))).toBe(false);
    await expect.poll(() => action.requests()).toBe(1);

    await page.emulateMedia({ reducedMotion: "reduce" });
    const solid = loader.locator("g").last();
    await expect(solid).toHaveCSS("animation-name", "none");
    await expect(solid).toHaveCSS("opacity", "1");
    await expect(loader.locator("rect").first()).toHaveCSS("animation-name", "none");

    await page.evaluate(() => { document.documentElement.dataset.motion = "full"; });
    await expect(solid).not.toHaveCSS("animation-name", "none");
    await expect(solid).toHaveCSS("animation-duration", "2s");
    await page.evaluate(() => { delete document.documentElement.dataset.motion; });
    await expect(solid).toHaveCSS("opacity", "1");

    for (const theme of ["pistachio", "periwinkle", "ember"]) {
      await page.evaluate((theme) => { document.documentElement.dataset.theme = theme; }, theme);
      await expect.poll(() => loader.evaluate((svg) =>
        getComputedStyle(svg).color === getComputedStyle(svg.closest("button")!).color,
      )).toBe(true);
    }
    expect(await loader.evaluate((svg) => svg.getBoundingClientRect().width)).toBe(20);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    action.release();
    await expect(dialog.getByRole("alert").filter({ hasText: "not saved" })).toBeVisible();
    await expect(loader).toHaveCount(0);
    await expect(dialog.locator("form")).toHaveAttribute("aria-busy", "false");
    await expect(dialog.getByRole("button", { name: "Send project inquiry" })).toBeEnabled();
  } finally {
    action.release();
  }
});

test("introduction shows the compact loader and removes it on success", async ({ page }) => {
  await page.goto(`/refer/${TOKENS.active}`);
  await page.locator("[data-hero-cta]").click();
  const dialog = page.getByRole("dialog", { name: "Make an introduction" });
  await dialog.getByLabel(/^Your name/).fill("Alex Tester");
  await dialog.getByLabel(/^Your email/).fill(uniqueEmail("loader-referrer"));
  await dialog.getByLabel(/^Their name/).fill("Jamie Referred");
  await dialog.getByLabel(/^Their email/).fill(uniqueEmail("loader-referred"));
  await dialog.getByLabel(/^What are they looking for/).selectOption("REDESIGN");
  await dialog.getByLabel(/I have this person/).check();
  await page.waitForTimeout(1700);
  const action = holdAction(page);
  await action.ready;
  try {
    await dialog.getByRole("button", { name: "Send introduction" }).click();
    const loader = dialog.locator('[data-pixel-loader="compact"]');
    await expect(loader).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Sending…" })).toBeDisabled();
    await expect(dialog.getByRole("status")).toHaveText("Sending…");
    action.release();
    await expect(dialog.getByRole("heading", { name: "Introduction recorded" })).toBeVisible();
    await expect(loader).toHaveCount(0);
    expect(action.requests()).toBe(1);
  } finally {
    action.release();
  }
});
