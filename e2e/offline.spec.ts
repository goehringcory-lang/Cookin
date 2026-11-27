import { test, expect } from "./fixtures";

// Real (non-demo) mode registers the service worker. The preview server has no /api,
// so sync errors are expected here; this only checks the app shell opens offline.
test("opens with no signal after the first visit", async ({ page, context, errors }) => {
  await page.goto("/");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("#root")).not.toBeEmpty();
  await context.setOffline(false);
  errors.length = 0; // failed /api calls while offline are expected
});
