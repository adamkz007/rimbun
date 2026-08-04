import { expect, test } from "@playwright/test";
import { login, uniquePatientName } from "./helpers/auth";
import { getEncounterStatus } from "./helpers/supabase-admin";

test("completing an encounter locks the workspace", async ({ page }) => {
  const patientName = uniquePatientName("Complete Patient");
  await login(page);

  await page.goto("/patients");
  await page.getByRole("button", { name: "Register Patient" }).click();
  await page.getByLabel("Full Name").fill(patientName);
  await page.getByLabel("Phone").fill("+60123456789");
  await page.getByRole("button", { name: "Register Patient" }).click();
  await page.getByRole("button", { name: "Start Encounter" }).first().click();
  await page.waitForURL(/\/clerking\/.+/);

  const encounterId = page.url().split("/").pop()!;
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Complete Encounter" }).click();
  await page.waitForURL(/\/clerking$/);

  expect(await getEncounterStatus(encounterId)).toBe("completed");

  await page.goto(`/clerking/${encounterId}`);
  await expect(page.getByRole("button", { name: "Complete Encounter" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Save chief complaint note" })).toBeDisabled();
});
