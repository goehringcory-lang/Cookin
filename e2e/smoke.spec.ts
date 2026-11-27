import { test, expect, openDemo, expectNoHorizontalScroll, axeViolations } from "./fixtures";

const TABS = [
  { route: "home", label: "This week" },
  { route: "list", label: "List" },
  { route: "kitchen", label: "Kitchen" },
  { route: "recipes", label: "Recipes" },
];

test.describe("app shell at phone size", () => {
  test("opens on this week with the tab bar", async ({ page }) => {
    await openDemo(page);
    const nav = page.getByRole("navigation", { name: "Sections" });
    await expect(nav).toBeVisible();
    for (const t of TABS) await expect(nav.getByRole("button", { name: t.label })).toBeVisible();
    await expect(nav.getByRole("button", { name: "This week" })).toHaveAttribute("aria-current", "page");
  });

  for (const t of TABS) {
    test(`${t.label} tab fits the screen and has no serious a11y issues`, async ({ page }) => {
      await openDemo(page);
      await page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: t.label }).click();
      await expect(page).toHaveURL(new RegExp(`#${t.route}$`));
      await expectNoHorizontalScroll(page);
      expect(await axeViolations(page)).toEqual([]);
    });
  }

  test("tab bar stays on screen after scrolling", async ({ page }) => {
    await openDemo(page, "recipes");
    await page.mouse.wheel(0, 3000);
    const box = await page.getByRole("navigation", { name: "Sections" }).boundingBox();
    const vh = page.viewportSize()!.height;
    expect(box && box.y + box.height).toBeLessThanOrEqual(vh + 1);
  });

  test("first run goes to onboarding", async ({ page }) => {
    await openDemo(page, "home", "fresh");
    await expect(page.getByRole("navigation", { name: "Sections" })).toHaveCount(0);
  });
});

test.describe("installable PWA", () => {
  test("manifest is linked and complete", async ({ page, request }) => {
    await openDemo(page);
    const href = await page.locator('link[rel="manifest"]').getAttribute("href");
    expect(href).toBeTruthy();
    const res = await request.get(href!);
    expect(res.ok()).toBe(true);
    const m = await res.json();
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBeTruthy();
    const sizes = m.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    expect(m.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);
    for (const i of m.icons) expect((await request.get(i.src)).ok(), i.src).toBe(true);
  });

  test("iPhone home-screen tags are present", async ({ page, request }) => {
    await openDemo(page);
    const touch = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
    expect((await request.get(touch!)).ok()).toBe(true);
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute("content", "yes");
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", /viewport-fit=cover/);
  });

  test("service worker script is served", async ({ request }) => {
    const res = await request.get("/sw.js");
    expect(res.ok()).toBe(true);
    expect(await res.text()).toContain("addEventListener('fetch'");
  });
});
