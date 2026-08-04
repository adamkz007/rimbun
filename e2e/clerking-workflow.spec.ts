import { expect, test } from "@playwright/test";
import { login, uniquePatientName } from "./helpers/auth";

async function registerPatient(page: import("@playwright/test").Page, name: string) {
  await page.goto("/patients");
  await page.getByRole("button", { name: "Register Patient" }).click();
  await page.getByLabel("Full Name").fill(name);
  await page.getByLabel("Phone").fill("+60123456789");
  await page.getByRole("button", { name: "Register Patient" }).click();
  await expect(page.getByText(name)).toBeVisible();
}

async function startEncounterForPatient(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Start Encounter" }).first().click();
  await page.waitForURL(/\/clerking\/.+/);
}

test("autosaves a chief complaint note in clerking", async ({ page }) => {
  const patientName = uniquePatientName("Note Patient");
  await login(page);
  await registerPatient(page, patientName);
  await startEncounterForPatient(page);

  const editor = page.locator(".ProseMirror").first();
  await editor.click();
  await editor.fill("Persistent cough for three days.");

  await page.getByRole("button", { name: "Save chief complaint note" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();

  const encounterUrl = page.url();
  await page.reload();
  await expect(page.locator(".ProseMirror").first()).toContainText("Persistent cough for three days.");
  await expect(page).toHaveURL(encounterUrl);
});
