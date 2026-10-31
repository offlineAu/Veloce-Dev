import { expect, test, type Page } from "@playwright/test";

async function landingOffset(page: Page, id: string) {
  return page.locator(id).evaluate(el => Math.abs(el.getBoundingClientRect().top - parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop)));
}

for (const motion of ["full", "reduced"]) {
  test(`section and search jumps preserve history with ${motion} motion`, async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem("veloce-booted", "1"));
    await page.goto("/?nav-check=1");
    await page.evaluate(value => { document.documentElement.dataset.motion = value; }, motion);
    if ((page.viewportSize()?.width ?? 0) < 1024) {
      await page.getByRole("button", { name: "Open menu" }).click();
      await page.getByRole("navigation", { name: "Mobile" }).getByRole("link", { name: "Services", exact: true }).click();
    } else await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Services", exact: true }).click();
    await expect.poll(() => landingOffset(page, "#services")).toBeLessThan(3);
    await page.keyboard.press("ControlOrMeta+k");
    const dialog = page.getByRole("dialog", { name: "Search this site" });
    await dialog.getByRole("combobox").fill("booking");
    await dialog.getByRole("option", { name: /Booking systems/ }).click();
    await expect(page).toHaveURL(/\?nav-check=1#capabilities$/);
    await page.goBack();
    await expect(page).toHaveURL(/\?nav-check=1#services$/);
    await page.goForward();
    await expect(page).toHaveURL(/\?nav-check=1#capabilities$/);
  });
}

test("returning from a meeting restores the invitation after a stage switch", async ({ page }) => {
  await page.goto("/");
  await page.locator("#approach summary").click();
  const workbench = page.locator("[data-approach-workbench]");
  await workbench.getByRole("tab", { name: /Build it/ }).click();
  const invitation = workbench.locator("[data-workbench-meeting]");
  await invitation.click();
  await expect(page.locator("#veloce-meeting-title")).toBeFocused();
  await workbench.getByRole("tab", { name: /Make it work/ }).click();
  await page.getByRole("button", { name: "Back to example" }).click();
  await expect(invitation).toBeFocused();
});
