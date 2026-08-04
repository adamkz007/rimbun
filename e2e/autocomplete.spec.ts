import { expect, test } from "@playwright/test";
import { login, uniquePatientName } from "./helpers/auth";

test("ICD-10 and drug autocomplete return seeded matches", async ({ page }) => {
  const patientName = uniquePatientName("Autocomplete Patient");
  await login(page);

  await page.goto("/patients");
  await page.getByRole("button", { name: "Register Patient" }).click();
  await page.getByLabel("Full Name").fill(patientName);
  await page.getByLabel("Phone").fill("+60123456789");
  await page.getByRole("button", { name: "Register Patient" }).click();
  await page.getByRole("button", { name: "Start Encounter" }).first().click();
  await page.waitForURL(/\/clerking\/.+/);

  await page.getByRole("tab", { name: "Diagnosis" }).click();
  await page.getByPlaceholder("Search ICD-10 diagnosis...").fill("diabetes");
  await expect(page.getByRole("option").first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("option").filter({ hasText: /diabetes/i }).first()).toBeVisible();

  await page.getByPlaceholder("Search ICD-10 diagnosis...").fill("hypertension");
  await expect(page.getByRole("option").filter({ hasText: /hypertension/i }).first()).toBeVisible({
    timeout: 15000,
  });

  await page.getByRole("tab", { name: "Prescription" }).click();
  await page.getByLabel("Add prescription").click();
  await page.getByPlaceholder("Search drug...").fill("metformin");
  await expect(page.getByRole("option").filter({ hasText: /metformin/i }).first()).toBeVisible({
    timeout: 15000,
  });

  await page.getByPlaceholder("Search drug...").fill("amlodipine");
  await expect(page.getByRole("option").filter({ hasText: /amlodipine/i }).first()).toBeVisible({
    timeout: 15000,
  });
});
