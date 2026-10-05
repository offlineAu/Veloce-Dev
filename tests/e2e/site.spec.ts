import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { TOKENS, query, resetFixtures, uniqueEmail } from "./helpers";

test.beforeEach(async () => {
  await resetFixtures();
});

/** Scroll through the page so once-only scroll reveals have run, then return to the top. */
async function revealAll(page: Page) {
  await page.evaluate(async () => {
    const h = document.documentElement.scrollHeight;
    for (let y = 0; y < h; y += 500) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(900);
}

/** Header icon from lg up; the footer link on phones and tablets (the header is logo-only there once scrolled). */
const openPaletteButton = (page: Page) =>
  (page.viewportSize()?.width ?? 0) >= 1024 ? page.getByRole("button", { name: "Change colour palette" }) : page.getByRole("button", { name: "Colour palette", exact: true });

const openInquiry = async (page: Page) => {
  await page.locator("[data-hero-cta]").click();
  const dialog = page.getByRole("dialog", { name: "Tell us about your project" });
  await expect(dialog).toBeVisible();
  await page.waitForTimeout(1700); // above the minimum fill time used against bots
  return dialog;
};

async function fillInquiry(page: Page, email: string) {
  await page.getByLabel(/^Name/).fill("Test Person");
  await page.getByRole("dialog").getByLabel(/^Email/).fill(email);
  await page.getByLabel(/^Company/).fill("Test Co");
  await page.getByRole("dialog").getByText("Website redesign", { exact: true }).click();
  await page.getByLabel(/What are you looking to build/).fill("Online booking for our clinic");
}

test.describe("sales page", () => {
  test("renders content and no offer without a referral", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("idea shouldn't stay an idea");
    await expect(page.getByText("Build fast. Build what works.").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Business websites" })).toBeVisible();
    await expect(page.getByText("Special offer")).toHaveCount(0);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /localhost:3000\/?$/);
  });

  test("active referral shows offer, expiry and referrer", async ({ page }) => {
    await page.goto(`/?ref=${TOKENS.active}`);
    await expect(page.getByText("E2E OFFER TITLE", { exact: true })).toBeVisible();
    await expect(page.getByText(/valid until/i).first()).toBeVisible();
    await expect(page.getByText("Alex Tester").first()).toBeVisible();
  });

  test("expired, unknown and malformed tokens never show an offer", async ({ page }) => {
    for (const t of [TOKENS.expired, "does-not-exist-12345678", "x", "<script>alert(1)</script>"]) {
      const res = await page.goto(`/?ref=${encodeURIComponent(t)}`);
      expect(res?.status()).toBe(200);
      await expect(page.getByText("E2E EXPIRED OFFER")).toHaveCount(0);
      await expect(page.locator("#offer").getByText("Special offer")).toHaveCount(0);
      await expect(page.locator("#offer").getByText("Valid until")).toHaveCount(0);
    }
  });

  test("campaign that hides the referrer name does not leak it", async ({ page }) => {
    await page.goto(`/?ref=${TOKENS.hidden}`);
    await expect(page.getByText("E2E HIDDEN OFFER")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Secret Person");
  });
});

test.describe("inquiry form", () => {
  test("consultation has distinct questions and validation, then returns to the project form", async ({ page }) => {
    await page.goto("/");
    const opener = page.getByRole("button", { name: "Request a consultation", exact: true });
    await opener.click();
    const dialog = page.getByRole("dialog", { name: "Request a consultation" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("group", { name: /What would you like advice on/ })).toBeVisible();
    await expect(dialog.getByRole("group", { name: /Project type/ })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Send consultation request" }).click();
    await expect(dialog.getByText("Choose a topic for your consultation.")).toBeVisible();
    await expect(dialog.getByText("Please add your name.")).toBeVisible();
    await expect(dialog.getByText(/agree to the privacy notice/)).toBeVisible();
    await dialog.getByLabel(/What question or decision/).fill("Should we replace our booking tool?");
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(opener).toBeFocused();
    const project = await openInquiry(page);
    await expect(project.getByRole("group", { name: /Project type/ })).toBeVisible();
    await expect(project.getByLabel(/What are you looking to build/)).toHaveValue("");
    await expect(project.getByRole("button", { name: "Send consultation request" })).toHaveCount(0);
  });

  test("consultation saves the advice topic and question with consultation intent", async ({ page }) => {
    const email = uniqueEmail("consultation");
    await page.goto("/");
    await page.getByRole("button", { name: "Request a consultation", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Request a consultation" });
    await dialog.getByLabel(/^Name/).fill("Test Consultant");
    await dialog.getByLabel(/^Email/).fill(email);
    await dialog.getByText("Improving a business workflow", { exact: true }).click();
    await expect(dialog.getByLabel("Improving a business workflow", { exact: true })).toBeChecked();
    await dialog.getByLabel(/What question or decision/).fill("Should we connect our booking tool to our CRM?");
    await dialog.getByLabel(/I agree that/).check();
    await page.waitForTimeout(1700);
    await dialog.getByRole("button", { name: "Send consultation request" }).click();
    await expect(dialog.getByRole("heading", { name: "Consultation request received" })).toBeVisible();
    await expect(dialog).toContainText("We'll confirm the scope and any cost before you commit.");
    const rows = await query<{ intent: string; projectType: string; projectGoals: string }>(
      `SELECT intent, "projectType", "projectGoals" FROM "Lead" WHERE email=$1`, [email],
    );
    expect(rows).toEqual([{
      intent: "CONSULTATION", projectType: "INTEGRATION",
      projectGoals: "Should we connect our booking tool to our CRM?",
    }]);
  });

  test("shows validation errors and keeps the dialog open", async ({ page }) => {
    await page.goto("/");
    const dialog = await openInquiry(page);
    await dialog.getByRole("button", { name: "Send project inquiry" }).click();
    await expect(dialog.getByText("Please add your name.")).toBeVisible();
    await expect(dialog.getByText("Pick the closest project type.")).toBeVisible();
    await expect(dialog.getByText(/agree to the privacy notice/)).toBeVisible();
  });

  test("submits, persists, and attributes a verified referral", async ({ page }) => {
    const email = uniqueEmail("lead");
    await page.goto(`/?ref=${TOKENS.active}&utm_source=e2e`);
    const dialog = await openInquiry(page);
    await fillInquiry(page, email);
    await page.getByLabel(/I agree that/).check();
    await dialog.getByRole("button", { name: "Send project inquiry" }).click();
    await expect(page.getByRole("heading", { name: "Inquiry received" })).toBeVisible();

    const rows = await query<{ source: string; token: string; utm: string; status: string; notes: string }>(
      `SELECT l.source, c."publicToken" AS token, a."utmSource" AS utm, l.status,
              (SELECT count(*) FROM "NotificationLog" n WHERE n."leadId"=l.id)::text AS notes
         FROM "Lead" l LEFT JOIN "ReferralCampaign" c ON c.id=l."referralCampaignId"
         LEFT JOIN "LeadAttribution" a ON a."leadId"=l.id WHERE l.email=$1`,
      [email],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ source: "REFERRAL_VERIFIED", token: TOKENS.active, utm: "e2e", status: "NEW", notes: "2" });
  });

  test("a direct visitor is recorded as direct, never verified", async ({ page }) => {
    const email = uniqueEmail("direct");
    await page.goto("/");
    const dialog = await openInquiry(page);
    await fillInquiry(page, email);
    await page.getByLabel(/I agree that/).check();
    await dialog.getByRole("button", { name: "Send project inquiry" }).click();
    await expect(page.getByRole("heading", { name: "Inquiry received" })).toBeVisible();
    const [row] = await query<{ source: string }>(`SELECT source FROM "Lead" WHERE email=$1`, [email]);
    expect(row?.source).toBe("DIRECT");
  });

  test("double-click creates a single lead", async ({ page }) => {
    const email = uniqueEmail("dbl");
    await page.goto("/");
    const dialog = await openInquiry(page);
    await fillInquiry(page, email);
    await page.getByLabel(/I agree that/).check();
    await dialog.getByRole("button", { name: "Send project inquiry" }).dblclick();
    await expect(page.getByRole("heading", { name: "Inquiry received" })).toBeVisible();
    const rows = await query(`SELECT 1 FROM "Lead" WHERE email=$1`, [email]);
    expect(rows).toHaveLength(1);
  });

  test("a server failure keeps the form and shows an error", async ({ page }) => {
    await page.goto("/");
    const dialog = await openInquiry(page);
    await fillInquiry(page, uniqueEmail("fail"));
    await page.getByLabel(/I agree that/).check();
    await page.route("**/*", (route) =>
      route.request().method() === "POST" ? route.abort() : route.continue(),
    );
    await dialog.getByRole("button", { name: "Send project inquiry" }).click();
    await expect(dialog.getByRole("alert").filter({ hasText: "not saved" })).toBeVisible();
    await expect(dialog.getByLabel(/^Name/)).toHaveValue("Test Person");
  });

  test("bot-like fast submission stores nothing", async ({ page }) => {
    const email = uniqueEmail("bot");
    // Deterministic "too fast": the form records its start time from the page clock; an hour ahead is always newer than the server's clock.
    await page.clock.install({ time: Date.now() + 3_600_000 });
    await page.goto("/");
    await page.locator("[data-hero-cta]").click();
    await fillInquiry(page, email);
    await page.getByLabel(/I agree that/).check();
    await page.getByRole("button", { name: "Send project inquiry" }).click();
    await expect(page.getByRole("heading", { name: "Inquiry received" })).toBeVisible();
    expect(await query(`SELECT 1 FROM "Lead" WHERE email=$1`, [email])).toHaveLength(0);
  });
});

test.describe("referral page", () => {
  test("is personalised, noindex, and unknown tokens 404", async ({ page }) => {
    const res = await page.goto(`/refer/${TOKENS.active}`);
    expect(res?.status()).toBe(200);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.getByText("Alex Tester").first()).toBeVisible();
    await expect(page.getByText("E2E OFFER TITLE", { exact: true })).toBeVisible();
    expect((await page.goto("/refer/not-a-real-token-1234"))?.status()).toBe(404);
  });

  test("works with optional campaign data missing", async ({ page }) => {
    await page.goto(`/refer/${TOKENS.noOffer}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Special offer")).toHaveCount(0);
  });

  test("expired offer is not presented as valid", async ({ page }) => {
    await page.goto(`/refer/${TOKENS.expired}`);
    await expect(page.getByText(/offer attached to this link has ended/)).toBeVisible();
    await expect(page.locator("#share-message")).not.toContainText("E2E EXPIRED OFFER");
  });

  test("share links are valid, encoded and carry only the public token", async ({ page }) => {
    await page.goto(`/refer/${TOKENS.active}`);
    const message = await page.locator("#share-message").inputValue();
    expect(message).toContain(`?ref=${TOKENS.active}`);
    const mail = await page.locator("#share").getByRole("link", { name: "Email" }).getAttribute("href");
    expect(mail!.startsWith("mailto:?subject=")).toBe(true);
    expect(decodeURIComponent(mail!.split("body=")[1]!)).toBe(message);
    const wa = await page.getByRole("link", { name: /WhatsApp/ }).getAttribute("href");
    expect(wa!.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(wa!.split("text=")[1]!)).toBe(message);
    expect(message).not.toMatch(/c_E2E|cuid|@/);
  });

  test("copy reports success", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(`/refer/${TOKENS.active}`);
    await page.getByRole("button", { name: "Copy message" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Message copied" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(`?ref=${TOKENS.active}`);
  });

  test("copy reports failure when the clipboard is unavailable", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("denied")) } });
      document.execCommand = () => false;
    });
    await page.goto(`/refer/${TOKENS.active}`);
    await page.getByRole("button", { name: "Copy message" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Couldn't copy" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Copied" })).toHaveCount(0);
  });

  test("introduction validates, persists and does not over-promise", async ({ page }) => {
    const referred = uniqueEmail("referred");
    await page.goto(`/refer/${TOKENS.active}`);
    await page.locator("[data-hero-cta]").click();
    const dialog = page.getByRole("dialog", { name: "Make an introduction" });
    await page.waitForTimeout(1700);
    await dialog.getByRole("button", { name: "Send introduction" }).click();
    await expect(dialog.getByText("Please add your name.")).toBeVisible();
    await expect(dialog.getByText(/permission to share/).first()).toBeVisible();

    await dialog.getByLabel(/^Your name/).fill("Alex Tester");
    await dialog.getByLabel(/^Your email/).fill(uniqueEmail("referrer"));
    await dialog.getByLabel(/^Their name/).fill("Jamie Referred");
    await dialog.getByLabel(/^Their email/).fill(referred);
    await dialog.getByLabel(/^What are they looking for/).selectOption("REDESIGN");
    await dialog.getByLabel(/I have this person/).check();
    await dialog.getByRole("button", { name: "Send introduction" }).click();
    await expect(page.getByRole("heading", { name: "Introduction recorded" })).toBeVisible();
    await expect(page.getByText(/emailed you a confirmation/)).toHaveCount(0);
    await expect(page.getByText(/business days/)).toHaveCount(0);
    const [row] = await query<{ token: string; status: string }>(
      `SELECT c."publicToken" AS token, i.status FROM "ReferralIntroduction" i JOIN "ReferralCampaign" c ON c.id=i."campaignId" WHERE i."referredEmail"=$1`,
      [referred],
    );
    expect(row).toMatchObject({ token: TOKENS.active, status: "RECEIVED" });
  });
});

test.describe("security and exposure", () => {
  test("a forged campaignId in the payload is ignored", async ({ page }) => {
    // Attribution only ever comes from the verified public token; ids are not accepted fields.
    const email = uniqueEmail("forge");
    await page.goto("/");
    const dialog = await openInquiry(page);
    await fillInquiry(page, email);
    await page.getByLabel(/I agree that/).check();
    await page.route("**/*", async (route) => {
      const req = route.request();
      if (req.method() === "POST" && req.postData()?.includes(email)) {
        const body = req.postData()!.replace(/\]$/, `,{"referralCampaignId":"c_${TOKENS.active}"}]`);
        return route.continue({ postData: body });
      }
      return route.continue();
    });
    await dialog.getByRole("button", { name: "Send project inquiry" }).click();
    await expect(page.getByRole("heading", { name: "Inquiry received" })).toBeVisible();
    const [row] = await query<{ id: string | null }>(`SELECT "referralCampaignId" AS id FROM "Lead" WHERE email=$1`, [email]);
    expect(row?.id).toBeNull();
  });

  test("public pages do not expose internal ids or referrer emails", async ({ page }) => {
    for (const url of [`/?ref=${TOKENS.active}`, `/refer/${TOKENS.active}`]) {
      await page.goto(url);
      const html = await page.content();
      expect(html).not.toContain(`c_${TOKENS.active}`);
      expect(html).not.toMatch(/referrerEmail/);
    }
  });

  test("security headers are present", async ({ request }) => {
    const res = await request.get("/");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    expect(res.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(res.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  });

  test("robots and sitemap exclude personal pages", async ({ request }) => {
    expect(await (await request.get("/robots.txt")).text()).toContain("Disallow: /refer/");
    expect(await (await request.get("/sitemap.xml")).text()).not.toContain("/refer/");
  });
});

test.describe("accessibility", () => {
  const scan = (page: Page) => new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();

  for (const [name, url] of [["sales page", "/"], ["referral page", `/refer/${TOKENS.active}`], ["privacy", "/privacy"]] as const) {
    test(`${name} has no axe violations`, async ({ page }) => {
      await page.goto(url);
      await revealAll(page);
      expect((await scan(page)).violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);
    });
  }

  test("inquiry dialog: no violations, focus trapped, Esc closes and returns focus", async ({ page }) => {
    await page.goto("/");
    await revealAll(page);
    const trigger = page.locator("[data-hero-cta]");
    await trigger.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await page.waitForTimeout(800); // let the open animation finish so colours are not mid-fade
    expect((await scan(page)).violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);
    for (let i = 0; i < 40; i++) await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});

test.describe("responsive", () => {
  test("no horizontal overflow on key pages", async ({ page }) => {
    for (const url of ["/", `/refer/${TOKENS.active}`]) {
      await page.goto(url);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    }
  });

  test("mobile menu is operable by keyboard", async ({ page, isMobile }) => {
    test.skip(!isMobile);
    await page.goto("/");
    const toggle = page.getByRole("button", { name: "Open menu" });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("link", { name: "Capabilities" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Open menu" })).toHaveAttribute("aria-expanded", "false");
  });
});

test.describe("navigation, search and motion", () => {
  test("notch header marks the section in view", async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 1024, "below 1024px the header keeps only the logo once scrolled; the dock carries the links");
    await page.goto("/");
    await page.locator("#services").scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 200);
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Services", exact: true })).toHaveAttribute("aria-current", "location");
  });

  test("search palette finds a capability and jumps to its section", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Control+k");
    const dialog = page.getByRole("dialog", { name: "Search this site" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("combobox").fill("booking");
    await expect(dialog.getByRole("option", { name: /Booking systems/ })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/#capabilities$/);
  });

  test("search palette opens from the button, shows an empty state and closes with Esc", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("header button[aria-haspopup='dialog'][aria-keyshortcuts]")).toHaveCount(0);
    await page.mouse.wheel(0, 1400);
    const slot = page.locator("[data-conversation-fab]");
    const toggle = slot.locator("[data-fab-toggle]");
    await expect(slot).not.toHaveAttribute("inert", "");
    await toggle.focus();
    await page.keyboard.press("Enter");
    const search = slot.getByRole("button", { name: "Search this site", exact: true });
    await expect(search.locator("svg")).toBeVisible();
    await expect(search.locator("kbd")).toHaveText("Ctrl K");
    await expect(search.locator("kbd")).toBeVisible();
    await search.click();
    const dialog = page.getByRole("dialog", { name: "Search this site" });
    await dialog.getByRole("combobox").fill("zzzzqqq");
    await expect(dialog.getByText(/No matches/)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("search palette can open the contact form", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Control+k");
    await page.getByRole("dialog", { name: "Search this site" }).getByRole("combobox").fill("start a conversation");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "Tell us about your project" })).toBeVisible();
  });

  test("the Offer tab is always in the nav and the section is honest without an offer", async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 768, "desktop nav");
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "More" }).getByRole("link", { name: "Offer", exact: true })).toBeVisible();
    await expect(page.locator("#offer").getByRole("heading", { name: "A clear way to start." })).toBeVisible();
    await expect(page.locator("#offer").getByText("Special offer")).toHaveCount(0);
  });

  test("quick dock appears after scrolling and expands into a menu", async ({ page }) => {
    await page.goto("/");
    const dock = page.getByRole("navigation", { name: "Quick links" });
    if ((page.viewportSize()?.width ?? 0) >= 1024) {
      await expect(dock).toBeHidden(); // desktop: the header already shows every link
      return;
    }
    await expect(dock).toHaveAttribute("inert", "");
    if ((page.viewportSize()?.width ?? 0) >= 640) {
      await page.mouse.wheel(0, 1400);
      for (const l of ["Services", "Our approach", "Capabilities", "Offer"]) await expect(dock.getByRole("link", { name: l, exact: true })).toBeVisible();
      await page.mouse.wheel(0, -1400);
    }
    await page.mouse.wheel(0, 1400);
    const more = dock.locator("button[aria-expanded]");
    await expect(more).toBeVisible();
    await more.click();
    await expect(more).toHaveAttribute("aria-expanded", "true");
    await expect(dock.getByText("What we build")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(more).toHaveAttribute("aria-expanded", "false");
  });

  test("conversation FAB reveals chat and search upward on hover or tap", async ({ page }) => {
    await page.goto("/");
    const fab = page.locator("[data-primary-cta]");
    const slot = page.locator("[data-conversation-fab]");
    const toggle = slot.locator("[data-fab-toggle]");
    const panel = slot.locator("[id]").first();
    await expect(fab).toHaveAttribute("aria-label", "Start a conversation");
    await expect(slot).toHaveAttribute("inert", "");
    await expect(slot).toHaveCSS("opacity", "0");
    await expect(page.locator("header [data-primary-cta]")).toHaveCount(0); // not in the notch bar any more
    await page.mouse.wheel(0, 1400);
    await expect(slot).not.toHaveAttribute("inert", "");
    await expect(slot).toHaveCSS("opacity", "1");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(panel).toHaveAttribute("inert", "");
    if (test.info().project.name === "mobile") {
      await toggle.tap();
    } else {
      await toggle.hover();
    }
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(panel).toHaveCSS("opacity", "1");
    await expect(fab).toBeVisible();
    expect((await fab.boundingBox())!.y).toBeLessThan((await toggle.boundingBox())!.y);
    await slot.getByRole("button", { name: "Search this site" }).click();
    const searchDialog = page.getByRole("dialog", { name: "Search this site" });
    await expect(searchDialog).toBeVisible();
    await searchDialog.getByRole("combobox").fill("services");
    await expect(searchDialog.getByRole("option", { name: /Services/ }).first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(searchDialog).toBeHidden();
    await page.mouse.move(0, 0);
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("navigation", { name: "Quick links" }).getByText("Start a conversation")).toHaveCount(0);
    await fab.click();
    await expect(page.getByRole("dialog", { name: "Tell us about your project" })).toBeVisible();
  });

  test("contacts: the closing section has the VELOCE social flip", async ({ page }) => {
    await page.goto("/");
    const cta = page.locator("section[aria-labelledby='cta-title']");
    await expect(cta.getByText("Or reach us directly")).toBeVisible();
    await expect(cta.getByRole("link", { name: "Email", exact: true })).toHaveAttribute("href", /^mailto:/);
    // Every slot is shown even when its link is not configured: unset ones are inactive, labelled, and not links.
    await expect(cta.getByRole("img", { name: /not set up yet/ })).toHaveCount(5);
    await expect(cta.getByRole("link", { name: "Facebook" })).toHaveCount(0);
  });

  test("colour palette: periwinkle by default, Ember is an option that is remembered, reset returns to default", async ({ page }) => {
    await page.goto("/");
    const html = page.locator("html");
    await expect(html).not.toHaveAttribute("data-theme", /.+/);
    const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(await bg()).toBe("rgb(247, 247, 255)");
    await openPaletteButton(page).click();
    const panel = page.getByRole("dialog", { name: "Colour palette" });
    await expect(panel.getByRole("radio", { name: /Periwinkle/ })).toHaveAttribute("aria-checked", "true");
    await panel.getByRole("radio", { name: /Ember/ }).click();
    await expect(html).toHaveAttribute("data-theme", "ember");
    expect(await bg()).toBe("rgb(23, 16, 16)");
    await page.reload();
    await expect(html).toHaveAttribute("data-theme", "ember"); // applied before paint from the saved choice
    await openPaletteButton(page).click();
    await page.getByRole("button", { name: "Use site default" }).click();
    await expect(html).not.toHaveAttribute("data-theme", /.+/);
    expect(await bg()).toBe("rgb(247, 247, 255)");
  });

  test("reduced-motion device: flip is static by default; \"Always play animations\" turns the real flip on and is remembered", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto("/");
    const flipTile = () => page.locator("section[aria-labelledby='cta-title'] a[aria-label='Email']").evaluate((a) => getComputedStyle(a.lastElementChild!).transform);
    const cta = page.locator("section[aria-labelledby='cta-title']");
    await cta.scrollIntoViewIfNeeded();
    await cta.getByText("Or reach us directly").hover();
    await cta.locator("a[aria-label='Email']").hover();
    await page.waitForTimeout(300);
    expect(await flipTile()).toBe("none");
    await openPaletteButton(page).click();
    await page.getByRole("switch", { name: /Always play animations/ }).click();
    await expect(page.locator("html")).toHaveAttribute("data-motion", "full");
    await page.keyboard.press("Escape");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-motion", "full"); // remembered
    await cta.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await cta.locator("a[aria-label='Email']").hover();
    await page.waitForTimeout(150);
    expect(await flipTile()).toMatch(/matrix3d/); // a real 3D rotation is running
    await ctx.close();
  });

  test("footer social flip shows the email channel with an accessible name", async ({ page }) => {
    await page.goto("/");
    const mail = page.getByRole("link", { name: "Email", exact: true }).last(); // the contact row appears once on the sales page
    await expect(mail).toHaveAttribute("href", /^mailto:/);
  });

  test("with reduced motion every heading and card is still readable", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto("/");
    await revealAll(page);
    await expect(page.getByRole("heading", { name: "Practical systems, built around your business." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Business websites" })).toBeVisible();
    expect(await page.evaluate(() => getComputedStyle(document.querySelector(".aura-a")!).animationName)).toBe("none");
    await ctx.close();
  });

  test("content is present without scrolling (server HTML is not hidden)", async ({ request }) => {
    const html = await (await request.get("/")).text();
    expect(html).toContain("Practical systems, built around your business.");
    expect(html).toContain("Business websites");
  });
});
