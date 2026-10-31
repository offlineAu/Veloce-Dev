import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { resetFixtures, TOKENS } from "./helpers";

const pages = ["/", "/services/business-websites", "/services/website-redesign", "/services/ecommerce", "/about", "/privacy", "/terms"];

test("public pages have distinct metadata and clean canonical URLs", async ({ page, request }) => {
  const titles = new Set<string>();
  const descriptions = new Set<string>();
  for (const path of pages) {
    const response = await page.goto(`${path}?utm_source=seo-check&ref=invalid`);
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    const canonical = new URL((await page.locator('link[rel="canonical"]').getAttribute("href"))!);
    expect(canonical.pathname).toBe(path);
    expect(canonical.search).toBe("");
    for (const content of await page.locator('meta[name="robots"]').evaluateAll((tags) => tags.map((tag) => tag.getAttribute("content")))) expect(content).not.toContain("noindex");
    const title = await page.title();
    const description = (await page.locator('meta[name="description"]').getAttribute("content"))!;
    expect(title).not.toBe(""); expect(description).not.toBe("");
    titles.add(title); descriptions.add(description);
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute("content", description);
    await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute("content", description);
    await expect(page.locator('meta[property="og:image"]').first()).toHaveAttribute("content", /\/opengraph-image/);
    await expect(page.locator('meta[name="twitter:image"]').first()).toHaveAttribute("content", /\/opengraph-image/);
    const html = await (await request.get(path)).text();
    expect(html).toContain("<h1");
  }
  expect(titles.size).toBe(pages.length);
  expect(descriptions.size).toBe(pages.length);
});

test("sitemap includes only public pages and noindex pages remain crawlable", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => new URL(match[1]!).pathname);
  expect(urls.sort()).toEqual([...pages].sort());
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).not.toContain("Disallow: /refer/");
  expect(robots).not.toContain("Disallow: /build");
  expect(robots).toContain("Disallow: /api/");
  const build = await (await request.get("/build")).text();
  expect(build).toMatch(/name="robots" content="[^"]*noindex/);
});

test("organization and breadcrumb data match the public pages", async ({ page }) => {
  await page.goto("/");
  const org = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
  expect(org["@graph"].map((item: { "@type": string }) => item["@type"])).toEqual(["Organization", "WebSite"]);
  for (const path of pages.filter((path) => path.startsWith("/services/"))) {
    await page.goto(path);
    const data = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
    expect(data["@type"]).toBe("BreadcrumbList");
    const current = data.itemListElement[1];
    expect(new URL(current.item).pathname).toBe(path);
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText(current.name);
  }
});

for (const [slug, label, placeholder] of [
  ["business-websites", "Business websites", "e.g. A website for our clinic with online booking"],
  ["website-redesign", "Website redesign", "e.g. Our current site is slow and hard to update"],
  ["ecommerce", "E-commerce websites", "e.g. An online store for 200 products with local delivery"],
] as const) {
  test(`${label} opens the existing inquiry with its service context`, async ({ page }) => {
    await page.goto(`/services/${slug}`);
    await page.getByRole("button", { name: "Discuss your project", exact: true }).click();
    await expect(page.getByRole("dialog", { name: `Ask about ${label}` })).toBeVisible();
    await expect(page.getByPlaceholder(placeholder)).toBeVisible();
  });
}

test("new pages are accessible and fit the viewport", async ({ page }) => {
  for (const path of [...pages.filter((path) => path.startsWith("/services/")), "/about"]) {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.locator("[data-boot-loader]")).toHaveCount(0);
  }
});

test("unknown service URLs return 404", async ({ request }) => {
  expect((await request.get("/services/unknown-service")).status()).toBe(404);
});

test("www redirects permanently while preserving the path and query", async ({ request }) => {
  const response = await request.get("/services/ecommerce?ref=test&utm_source=seo-check", { headers: { host: "www.veloceapp.dev" }, maxRedirects: 0 });
  expect(response.status()).toBe(308);
  const location = new URL(response.headers().location!);
  expect(location.origin).toBe("https://veloceapp.dev");
  expect(location.pathname).toBe("/services/ecommerce");
  expect(location.searchParams.get("ref")).toBe("test");
  expect(location.searchParams.get("utm_source")).toBe("seo-check");
});

test("verified referrals survive navigation while invalid tokens are discarded", async ({ page }) => {
  await resetFixtures();
  await page.goto(`/?ref=${TOKENS.hidden}`);
  // The services book keeps its chapter links hidden until a chapter is open; the footer's is always there.
  const serviceLink = page.locator(`a[href="/services/business-websites?ref=${TOKENS.hidden}"]`).filter({ visible: true }).first();
  await serviceLink.click();
  await expect(page).toHaveURL(new RegExp(`/services/business-websites\\?ref=${TOKENS.hidden}$`));
  await expect(page.getByRole("link", { name: "Get to know Veloce" })).toHaveAttribute("href", `/about?ref=${TOKENS.hidden}`);
  await page.getByRole("button", { name: "Discuss your project", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).not.toContainText("Secret Person");
  const head = await page.locator("head").innerHTML();
  expect(head).not.toContain(TOKENS.hidden);
  expect(head).not.toContain("Secret Person");
  await page.goto("/services/business-websites?ref=invalid");
  await expect(page.getByRole("link", { name: "Get to know Veloce" })).toHaveAttribute("href", "/about");
});

test("service content and navigation are available without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${test.info().project.use.baseURL}/services/business-websites`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Get to know Veloce" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What we can include" })).toBeVisible();
  for (const path of ["/", "/about"]) {
    await page.goto(`${test.info().project.use.baseURL}${path}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
  await context.close();
});

test("navigation stays usable after scrolling on content pages", async ({ page }) => {
  await page.goto("/services/business-websites");
  await page.evaluate(() => window.scrollTo(0, 800));
  // Below the header's breakpoint (tablets included) the links live in the menu.
  const menu = page.getByRole("button", { name: "Open menu" });
  if (await menu.isVisible()) {
    await menu.click();
    await page.getByRole("navigation", { name: "Mobile", exact: true }).getByRole("link", { name: "About", exact: true }).click();
  } else {
    await page.locator("header").getByRole("link", { name: "About", exact: true }).click();
  }
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
