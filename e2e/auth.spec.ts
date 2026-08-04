import { expect, test } from "@playwright/test";
import { DEMO_ADMIN, login } from "./helpers/auth";

test("login rejects invalid credentials", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("doctor@demo.rimbun.local");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(/invalid/i)).toBeVisible();
});

test("doctor can sign in and reach dashboard", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("admin can sign in and reach dashboard", async ({ page }) => {
  await login(page, DEMO_ADMIN);
  await expect(page).toHaveURL(/\/dashboard$/);
});
