import type { Page } from "@playwright/test";
import { expect, openDemo } from "./fixtures";

/** Wednesday 25 Nov 2026, noon: the demo plan is Mon-Sun of that week, so "tonight" is Sunday-independent. */
export const FIXED_NOW = new Date(2026, 10, 25, 12, 0, 0);

/** Pin the clock (Date only; timers keep running) and open the demo app. */
export async function openDemoAt(page: Page, route = "home", ...flags: string[]) {
  await page.clock.setFixedTime(FIXED_NOW);
  await openDemo(page, route, ...flags);
}

export const TONIGHT_TITLE = "Sheet-Pan Lemon Chicken with Broccoli";

export const tabBar = (page: Page) => page.getByRole("navigation", { name: "Sections" });
export const goTab = async (page: Page, label: string) => {
  await tabBar(page).getByRole("button", { name: label }).click();
};

/** Visible text of the "Swap options" section titles etc. */
export async function expectOnScreen(page: Page, heading: string | RegExp) {
  await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
}
