import { test, expect } from "@playwright/test";

test.describe("Profile FD Save Fix", () => {
  test("should save FD value without 'Cannot create property' error", async ({
    page,
    context,
  }) => {
    // Navigate to app
    await page.goto("http://localhost:5173");
    await page.waitForLoadState("networkidle");

    // Collect console errors
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    // Find and fill FD input
    const fdInput = page.locator("#fd");
    await expect(fdInput).toBeVisible({ timeout: 10000 });
    await fdInput.fill("540000");
    await fdInput.blur();

    // Wait for save
    await page.waitForTimeout(1500);

    // Check for specific error
    const hasPropertyError = consoleErrors.some((e) =>
      e.includes("Cannot create property")
    );

    // Check localStorage
    const storageData = await page.evaluate(() => {
      const stored = localStorage.getItem("fireOS_v2");
      if (stored) {
        const data = JSON.parse(stored);
        return {
          fd_is_object: typeof data.fd === "object",
          fd_amount: data.fd?.fd?.amount,
        };
      }
      return null;
    });

    console.log("Storage data:", storageData);
    console.log("Property error found:", hasPropertyError);

    expect(hasPropertyError).toBe(false);
    expect(storageData?.fd_is_object).toBe(true);
    expect(storageData?.fd_amount).toBe(540000);
  });
});
