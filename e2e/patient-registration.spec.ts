import { expect, test } from "@playwright/test";
import { login, uniquePatientName } from "./helpers/auth";

test("registers a patient from the patients page", async ({ page }) => {
  const patientName = uniquePatientName("E2E Patient");
  await login(page);
  await page.goto("/patients");
  await page.getByRole("button", { name: "Register Patient" }).click();
  await page.getByLabel("Full Name").fill(patientName);
  await page.getByLabel("Phone").fill("+60123456789");
  await page.getByRole("button", { name: "Register Patient" }).click();
  await expect(page.getByText(patientName)).toBeVisible();
});
