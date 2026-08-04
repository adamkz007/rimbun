import { expect, test } from "@playwright/test";
import { login, uniquePatientName } from "./helpers/auth";

test("scratchpad save persists after reload", async ({ page }) => {
  const patientName = uniquePatientName("Scratchpad Patient");
  await login(page);

  await page.goto("/patients");
  await page.getByRole("button", { name: "Register Patient" }).click();
  await page.getByLabel("Full Name").fill(patientName);
  await page.getByLabel("Phone").fill("+60123456789");
  await page.getByRole("button", { name: "Register Patient" }).click();
  await page.getByRole("button", { name: "Start Encounter" }).first().click();
  await page.waitForURL(/\/clerking\/.+/);

  const canvas = page.locator("canvas").first();
  await canvas.click({ position: { x: 40, y: 40 } });
  await page.mouse.down();
  await page.mouse.move(120, 120);
  await page.mouse.up();

  await page.getByRole("button", { name: "Save scratchpad" }).click();
  await expect(page.getByText("Saved")).toBeVisible({ timeout: 15000 });

  const encounterUrl = page.url();
  await page.reload();
  await expect(page).toHaveURL(encounterUrl);
  await expect(page.locator("canvas").first()).toBeVisible();
});
