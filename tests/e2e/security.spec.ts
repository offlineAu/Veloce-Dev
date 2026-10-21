import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { Pool } from "pg";
import { totpCode } from "../../src/server/security/totp";

test("security headers, nonce propagation and private image optimizer exclusion", async ({ page, request }, testInfo) => {
  await page.addInitScript(() => sessionStorage.setItem("veloce-booted", "1"));
  const response = await page.goto("/");
  expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response?.headers()["content-security-policy"]).toContain("object-src 'none'");
  expect(response?.headers()["content-security-policy-report-only"] ?? response?.headers()["content-security-policy"]).toContain("nonce-");
  expect(await page.locator('script[nonce]').first().evaluate((script: HTMLScriptElement) => (script.nonce ?? "").length)).toBeGreaterThan(20);
  await expect(page.locator("main")).toBeVisible();
  const privateImage = await request.get("/api/private/security-fixture/photo.webp");
  expect(privateImage.status()).toBe(404);
  expect(privateImage.headers()["cache-control"]).toContain("no-store");
  const optimized = await request.get('/_next/image?url=%2Fapi%2Fprivate%2Fsecurity-fixture%2Fphoto.webp&w=640&q=75');
  expect(optimized.status()).toBe(400);
  await page.screenshot({ path: testInfo.outputPath("security-home.png"), fullPage: false });
});

test.describe("isolated security fixture journeys", () => {
  test.skip(process.env.SECURITY_SMOKE !== "true", "Requires the isolated security smoke server and database");
  let db: Pool;
  const token = "s".repeat(43);
  test.beforeAll(async () => {
    const url = process.env.DATABASE_URL ?? "";
    if (!url.includes("127.0.0.1:55433/security")) throw new Error("Security fixtures require the isolated test database");
    db = new Pool({ connectionString: url });
    await db.query(`INSERT INTO "PrivateCaseStudy" (slug, title, summary, images) VALUES ($1, $2, $3, '[]'::jsonb) ON CONFLICT (slug) DO NOTHING`, ["security-fixture", "Confidential fixture", "Authorized review only"]);
    await db.query('DELETE FROM "PrivateAccessGrant" WHERE "caseSlug" = $1', ["security-fixture"]);
    await db.query('INSERT INTO "PrivateAccessGrant" (id, "caseSlug", "tokenHash", "expiresAt") VALUES ($1, $2, $3, $4)', ["security-fixture-grant", "security-fixture", createHash("sha256").update(`private-case:${token}`).digest("hex"), new Date(Date.now() + 3600_000)]);
  });
  test.afterAll(async () => { if (db) { await db.query('DELETE FROM "PrivateCaseStudy" WHERE slug = $1', ["security-fixture"]); await db.end(); } });
  test("private invitations hide content and stop working after revocation", async ({ page }) => {
    await page.goto("/private/security-fixture");
    await expect(page.getByText("Confidential fixture", { exact: true })).toHaveCount(0);
    await page.getByLabel("Invitation code").fill(token);
    await page.getByRole("button", { name: "View case study" }).click();
    await expect(page.getByRole("heading", { name: "Confidential fixture" })).toBeVisible();
    await db.query('UPDATE "PrivateAccessGrant" SET "revokedAt" = NOW() WHERE "caseSlug" = $1', ["security-fixture"]);
    await page.reload();
    await expect(page.getByLabel("Invitation code")).toBeVisible();
    await expect(page.getByText("Confidential fixture", { exact: true })).toHaveCount(0);
  });
  test("published builder template supports sanitized HTML editing under strict CSP", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Builder editing is checked at desktop width");
    const scriptViolations: string[] = [];
    page.on("console", message => { if (message.text() === "SECURITY_SCRIPT_BLOCKED") scriptViolations.push(message.text()); });
    await page.addInitScript(() => {
      document.addEventListener("securitypolicyviolation", event => {
        if (event.effectiveDirective.startsWith("script-src")) console.log("SECURITY_SCRIPT_BLOCKED");
      });
    });
    await page.goto("/build?template=aurelia-advisory");
    const canvas = page.frameLocator("iframe").first();
    await canvas.locator("h1").first().click({ timeout: 30_000 });
    await page.getByLabel("Show class names (advanced)").filter({ visible: true }).check();
    await page.getByRole("button", { name: "Edit HTML", exact: true }).filter({ visible: true }).click();
    const dialog = page.getByRole("dialog", { name: "Edit HTML", exact: true });
    const input = dialog.getByRole("textbox", { name: /HTML/ });
    const html = await input.inputValue();
    await input.fill(html + '<script>window.securityFixture = 1</script><a href="javascript:alert(1)">Unsafe fixture</a>');
    await dialog.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(canvas.getByText("Unsafe fixture", { exact: true })).toBeVisible();
    expect(await canvas.getByText("Unsafe fixture", { exact: true }).getAttribute("href") ?? "").not.toContain("javascript:");
    expect(scriptViolations).toEqual([]);
  });
  test("owner MFA login and logout revoke a copied session cookie", async ({ page, browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "One MFA login per fresh authenticator step; mobile invitation flows are covered separately");
    await page.goto("/admin/analytics");
    await page.getByLabel("Owner password").fill("fixture-owner-password");
    await page.getByLabel("Authenticator code").fill(totpCode("JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP", Math.floor(Date.now() / 30_000)));
    await page.getByRole("button", { name: "View analytics", exact: true }).click();
    await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
    const cookies = await page.context().cookies();
    const copied = await browser.newContext();
    await copied.addCookies(cookies);
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page.getByLabel("Owner password")).toBeVisible();
    const other = await copied.newPage();
    await other.goto("http://localhost:3108/admin/analytics");
    await expect(other.getByLabel("Owner password")).toBeVisible();
    await copied.close();
  });
});
