import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { query, resetFixtures } from "./helpers";

/*
 * Developer template uploads on the site. Needs the dev server running with TEMPLATE_UPLOAD_PASSWORD_HASH and
 * DEV_SESSION_SECRET set, and the matching password in E2E_DEV_TEMPLATE_PASSWORD; skipped otherwise.
 */
const PASSWORD = process.env.E2E_DEV_TEMPLATE_PASSWORD;
const SLUG = "e2e-upload";
const FIXTURE = path.join(__dirname, "../fixtures/stitch-mini/mini_studio_home/code.html");

test.skip(!PASSWORD, "Set E2E_DEV_TEMPLATE_PASSWORD to the developer password to run these.");
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1200, "The developer panel is tested on desktop.");

test.beforeEach(async ({ page }) => {
  await resetFixtures();
  await query(`DELETE FROM "BuilderTemplate" WHERE slug LIKE 'e2e-%'`);
  await page.addInitScript(() => { try { sessionStorage.setItem("veloce-booted", "1"); } catch {} });
});
test.afterAll(async () => {
  await query(`DELETE FROM "BuilderTemplate" WHERE slug LIKE 'e2e-%'`);
});

async function openPanel(page: Page) {
  await page.goto("/");
  await page.keyboard.press("Control+Shift+Alt+KeyT");
  const panel = page.getByRole("dialog", { name: "Developer: templates" });
  await expect(panel).toBeVisible({ timeout: 20_000 });
  return panel;
}

async function unlock(page: Page) {
  const panel = await openPanel(page);
  await panel.getByLabel("Your name").fill("E2E");
  await panel.getByLabel("Developer password").fill(PASSWORD!);
  await panel.getByRole("button", { name: "Unlock" }).click();
  await expect(panel.getByText("Signed in as")).toBeVisible();
  return panel;
}

test("the secret shortcut opens the panel, and a wrong password is refused", async ({ page }) => {
  const panel = await openPanel(page);
  await panel.getByLabel("Your name").fill("E2E");
  await panel.getByLabel("Developer password").fill("definitely-wrong");
  await panel.getByRole("button", { name: "Unlock" }).click();
  await expect(panel.getByRole("alert")).toHaveText("That password isn't right.");
  const r = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);
});

test("upload → theme colours → review → publish, and visitors only see it once published", async ({ page, browser }) => {
  const panel = await unlock(page);
  await panel.getByLabel("Template name").fill("E2E upload");
  await panel.getByLabel(/^Slug/).fill(SLUG);
  await panel.getByLabel("Add HTML pages").setInputFiles(FIXTURE);
  await panel.getByRole("button", { name: /Upload as draft/ }).click();
  await expect(panel.getByText(/was saved as a draft/)).toBeVisible({ timeout: 90_000 });

  await panel.getByLabel("Accent (buttons, highlights)").selectOption({ index: 1 });
  await panel.getByRole("button", { name: "Save colours" }).click();
  await expect(page.getByText("Theme colours saved.")).toBeVisible();

  // A visitor can't see or load the draft.
  const visitor = await browser.newPage();
  expect((await visitor.request.get(`/build/t/${SLUG}/v1/template.json`)).status()).toBe(404);

  await panel.getByRole("link", { name: /Open review/ }).click();
  const review = page.getByRole("region", { name: "Template review" });
  await expect(review).toContainText(`Reviewing ${SLUG} v1`, { timeout: 30_000 });
  await expect(page.frameLocator("iframe").first().getByRole("heading", { level: 1 })).toContainText("Ink", { timeout: 30_000 });
  await review.getByRole("button", { name: "Publish" }).click();
  await expect(review).toContainText("Published");

  // Now visitors see it in the picker, and its files are cacheable.
  await visitor.goto("/build");
  await expect(visitor.getByRole("dialog").getByRole("button", { name: /E2E upload/ })).toBeVisible({ timeout: 30_000 });
  const pkg = await visitor.request.get(`/build/t/${SLUG}/v1/template.json`);
  expect(pkg.status()).toBe(200);
  expect(pkg.headers()["cache-control"]).toContain("immutable");
  await visitor.close();
});

test("without a session the upload API refuses", async ({ request }) => {
  const res = await request.post("/api/dev/templates", { multipart: { name: "x" } });
  expect(res.status()).toBe(401);
});
