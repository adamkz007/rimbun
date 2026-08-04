import { expect, type Page } from "@playwright/test";

export const DEMO_DOCTOR = {
  email: "doctor@demo.rimbun.local",
  password: "Rimbun123!",
};

export const DEMO_ADMIN = {
  email: "admin@demo.rimbun.local",
  password: "Rimbun123!",
};

export async function login(page: Page, credentials = DEMO_DOCTOR) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard");
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening)/ })).toBeVisible();
}

export function uniquePatientName(prefix: string) {
  return `${prefix} ${Date.now()}`;
}
