import { test as base, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/** Every test fails on uncaught page errors or console.error output. */
export const test = base.extend<{ errors: string[] }>({
  errors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", e => errors.push(`pageerror: ${e.message}`));
      page.on("console", m => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
      await use(errors);
      expect(errors, "page errors").toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

/** Open the app in demo mode. flags: "fresh" (first run), "noplan". */
export async function openDemo(page: Page, route = "home", ...flags: string[]) {
  const q = ["demo=1", ...flags.map(f => `${f}=1`)].join("&");
  await page.goto(`/?${q}#${route}`);
  await expect(page.locator("#root")).not.toBeEmpty();
}

/** Nothing on the page should be wider than the phone screen. */
export async function expectNoHorizontalScroll(page: Page) {
  const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(scroll, "page scrolls sideways").toBeLessThanOrEqual(client + 1);
}

/** Tap targets at least 44x44 CSS px (Apple HIG), for visible buttons and links. */
export async function smallTapTargets(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>("button, a[href], [role=button], input[type=checkbox], input[type=radio]")) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const label = el.getAttribute("aria-label") || el.textContent?.trim().slice(0, 30) || el.tagName;
      // Checkboxes inside a full-row label are fine: measure the label instead.
      const box = (el.closest("label") ?? el).getBoundingClientRect();
      // Half-pixel tolerance: sheets render at fractional sizes (43.9px) mid-layout.
      if (box.height < 43.5 || box.width < 43.5) out.push(`${label} (${Math.round(box.width)}x${Math.round(box.height)})`);
    }
    return out;
  });
}

/** Serious and critical axe violations (WCAG 2.1 A/AA). */
export async function axeViolations(page: Page) {
  const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return res.violations
    .filter(v => v.impact === "serious" || v.impact === "critical")
    .map(v => `${v.id}: ${v.help} (${v.nodes.length}) e.g. ${v.nodes[0]?.target.join(" ")}`);
}
