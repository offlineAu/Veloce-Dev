import { totpCode } from "../../src/server/security/totp";
import { expect, test } from "@playwright/test";

test.skip(process.env.E2E_ANALYTICS_OWNER !== "true", "Requires the isolated owner-dashboard production server");
test("owner dashboard requires login, shows reports, filters dates, and signs out", async ({ page }) => {
  const captures: string[] = [];
  page.on("request", request => { if (request.url().includes("/api/analytics/e")) captures.push(request.url()); });
  await page.goto("/admin/analytics");
  await expect(page.getByRole("heading", { name: "Your site, in numbers." })).toBeVisible();
  await expect(page.getByRole("region", { name: "Traffic totals" })).toHaveCount(0);
  await page.getByLabel("Owner password").fill("dashboard-test-owner-password");
  if (await page.getByLabel("Authenticator code").isVisible()) {
    if (!process.env.E2E_OWNER_TOTP_SECRET) throw new Error("Set E2E_OWNER_TOTP_SECRET to the isolated dashboard authenticator secret");
    await page.getByLabel("Authenticator code").fill(totpCode(process.env.E2E_OWNER_TOTP_SECRET, Math.floor(Date.now() / 30_000)));
  }
  await page.getByRole("button", { name: "View analytics" }).click();
  await expect(page.getByRole("heading", { name: "A clearer view of your site." })).toBeVisible();
  await expect(page.getByRole("region", { name: "Traffic totals" })).toContainText("Visitors");
  await expect(page.getByRole("heading", { name: "Popular pages" })).toBeVisible();
  await page.getByRole("link", { name: "7 days", exact: true }).click();
  await expect(page).toHaveURL(/days=7$/);
  await expect(page.getByRole("link", { name: "7 days", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Traffic over time" })).toBeVisible();
  expect(await page.locator("body").evaluate(el => el.scrollWidth <= window.innerWidth)).toBe(true);
  expect(captures).toHaveLength(0);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your site, in numbers." })).toBeVisible();
  await page.goto("/admin/analytics?days=90");
  await expect(page.getByRole("heading", { name: "Your site, in numbers." })).toBeVisible();
});
