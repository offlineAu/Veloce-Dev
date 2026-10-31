import { existsSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { query, resetFixtures, uniqueEmail } from "./helpers";

test.beforeEach(async ({ page }) => {
  await resetFixtures();
  await page.addInitScript(() => { try { sessionStorage.setItem("veloce-booted", "1"); } catch {} });
});

const canvas = (page: Page) => page.frameLocator("iframe").first();
/** Text on the page itself: inside the template's design pieces, not the selected block's toolbar (which shows its name). */
const onPage = (page: Page, text: string | RegExp) => canvas(page).locator("[data-piece]").getByText(text, typeof text === "string" ? { exact: true } : undefined);

/** Opens a fresh builder (no saved draft) on the blank template. */
async function openBlank(page: Page) {
  await page.goto("/build?template=blank");
  await expect(page.getByRole("button", { name: "Send design" })).toBeVisible({ timeout: 30_000 });
}

/**
 * Drags a block from the left drawer onto the canvas (by default near its top; `y` is from the canvas top), with
 * pointer moves the drag library recognises. `name` is the block's label, or a drawer item locator.
 */
async function dragBlock(page: Page, name: string | Locator, y = 30) {
  const item = typeof name === "string" ? page.getByText(name, { exact: true }).first() : name;
  await item.scrollIntoViewIfNeeded();
  const from = (await item.boundingBox())!;
  const frame = (await page.locator("iframe").first().boundingBox())!;
  const start = { x: from.x + 20, y: from.y + 10 };
  const end = { x: frame.x + frame.width / 2, y: frame.y + y };
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
    await page.getByText((page.viewportSize()?.width ?? 0) < 1024 ? "Tools" : "More", { exact: true }).click();
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
    await expect(dialog).toContainText("Your design (1 page, 5 sections) will be uploaded with your inquiry.");
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
    // Template parts are draggable pieces in the editor, so the heading is found by its tag (Puck labels it a draggable).
    const h1 = canvas(page).locator("h1").first();
    await expect(h1).toContainText("PERMANENCE", { timeout: 30_000 });
    await expect(page.getByRole("navigation", { name: "Pages" }).locator("li")).toHaveCount(4);
    expect(await h1.evaluate((e) => getComputedStyle(e).fontFamily)).toContain("Playfair Display");
    // The page frame is the design's dark surface.
    const bg = await canvas(page).locator("[data-vt=noir-needle] > div").first().evaluate((e) => getComputedStyle(e).backgroundColor);
    expect(bg).toBe("rgb(20, 19, 18)");
    // Give late requests (fonts, images) a moment. ("networkidle" never settles with the editor's canvas iframe.)
    await page.waitForTimeout(2000);
    expect(external).toEqual([]);
  });

  test("designer template: every part is a piece to edit, duplicate or move, and native blocks take on the template's theme", async ({ page }) => {
    await page.goto("/build?template=noir-needle");
    const frame = canvas(page);
    // A template heading is its own piece: selected straight away, no "Edit layout" step.
    await onPage(page, "Selected Permanent Archives").click({ timeout: 30_000 });
    await page.getByRole("textbox", { name: "Text", exact: true }).filter({ visible: true }).fill("Our work");
    await expect(onPage(page, "Our work")).toBeVisible();

    const links = onPage(page, /view piece dossier/i);
    const before = await links.count();
    await links.first().click();
    // The piece's action bar is drawn inside the canvas.
    await frame.getByRole("button", { name: "Duplicate" }).filter({ visible: true }).click();
    await expect(links).toHaveCount(before + 1);

    await dragBlock(page, "Pricing table");
    const plan = frame.getByRole("heading", { name: "Simple pricing" });
    await expect(plan).toBeVisible();
    const section = plan.locator("xpath=ancestor::section[1]");
    expect(await section.evaluate((e) => getComputedStyle(e).backgroundColor)).not.toBe("rgb(255, 255, 255)");
    expect(await plan.evaluate((e) => getComputedStyle(e).fontFamily)).toContain("Playfair Display");
  });

  test("designer template: in preview, links between pages switch pages", async ({ page }) => {
    await page.goto("/build?template=noir-needle");
    await expect(canvas(page).locator("h1").first()).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Preview" }).click();
    await canvas(page).getByRole("link", { name: "Resident Artists" }).first().click();
    await expect(page.getByRole("navigation", { name: "Pages" }).locator('[aria-current="page"]')).toContainText("Resident Artists");
    await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible(); // still previewing after the switch
  });

  test("designer template: the whole site is sent, and the team preview has every page", async ({ page }) => {
    const email = uniqueEmail("tpl");
    await page.goto("/build?template=noir-needle");
    await expect(canvas(page).locator("h1").first()).toBeVisible({ timeout: 30_000 });
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

  test("style a template piece with plain controls and new classes, and the team preview matches", async ({ page }) => {
    const email = uniqueEmail("style");
    await page.goto("/build?template=noir-needle");
    const frame = canvas(page);

    // A piece of its own from the start: plain controls change its classes, using the design's scale.
    const heading = onPage(page, "Selected Permanent Archives");
    await heading.click({ timeout: 30_000 });
    // (The editor keeps a hidden copy of the panel; only the visible one counts.)
    const panel = (name: string | RegExp) => page.getByLabel(name).filter({ visible: true });
    await panel(/^Size/).selectOption("9xl");
    await expect.poll(() => heading.evaluate((e) => getComputedStyle(e).fontSize)).toBe("128px");

    // Advanced: a class the design never used is compiled on demand with the design's own colours.
    await panel("Show class names (advanced)").check();
    const classes = panel(/^Classes \(Tailwind\)/);
    await classes.fill(`${await classes.inputValue()} tracking-[0.3em] bg-primary/20`);
    await classes.press("Enter");
    await expect.poll(() => heading.evaluate((e) => getComputedStyle(e).letterSpacing)).not.toBe("normal");
    await expect.poll(() => heading.evaluate((e) => getComputedStyle(e).backgroundColor)).toMatch(/^(oklab|color|rgba)\(/);

    await page.waitForTimeout(1000); // the draft saves shortly after the last change
    await page.getByRole("button", { name: "Send design" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/^Name/).fill("Studio Owner");
    await dialog.getByLabel(/^Email/).fill(email);
    await dialog.getByLabel(/What are you looking to build/).fill("This, restyled");
    await dialog.getByLabel(/I agree that/).check();
    await page.waitForTimeout(1700);
    await dialog.getByRole("button", { name: "Send project inquiry" }).click();
    await expect(dialog.getByRole("heading", { name: "Inquiry received" })).toBeVisible();

    const [row] = await query<{ token: string }>(`SELECT d.token FROM "Lead" l JOIN "SiteDraft" d ON d."leadId"=l.id WHERE l.email=$1`, [email]);
    await page.goto(`/build/preview/${row!.token}`);
    const sent = page.getByText("Selected Permanent Archives");
    expect(await sent.evaluate((e) => getComputedStyle(e).fontSize)).toBe("128px");
    expect(await sent.evaluate((e) => getComputedStyle(e).letterSpacing)).not.toBe("normal");
  });

  test("edit HTML: change a section's markup and classes, and unsafe parts are removed", async ({ page }) => {
    await page.goto("/build?template=noir-needle");
    const frame = canvas(page);
    await onPage(page, "Selected Permanent Archives").click({ timeout: 30_000 });
    const panel = (name: string | RegExp) => page.getByLabel(name).filter({ visible: true });
    await panel("Show class names (advanced)").check();
    await page.getByRole("button", { name: "Edit HTML" }).filter({ visible: true }).click();

    const dialog = page.getByRole("dialog", { name: "Edit HTML" });
    const code = dialog.getByRole("textbox", { name: /HTML/ });
    const html = await code.inputValue();
    expect(html).toContain("Selected Permanent Archives");
    expect(html).not.toContain("vt:");
    await code.fill(
      html
        .replace("Selected Permanent Archives", "Our Favourite Pieces")
        .replace(/<h2 class="/, '<h2 onclick="alert(1)" class="tracking-[0.4em] ')
        .replace("</h2>", '</h2><script>alert(1)</script><a href="javascript:alert(1)">Bad link</a>'),
    );
    await dialog.getByRole("button", { name: "Apply" }).click();
    await expect(dialog).toBeHidden();

    const heading = frame.getByText("Our Favourite Pieces");
    await expect(heading).toBeVisible();
    await expect(onPage(page, "Selected Permanent Archives")).toHaveCount(0);
    await expect.poll(() => heading.evaluate((e) => getComputedStyle(e).letterSpacing)).not.toBe("normal");
    expect(await heading.getAttribute("onclick")).toBeNull();
    await expect(frame.locator("script")).toHaveCount(0);
    expect((await frame.getByText("Bad link").getAttribute("href")) ?? "").not.toContain("javascript");

    // One undo brings the locked section back.
    await page.locator('button[title="undo"]').first().click();
    await expect(onPage(page, "Selected Permanent Archives")).toBeVisible();
  });

  test("designer template: its own sections and the ready-made ones drop between sections, and pages can be added", async ({ page }) => {
    await page.goto("/build?template=noir-needle");
    const frame = canvas(page);
    await expect(frame.locator("h1").first()).toContainText("PERMANENCE", { timeout: 30_000 });
    const root = frame.locator('[data-puck-dropzone="root:default-zone"]');
    const top = () => root.locator(":scope > [data-puck-component]").evaluateAll((els) => els.map((e) => e.getAttribute("data-puck-component")!.split("-")[0]));
    const before = await top();

    // The template's sections are blocks of their own in the panel; dropped on the hero, one arrives as editable pieces
    // beside it, not inside it.
    await expect(page.getByRole("region", { name: "Tattoo studio sections" })).toBeVisible();
    const testimonials = onPage(page, "Reflections from Collectors");
    const had = await testimonials.count();
    await dragBlock(page, page.locator('[data-testid^="drawer-item:TemplateSection"]').filter({ has: page.locator("span", { hasText: /^Collector testimonials$/ }) }), 300);
    await expect(testimonials).toHaveCount(had + 1);
    await expect.poll(top).toHaveLength(before.length + 1);
    expect(await frame.locator('[data-puck-component^="TemplateSection"]').count()).toBe(0);

    // A ready-made Hero dropped on the same spot also becomes a section of its own, never part of the design's hero.
    await dragBlock(page, page.locator('[data-testid="drawer-item:Hero"]'), 300);
    await expect.poll(top).toContain("Hero");
    expect(await root.locator(":scope > [data-puck-component] [data-puck-component^='Hero']").count()).toBe(0);

    // A new page, started from one of the template's pages.
    await page.getByRole("button", { name: /Add page/ }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Page name").fill("Our artists");
    await dialog.getByLabel("Start from").selectOption({ label: "Tattoo studio: Resident Artists" });
    await dialog.getByRole("button", { name: "Add page" }).click();
    await expect(page.getByRole("navigation", { name: "Pages" }).locator("li")).toHaveCount(5);
    await expect(frame.locator("h1").first()).toContainText(/RESIDENT/i);
  });

  test("styles per device: a desktop change reaches phones unless they have their own", async ({ page }) => {
    await page.goto("/build?template=noir-needle");
    const frame = canvas(page);
    const heading = onPage(page, "Selected Permanent Archives");
    await heading.click({ timeout: 30_000 });
    const size = () => heading.evaluate((e) => getComputedStyle(e).fontSize);
    const panel = (name: string | RegExp) => page.getByLabel(name).filter({ visible: true }).first();
    const device = (name: string) => page.getByRole("radio", { name, exact: true }).filter({ visible: true }).first().click();

    await panel(/^Size/).selectOption("9xl");
    await expect.poll(size).toBe("128px");
    await device("Phone");
    await expect.poll(size).toBe("128px"); // inherited from the desktop
    await panel(/^Size/).selectOption("xl");
    await expect.poll(size).toBe("20px");
    await expect(page.getByText("Phone only").filter({ visible: true })).toBeVisible();
    await device("Tablet");
    await expect.poll(size).toBe("128px");
    await device("Phone");
    await page.getByRole("button", { name: "Reset" }).filter({ visible: true }).first().click();
    await expect.poll(size).toBe("128px");
  });

  test("shortcuts: duplicate, copy to another page and paste, and the shortcut list", async ({ page }) => {
    await page.goto("/build?template=noir-needle");
    const frame = canvas(page);
    const heading = onPage(page, "Selected Permanent Archives");
    await heading.click({ timeout: 30_000 });
    await page.keyboard.press("ControlOrMeta+d");
    await expect(heading).toHaveCount(2);
    // The copy is selected: copy it.
    await page.keyboard.press("ControlOrMeta+c");

    await page.getByRole("navigation", { name: "Pages" }).getByText(/Resident Artists/).first().click();
    await expect(frame.locator("h1").first()).toContainText(/RESIDENT/i);
    await expect(heading).toHaveCount(0);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press("ControlOrMeta+v");
    await expect(heading).toHaveCount(1);

    await page.keyboard.press("Shift+Slash");
    await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
  });

  test("layers panel: readable names, and a rename that is kept", async ({ page }) => {
    await page.goto("/build?template=noir-needle");
    await expect(canvas(page).locator("h1").first()).toContainText("PERMANENCE", { timeout: 30_000 });
    await page.locator("nav").getByText("Outline", { exact: true }).click();
    const names = page.locator('li[data-puck-layer-tree-id] [class*="Layer-name"]');
    await expect(names.first()).toHaveText("Header");
    await expect(names.nth(1)).toHaveText("Immersive editorial hero");
    await names.first().dblclick();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("Site header");
    await page.keyboard.press("Enter");
    await expect(names.first()).toHaveText("Site header");
    await page.waitForTimeout(1200); // autosave
    await page.goto("/build");
    await page.locator("nav").getByText("Outline", { exact: true }).click();
    await expect(names.first()).toHaveText("Site header", { timeout: 30_000 });
  });

  test("free canvas: a group set to Free keeps its items in place, and they move by dragging and nudging", async ({ page }) => {
    await page.goto("/build?template=noir-needle");
    const frame = canvas(page);
    const h1 = frame.locator("h1").first();
    await h1.click({ timeout: 30_000 });
    await page.keyboard.press("Escape"); // the group around the heading
    await page.getByRole("radio", { name: "Free", exact: true }).filter({ visible: true }).first().click();

    const piece = h1.locator("xpath=ancestor-or-self::*[@data-puck-component][1]");
    const box = () => piece.evaluate((e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), pos: getComputedStyle(e).position }; });
    await expect.poll(async () => (await box()).pos).toBe("absolute");

    // Drag the selection frame by 100 × 40 canvas pixels.
    await h1.click({ force: true });
    const handleFrame = frame.locator("[data-free-canvas] > div[title]").first();
    await expect(handleFrame).toBeVisible();
    await page.waitForTimeout(500); // the layout settles after switching to Free
    const pinned = await box();
    const pinnedClass = (await piece.getAttribute("class")) ?? "";
    const pinnedPlace = [Number(pinnedClass.match(/vt:md:left-\[(-?\d+)px\]/)?.[1]), Number(pinnedClass.match(/vt:md:top-\[(-?\d+)px\]/)?.[1])];
    const iframe = (await page.locator("iframe").first().boundingBox())!;
    const scale = iframe.width / 1280;
    const f = (await handleFrame.boundingBox())!;
    const start = { x: f.x + f.width / 2, y: f.y + f.height / 2 };
    // Alt turns the smart guides off, so the item lands exactly where it's dropped.
    await page.keyboard.down("Alt");
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(start.x + i * 10 * scale, start.y + i * 4 * scale);
    await page.mouse.up();
    await page.keyboard.up("Alt");
    // The stored place moved by exactly the drag (on screen, a centred group may shift as it grows to fit).
    const place = async () => {
      const c = (await piece.getAttribute("class")) ?? "";
      return [Number(c.match(/vt:md:left-\[(-?\d+)px\]/)?.[1]), Number(c.match(/vt:md:top-\[(-?\d+)px\]/)?.[1])];
    };
    await expect.poll(box).toMatchObject({ x: pinned.x + 100 });
    expect(await place()).toEqual([pinnedPlace[0]! + 100, pinnedPlace[1]! + 40]);

    // Arrow keys nudge (Shift: 10px); one ⌘Z takes one step back.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press("Shift+ArrowRight");
    await expect.poll(async () => (await box()).x).toBe(pinned.x + 110);
    await page.keyboard.press("ControlOrMeta+z");
    await expect.poll(async () => (await box()).x).toBe(pinned.x + 100);

    // On phones the items stack in the flow.
    await page.getByRole("radio", { name: "Phone", exact: true }).filter({ visible: true }).first().click();
    await expect.poll(async () => (await box()).pos).toBe("static");
  });

  test("layers: a hidden layer fades in the editor and is left out of the design; a locked one can't be moved", async ({ page }) => {
    await page.goto("/build?template=noir-needle");
    const frame = canvas(page);
    await expect(frame.locator("h1").first()).toContainText("PERMANENCE", { timeout: 30_000 });
    // Selecting the heading opens the outline down to its layer.
    await frame.locator("h1").first().click();
    await page.locator("nav").getByText("Outline", { exact: true }).click();
    await expect(page.locator('li[data-puck-layer-tree-id] [class*="Layer-name"]').filter({ hasText: /^PERMANENCE/ }).first()).toBeAttached();
    const flag = (name: string) =>
      page.evaluate((name) => {
        const label = [...document.querySelectorAll('li[data-puck-layer-tree-id] [class*="Layer-name"]')].find((n) => n.textContent?.startsWith("PERMANENCE"));
        label?.parentElement?.querySelector<HTMLButtonElement>(`button[data-layer-flag="${name}"]`)?.click();
      }, name);
    const piece = frame.locator("h1").first().locator("xpath=ancestor-or-self::*[@data-puck-component][1]");

    await flag("hidden");
    await expect.poll(() => piece.evaluate((e) => getComputedStyle(e).opacity)).toBe("0.3");
    await page.getByRole("button", { name: "Preview" }).click();
    await expect(frame.locator("h1")).toHaveCount(0);
    await page.getByRole("button", { name: "Edit", exact: true }).click();

    await flag("hidden");
    await flag("locked");
    await expect.poll(() => piece.evaluate((e) => getComputedStyle(e).opacity)).toBe("1");
    await expect(page.locator('button[data-layer-flag="locked"][aria-pressed="true"]')).toHaveCount(1);
  });

  test("styles: the design's colours and fonts change site-wide, and colour and text styles apply by name", async ({ page }) => {
    const external: string[] = [];
    page.on("request", (r) => {
      const host = new URL(r.url()).hostname;
      if (r.url().startsWith("http") && host !== "localhost" && host !== "127.0.0.1") external.push(r.url());
    });
    await page.goto("/build?template=noir-needle");
    const frame = canvas(page);
    await expect(frame.locator("h1").first()).toContainText("PERMANENCE", { timeout: 30_000 });
    const visible = (l: Locator) => l.filter({ visible: true }).first();
    const tab = (name: string) => page.locator("nav").getByText(name, { exact: true }).click();
    const style = (text: string, prop: "color" | "fontSize") => onPage(page, text).first().evaluate((e, prop) => getComputedStyle(e.closest("[data-piece]")!)[prop], prop);
    const cta = frame.getByText("Request Custom Session").first();

    // The design's own colour and font, changed for the whole site (the font is served from this site).
    await tab("Styles");
    await page.getByLabel("Primary", { exact: true }).fill("#e11d48");
    await expect.poll(() => cta.evaluate((e) => getComputedStyle(e.closest("a,button")!).backgroundColor)).toBe("rgb(225, 29, 72)");
    const fonts = page.locator("section").filter({ has: page.getByRole("heading", { name: "Fonts" }) });
    await fonts.locator("label").filter({ hasText: /^Headline xl/ }).locator("select").selectOption("Fraunces");
    await expect.poll(() => frame.locator("h1").first().evaluate((e) => getComputedStyle(e).fontFamily)).toContain("Fraunces");

    // A colour style, used on a heading, then changed: the heading follows.
    await page.getByRole("button", { name: "Add colour style" }).click();
    await page.getByLabel("Colour 1 colour").fill("#22c55e");
    await tab("Blocks");
    await onPage(page, "Selected Permanent Archives").click();
    await visible(page.locator("details > summary").filter({ hasText: /^Colours$/ })).click();
    await visible(page.getByRole("radiogroup", { name: "Text colour" }).getByRole("radio", { name: "Colour 1" })).click();
    await expect.poll(() => style("Selected Permanent Archives", "color")).toBe("rgb(34, 197, 94)");
    await tab("Styles");
    await page.getByLabel("Colour 1 colour").fill("#3b82f6");
    await expect.poll(() => style("Selected Permanent Archives", "color")).toBe("rgb(59, 130, 246)");

    // A text style saved from one text and applied to another; editing the style changes both.
    await tab("Blocks");
    await onPage(page, "Selected Permanent Archives").click();
    await visible(page.getByRole("button", { name: "Save this look as a text style" })).click();
    await onPage(page, "Exquisite Needlecraft & Ceremonial Ink").click();
    await visible(page.getByLabel("Text style")).selectOption({ label: "Text style 1" });
    await tab("Styles");
    const textStyles = page.locator("section").filter({ has: page.getByRole("heading", { name: "Text styles" }) });
    await textStyles.getByRole("button", { name: "Edit" }).first().click();
    await visible(textStyles.getByLabel(/^Size/)).selectOption("7xl");
    await expect.poll(() => style("Selected Permanent Archives", "fontSize")).toBe("72px");
    await expect.poll(() => style("Exquisite Needlecraft & Ceremonial Ink", "fontSize")).toBe("72px");
    expect(external).toEqual([]);
  });

  test("components: copies follow the main one and keep their own words", async ({ page }) => {
    await page.goto("/build?template=noir-needle");
    const frame = canvas(page);
    await expect(frame.locator("h1").first()).toContainText("PERMANENCE", { timeout: 30_000 });
    const visible = (l: Locator) => l.filter({ visible: true }).first();
    const main = frame.locator(".veloce-component-main");
    const copy = frame.locator(".veloce-component-copy");

    await onPage(page, "Micro Needle Gauge").first().click({ force: true });
    await page.keyboard.press("Escape"); // the stat card
    await frame.getByRole("button", { name: /Make a component/ }).click();
    await expect(main).toHaveCount(1);
    await page.locator("nav").getByText("Assets", { exact: true }).click();
    await page.getByRole("button", { name: /^Insert / }).first().click();
    await expect(copy).toHaveCount(1);

    // The copy changes its label; the main one changes its padding: the copy follows the padding, keeps its label.
    await copy.getByText("Micro Needle Gauge", { exact: true }).click({ force: true });
    await visible(page.getByRole("textbox", { name: "Text", exact: true })).fill("Copy's own label");
    await main.click({ force: true, position: { x: 4, y: 4 } });
    await page.locator("nav").getByText("Blocks", { exact: true }).click();
    await visible(page.locator("details > summary").filter({ hasText: /^Spacing$/ })).click();
    await visible(page.getByLabel("Inside, top and bottom")).selectOption("16");
    await expect.poll(() => copy.evaluate((e) => getComputedStyle(e).paddingTop)).toBe("64px");
    await expect(copy).toContainText(/Copy's own label/i);
    await expect(main).toContainText(/Micro Needle Gauge/i);
  });

  test("content: a blog list follows its posts, a header follows the menu, and an item page shows its post", async ({ page }) => {
    await page.goto("/build?template=noir-needle");
    const frame = canvas(page);
    await expect(frame.locator("h1").first()).toContainText("PERMANENCE", { timeout: 30_000 });
    const visible = (l: Locator) => l.filter({ visible: true }).first();
    const tab = (name: string) => page.locator("nav").getByText(name, { exact: true }).click();
    const cards = frame.locator("article").filter({ has: frame.getByText(/^Read the post$/) });

    // A Collection list dropped on a site without collections makes a Blog, one card per post.
    await dragBlock(page, page.locator('[data-testid="drawer-item:CollectionListDrop"]'), 300);
    await expect(page.getByText(/Made a Blog collection/)).toBeVisible();
    await expect(cards).toHaveCount(3);

    // Editing a post in the Content tab updates its card.
    await tab("Content");
    await page.getByRole("button", { name: /^Blog/ }).click();
    await page.getByRole("button", { name: "Our first post", exact: true }).click();
    await visible(page.getByLabel("Title", { exact: true })).fill("Opening night");
    await expect(cards.filter({ hasText: "Opening night" })).toHaveCount(1);

    // The list shows up to two posts.
    await onPage(page, "Opening night").first().click({ force: true });
    await page.keyboard.press("Escape"); // the card
    await page.keyboard.press("Escape"); // the list
    await tab("Blocks");
    await visible(page.getByLabel("Show up to")).fill("2");
    await expect(cards).toHaveCount(2);

    // The header's links follow the main menu.
    await tab("Content");
    await page.getByRole("button", { name: "Start with every page" }).first().click();
    const nav = frame.locator("header nav").first();
    await nav.locator("a").nth(1).click({ force: true });
    await page.keyboard.press("Escape"); // the nav
    await tab("Blocks");
    await visible(page.getByLabel("Follow the site menu")).selectOption("main");
    await tab("Content");
    await visible(page.getByLabel("Menu label")).fill("Home");
    await expect(nav.locator("a").first()).toHaveText(/Home/i);
    await expect(nav.locator("a")).toHaveCount(4);

    // A page that shows one post at a time: its texts show the post's fields.
    await page.getByRole("navigation", { name: "Pages" }).getByText("Resident Artists").click();
    await expect(frame.locator("h1").first()).toContainText(/RESIDENT/i, { timeout: 30_000 });
    await page.keyboard.press("Escape");
    await tab("Blocks");
    await visible(page.getByLabel("This page shows one item of")).selectOption({ label: "Blog" });
    await frame.locator("h1").first().click({ force: true });
    await visible(page.getByLabel("Content from")).selectOption({ label: "Blog: Title" });
    await expect(frame.locator("h1").first()).toHaveText("Opening night");
  });

  test("media and effects: crop, focal point, animation, an uploaded image, rich text and new sections", async ({ page }) => {
    await page.goto("/build?template=noir-needle");
    const frame = canvas(page);
    await expect(frame.locator("h1").first()).toContainText("PERMANENCE", { timeout: 30_000 });
    const visible = (l: Locator) => l.filter({ visible: true }).first();
    const image = frame.locator("img[data-piece]").first();

    // Crop to a square and move the focal point.
    await image.click({ force: true });
    await visible(page.getByText("Crop and focal point")).click();
    await visible(page.getByLabel(/^Shape/)).selectOption({ label: "Square" });
    await expect.poll(() => image.evaluate((e) => getComputedStyle(e).aspectRatio)).toBe("1 / 1");
    const focal = visible(page.getByRole("button", { name: /Focal point/ }));
    const box = (await focal.boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.8);
    await expect.poll(() => image.evaluate((e) => getComputedStyle(e).objectPosition)).toBe("20% 80%");

    // An entrance animation.
    await visible(page.getByLabel("As it scrolls into view")).selectOption({ label: "Rise" });
    await expect(image).toHaveClass(/vt-enter-rise/);

    // Upload a picture from the Assets tab onto the selected image: stored as WebP, served by this site.
    await page.locator("nav").getByText("Assets", { exact: true }).click();
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
    await page.locator('input[type="file"]').first().setInputFiles({ name: "dot.png", mimeType: "image/png", buffer: png });
    await expect(image).toHaveAttribute("src", /^\/api\/builder\/media\/[\w-]{22}\.webp$/, { timeout: 30_000 });
    await expect.poll(() => image.evaluate((e) => (e as HTMLImageElement).naturalWidth)).toBe(1);

    // Rich text, edited on the canvas, and a ready-made Team section, both from the Blocks panel.
    await page.locator("nav").getByText("Blocks", { exact: true }).click();
    await page.getByRole("button", { name: "Design pieces" }).click();
    await dragBlock(page, page.locator('[data-testid="drawer-item:DRich"]'), 300);
    await expect(frame.locator(".veloce-rich strong").first()).toHaveText("bold");
    await dragBlock(page, page.locator('[data-testid="drawer-item:Team"]'), 300);
    await expect(frame.getByRole("heading", { name: "Meet the team" })).toBeVisible();
  });

  test("interactions: the hero photo wall loops, and the FAQ, menu and review stack work in preview", async ({ page }) => {
    // Needs the Kestrel trades template (removed for now, to be uploaded again).
    test.skip(!existsSync("public/builder-templates/trades-home-services"), "the trades-home-services template isn't in the project");
    await page.goto("/build?template=trades-home-services");
    const frame = canvas(page);
    await expect(frame.locator("h1").first()).toContainText("Plumbing", { timeout: 30_000 });
    // The wall scrolls on its own (copies added by the runtime, never stored).
    const wall = frame.locator("[data-vt-marquee]").first();
    await expect(wall.locator(":scope > [data-vt-clone]").first()).toBeAttached();
    const at = () => wall.evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).m42);
    const first = await at();
    await expect.poll(at).not.toBe(first);

    await page.getByRole("button", { name: "Preview" }).click();
    // FAQ: one answer open at a time, with its +/− swapped.
    const items = frame.locator("[data-vt-accordion] > li");
    await items.nth(1).locator("button").first().click();
    await expect(items.nth(1).locator("button").first()).toHaveAttribute("aria-expanded", "true");
    await expect(items.nth(1)).toContainText("−");
    await items.nth(2).locator("button").first().click();
    await expect(items.nth(1).locator("button").first()).toHaveAttribute("aria-expanded", "false");
    await expect(items.nth(2).locator("[data-vt-state~='open']").or(items.nth(2))).toHaveAttribute("data-vt-state", /open/);
    // Review stack: next shows the second card and says so.
    await frame.locator("[data-vt-step='next']").click();
    await expect(frame.locator("#rev-count")).toHaveText("2 of 5");
    // Phone: the menu button opens the menu, and a link in it closes it again.
    await page.getByTitle("Switch to Phone viewport").click();
    const menuButton = frame.getByRole("button", { name: "Open menu" });
    // The canvas redraws at the new width; the interactions start again with it.
    await expect(menuButton).toBeVisible();
    await expect(frame.locator("[data-vt-live]")).toHaveCount(1);
    await page.waitForTimeout(500);
    await menuButton.click();
    await expect(menuButton).toHaveAttribute("aria-expanded", "true");
    await frame.locator("#mobile-nav a").first().click();
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  });

  test("figma-like editing: section pictures, readable layers, and wiring a button to a section", async ({ page }) => {
    // Needs the Kestrel trades template (removed for now, to be uploaded again).
    test.skip(!existsSync("public/builder-templates/trades-home-services"), "the trades-home-services template isn't in the project");
    await page.goto("/build?template=trades-home-services");
    const frame = canvas(page);
    await expect(frame.locator("h1").first()).toContainText("Plumbing", { timeout: 30_000 });
    // Blocks: the template's sections as pictures, grouped and searchable, with clean names.
    const gallery = page.getByRole("region", { name: /Trades & home services sections/ });
    await expect(gallery.locator('[data-testid^="drawer-item:TemplateSection"] span').filter({ hasText: /^Hero$/ })).toBeVisible();
    await expect(gallery.getByText("HERO", { exact: true })).toHaveCount(0);
    await gallery.getByRole("searchbox", { name: "Search sections" }).fill("faq");
    await expect(gallery.locator('[data-testid^="drawer-item:TemplateSection"]')).toHaveCount(1);
    await gallery.getByRole("searchbox", { name: "Search sections" }).fill("");
    // Layers: named after the design, not "Group".
    await page.locator("nav").getByText("Outline", { exact: true }).click();
    await expect(page.locator('[class*="Layer-name"]').filter({ hasText: /^Recent jobs$/ }).first()).toBeVisible();
    await expect(page.getByText("BRANDS (Logo Slider)")).toHaveCount(0);
    // Wiring: select the hero's estimate button, drag its handle onto the FAQ.
    await page.getByRole("button", { name: "Wiring" }).click();
    await onPage(page, "Get a price estimate").first().click({ force: true });
    const handle = frame.locator("[data-wiring] circle");
    for (let i = 0; i < 4 && !(await handle.count()); i++) await page.keyboard.press("Escape");
    await expect(handle).toHaveCount(1);
    const frameBox = (await page.locator("iframe").first().boundingBox())!;
    const scale = frameBox.width / (await frame.locator("body").evaluate(() => innerWidth));
    const [cx, cy] = await handle.evaluate((c) => [Number(c.getAttribute("cx")), Number(c.getAttribute("cy"))]);
    await page.mouse.move(frameBox.x + cx! * scale, frameBox.y + cy! * scale);
    await page.mouse.down();
    await page.mouse.move(frameBox.x + cx! * scale + 20, frameBox.y + cy! * scale + 60, { steps: 4 });
    await frame.locator("#faq").evaluate((e) => e.scrollIntoView({ block: "start" }));
    const [fx, fy] = await frame.locator("#faq").evaluate((e) => { const r = e.getBoundingClientRect(); return [r.left + 200, r.top + 120]; });
    await page.mouse.move(frameBox.x + fx! * scale, frameBox.y + fy! * scale, { steps: 6 });
    await page.mouse.up();
    await expect(frame.locator("a[data-puck-component]").filter({ hasText: "Get a price estimate" }).first()).toHaveAttribute("href", "#faq");
    await expect(page.getByRole("combobox", { name: "On click" })).toHaveValue("section");
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
