import { expect, test } from "@playwright/test";
import { login, uniquePatientName } from "./helpers/auth";
import { getEncounterStatus } from "./helpers/supabase-admin";

test("happy path from login through encounter completion", async ({ page }) => {
  const patientName = uniquePatientName("Smoke Patient");
  await login(page);

  await page.goto("/patients");
  await page.getByRole("button", { name: "Register Patient" }).click();
  await page.getByLabel("Full Name").fill(patientName);
  await page.getByLabel("Phone").fill("+60123456789");
  await page.getByRole("button", { name: "Register Patient" }).click();
  await expect(page.getByText(patientName)).toBeVisible();

  await page.getByRole("button", { name: "Start Encounter" }).first().click();
  await page.waitForURL(/\/clerking\/.+/);
  const encounterId = page.url().split("/").pop()!;

  const editor = page.locator(".ProseMirror").first();
  await editor.fill("Smoke test consultation note.");
  await page.getByRole("button", { name: "Save chief complaint note" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();

  await page.getByRole("tab", { name: "Diagnosis" }).click();
  await page.getByPlaceholder("Search ICD-10 diagnosis...").fill("diabetes");
  await page.getByRole("option").first().click();

  await page.getByRole("tab", { name: "Prescription" }).click();
  await page.getByLabel("Add prescription").click();
  await page.getByPlaceholder("Search drug...").fill("metformin");
  await page.getByRole("option").first().click();
  await page.locator('input[type="number"]').fill("30");
  await page.locator(".rounded.border.p-3 input.h-7.text-xs").first().fill("500mg");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByText(/metformin/i)).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Complete Encounter" }).click();
  await page.waitForURL(/\/clerking$/);

  expect(await getEncounterStatus(encounterId)).toBe("completed");
});
