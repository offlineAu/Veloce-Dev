import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { query, resetFixtures, uniqueEmail } from "./helpers";

test.beforeEach(async ({ page }) => {
  await resetFixtures();
  await page.addInitScript(() => { try { sessionStorage.setItem("veloce-booted", "1"); } catch {} });
});

const canvas = (page: Page) => page.frameLocator("iframe").first();

/** Opens a fresh builder (no saved draft) on the blank template. */
async function openBlank(page: Page) {
  await page.goto("/build?template=blank");
  await expect(page.getByRole("button", { name: "Send design" })).toBeVisible({ timeout: 30_000 });
}

/** Drags a block from the left drawer into the top of the canvas, with pointer moves the drag library recognises. */
async function dragBlock(page: Page, name: string) {
  const item = page.getByText(name, { exact: true }).first();
  await item.scrollIntoViewIfNeeded();
  const from = (await item.boundingBox())!;
  const frame = (await page.locator("iframe").first().boundingBox())!;
  const start = { x: from.x + 20, y: from.y + 10 };
  const end = { x: frame.x + frame.width / 2, y: frame.y + 30 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.waitForTimeout(300);
  for (let i = 1; i <= 30; i++) {
    await page.mouse.move(start.x + ((end.x - start.x) * i) / 30, start.y + ((end.y - start.y) * i) / 30);
    await page.waitForTimeout(15);
  }
  await page.mouse.move(end.x + 5, end.y + 5);
  await page.waitForTimeout(400);
  await page.mouse.up();
}

test.describe("what we offer: site builder guide", () => {
  test("home page explains the builder and opens it", async ({ page }) => {
    await page.goto("/");
    const guide = page.locator("[data-builder-guide]");
    await expect(guide.getByRole("heading", { name: /Design it yourself/ })).toBeVisible();
    await expect(guide.getByRole("list", { name: "How it works" }).getByRole("listitem")).toHaveCount(4);
    await expect(guide.getByRole("link", { name: "Restaurant" })).toHaveAttribute("href", "/build?template=restaurant");
    await guide.getByRole("link", { name: /Open the builder/ }).click();
    await expect(page).toHaveURL(/\/build$/);
    await expect(page.getByRole("heading", { name: "Choose a starting point" })).toBeVisible({ timeout: 30_000 });
  });
});

test.describe("site builder", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1200, "The drag-and-drop editor is tested on desktop.");

  test("template deep link loads that template, and the editor has no site chrome", async ({ page }) => {
    await page.goto("/build?template=saas");
    await expect(canvas(page).getByRole("heading", { name: "The simplest way to run your bookings" })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("[data-boot-loader]")).toHaveCount(0);
    await expect(page.locator(".scroll-progress")).toHaveCount(0);
  });

  test("drag a block in, and the draft survives a reload", async ({ page }) => {
    await openBlank(page);
    await dragBlock(page, "Heading");
    await expect(canvas(page).getByRole("heading", { name: "A clear, confident heading" })).toBeVisible();
    await page.waitForTimeout(1200); // autosave is debounced
    await page.goto("/build");
    await expect(canvas(page).getByRole("heading", { name: "A clear, confident heading" })).toBeVisible({ timeout: 30_000 });
  });

  test("a saved draft is never replaced by a template link without asking", async ({ page }) => {
    await openBlank(page);
    await dragBlock(page, "Heading");
    await page.waitForTimeout(1200);
    await page.goto("/build?template=restaurant");
    const picker = page.getByRole("dialog");
    await expect(picker.getByText(/Replace your current site|Choose a starting point/).first()).toBeVisible({ timeout: 30_000 });
    await expect(canvas(page).getByRole("heading", { name: "A clear, confident heading" })).toBeAttached();
  });

  test("imported HTML is sandboxed: scripts never reach the editor", async ({ page }) => {
    await openBlank(page);
    await page.getByRole("button", { name: "Import HTML" }).click();
    await page.getByRole("dialog").getByLabel("HTML").fill(
      `<h3 id="imported">Imported block</h3><img src="x" onerror="parent.parent.__pwned=1"><script>parent.parent.__pwned=1</script>`,
    );
    await page.getByRole("button", { name: "Add to page" }).click();
    const inner = canvas(page).frameLocator('iframe[title="Imported HTML"]');
    await expect(inner.locator("#imported")).toHaveText("Imported block");
    expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
  });

  test("send design: the inquiry carries the page, and the team preview renders it", async ({ page }) => {
    const email = uniqueEmail("builder");
    await page.goto("/build?template=business");
    await expect(canvas(page).getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Send design" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Send us your design" })).toBeVisible();
    await expect(dialog).toContainText("Your design (1 page, 5 sections) will be attached.");
    await dialog.getByLabel(/^Name/).fill("Builder Person");
    await dialog.getByLabel(/^Email/).fill(email);
    await dialog.getByLabel(/What are you looking to build/).fill("A site like this design");
    await dialog.getByLabel(/I agree that/).check();
    await page.waitForTimeout(1700); // above the minimum fill time used against bots
    await dialog.getByRole("button", { name: "Send project inquiry" }).click();
    await expect(dialog.getByRole("heading", { name: "Inquiry received" })).toBeVisible();

    const rows = await query<{ token: string; templateId: string; projectType: string; websiteType: string }>(
      `SELECT d.token, d."templateId", l."projectType", l."websiteType" FROM "Lead" l JOIN "SiteDraft" d ON d."leadId"=l.id WHERE l.email=$1`,
      [email],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ templateId: "business", projectType: "NEW_PROJECT", websiteType: "BUSINESS" });

    await page.goto(`/build/preview/${rows[0]!.token}`);
    await expect(page.getByRole("heading", { level: 1, name: "Your business, explained in one line" })).toBeVisible();
    expect((await page.goto("/build/preview/not-a-real-token-000000"))?.status()).toBe(404);
  });

  test("designer template: every page, its own fonts and colours, and nothing loaded from other sites", async ({ page }) => {
    const external: string[] = [];
    page.on("request", (r) => {
      const host = new URL(r.url()).hostname;
      if (r.url().startsWith("http") && host !== "localhost" && host !== "127.0.0.1") external.push(r.url());
    });
    await page.goto("/build?template=noir-needle");
    const h1 = canvas(page).getByRole("heading", { level: 1 }).first();
    await expect(h1).toContainText("PERMANENCE", { timeout: 30_000 });
    await expect(page.getByRole("navigation", { name: "Pages" }).locator("li")).toHaveCount(4);
    expect(await h1.evaluate((e) => getComputedStyle(e).fontFamily)).toContain("Playfair Display");
    // The page frame is the design's dark surface.
    const bg = await canvas(page).locator("[data-vt=noir-needle] > div").first().evaluate((e) => getComputedStyle(e).backgroundColor);
    expect(bg).toBe("rgb(20, 19, 18)");
    await page.waitForLoadState("networkidle");
    expect(external).toEqual([]);
  });

  test("designer template: edit text, add a card, and native blocks take on the template's theme", async ({ page }) => {
    await page.goto("/build?template=noir-needle");
    const frame = canvas(page);
    await frame.getByRole("heading", { level: 1 }).first().click({ timeout: 30_000 });
    await page.getByRole("textbox", { name: "Heading", exact: true }).fill("ARTISTRY");
    await expect(frame.getByRole("heading", { level: 1 }).first()).toContainText("ARTISTRY");

    await frame.getByText("Selected Permanent Archives").click();
    const cards = frame.getByText(/view piece dossier/i);
    const before = await cards.count();
    await page.locator('[class*="ArrayField-addButton"]').last().click();
    await expect(cards).toHaveCount(before + 1);

    await dragBlock(page, "Pricing table");
    const plan = frame.getByRole("heading", { name: "Simple pricing" });
    await expect(plan).toBeVisible();
    const section = plan.locator("xpath=ancestor::section[1]");
    expect(await section.evaluate((e) => getComputedStyle(e).backgroundColor)).not.toBe("rgb(255, 255, 255)");
    expect(await plan.evaluate((e) => getComputedStyle(e).fontFamily)).toContain("Playfair Display");
  });

  test("designer template: in preview, links between pages switch pages", async ({ page }) => {
    await page.goto("/build?template=noir-needle");
    await expect(canvas(page).getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Preview" }).click();
    await canvas(page).getByRole("link", { name: "Resident Artists" }).first().click();
    await expect(page.getByRole("navigation", { name: "Pages" }).locator('[aria-current="page"]')).toContainText("Resident Artists");
    await expect(page.getByRole("button", { name: "Edit" })).toBeVisible(); // still previewing after the switch
  });

  test("designer template: the whole site is sent, and the team preview has every page", async ({ page }) => {
    const email = uniqueEmail("tpl");
    await page.goto("/build?template=noir-needle");
    await expect(canvas(page).getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Send design" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(/Your design \(4 pages, \d+ sections\)/);
    await dialog.getByLabel(/^Name/).fill("Studio Owner");
    await dialog.getByLabel(/^Email/).fill(email);
    await dialog.getByLabel(/What are you looking to build/).fill("This, for my studio");
    await dialog.getByLabel(/I agree that/).check();
    await page.waitForTimeout(1700);
    await dialog.getByRole("button", { name: "Send project inquiry" }).click();
    await expect(dialog.getByRole("heading", { name: "Inquiry received" })).toBeVisible();

    const [row] = await query<{ token: string; templateId: string }>(`SELECT d.token, d."templateId" FROM "Lead" l JOIN "SiteDraft" d ON d."leadId"=l.id WHERE l.email=$1`, [email]);
    expect(row?.templateId).toBe("noir-needle@v1");
    await page.goto(`/build/preview/${row!.token}`);
    await expect(page.getByRole("heading", { level: 1 }).first()).toContainText("PERMANENCE");
    await page.getByRole("navigation", { name: "Pages in this design" }).getByRole("link", { name: "Resident Artists" }).click();
    await expect(page).toHaveURL(/page=%2Fresident-artists/);
    await expect(page.getByRole("navigation", { name: "Pages in this design" }).locator('[aria-current="page"]')).toHaveText("Resident Artists");
  });

  test("reviewing an imported template shows its report and a section checklist", async ({ page }) => {
    await page.goto("/build?template=noir-needle&review=1");
    const review = page.getByRole("region", { name: "Template review" });
    await expect(review).toContainText("Reviewing noir-needle v1", { timeout: 30_000 });
    await review.getByRole("button", { name: /Show report/ }).click();
    await expect(review).toContainText("Import report: Tattoo studio v1");
    await review.getByRole("checkbox").first().check();
    await expect(review).toContainText(/Checked 1 of \d+ sections/);
  });

  test("template picker has no axe violations", async ({ page }) => {
    await page.goto("/build");
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Choose a starting point" })).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(800);
    const r = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(r.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);
  });
});
