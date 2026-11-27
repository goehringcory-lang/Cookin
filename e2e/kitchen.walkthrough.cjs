// Phone walkthrough of the Kitchen screen. Run: npm run build && npx vite preview --port 4174 & node e2e/kitchen.walkthrough.cjs [outDir]
// Seeds localStorage directly, so it needs no backend and no seed module.
const { chromium, devices } = require("playwright");
const URL = process.env.KITCHEN_URL || "http://localhost:4174/?demo=1#kitchen";
const out = process.argv[2] || "e2e/shots";
const fs = require("fs");
fs.mkdirSync(out, { recursive: true });

const now = Date.now();
const today = new Date();
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
const have = ["all-purpose-flour", "granulated-sugar", "brown-sugar", "baking-soda", "baking-powder", "vanilla-extract", "honey", "rolled-oats",
  "olive-oil", "vegetable-oil", "red-wine-vinegar", "black-pepper", "ground-cumin", "smoked-paprika", "red-pepper-flakes", "ground-cinnamon",
  "chicken-broth", "canned-tomatoes", "chickpeas", "peanut-butter", "soy-sauce", "dijon-mustard", "spaghetti", "short-pasta", "white-rice",
  "sandwich-bread", "cereal", "onions", "garlic", "potatoes", "bananas", "lemons", "eggs", "milk", "butter", "cheddar", "parmesan", "greek-yogurt",
  "carrots", "spinach", "chicken-thighs", "bacon", "frozen-peas", "frozen-berries", "chicken-nuggets", "ice-cream"];
const status = { "olive-oil": "low", milk: "low", "all-purpose-flour": "out", "chicken-broth": "out" };
const docs = { inventory: {}, customItems: {}, recipes: {}, plan: {}, staples: {}, list: {}, settings: {} };
for (const id of have) docs.inventory[id] = { itemId: id, status: status[id] || "have", updatedAt: now };
docs.settings.app = { onboardingComplete: true, dinnersPerWeek: 7, householdSize: 3, weekStartsOn: 1, updatedAt: now };
docs.recipes["my-banana-bread"] = { id: "my-banana-bread", source: "manual", title: "Banana bread", ingredients: ["2 cups all-purpose flour", "3 ripe bananas", "1 stick butter", "1 cup sugar"], addedAt: now, updatedAt: now };
docs.plan[ymd(tomorrow) + ":dinner"] = { id: ymd(tomorrow) + ":dinner", date: ymd(tomorrow), meal: "dinner", kind: "recipe", refId: "my-banana-bread", updatedAt: now };

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices["iPhone 14"], colorScheme: process.env.DARK ? "dark" : "light" });
  await ctx.addInitScript((d) => {
    if (!sessionStorage.getItem("seeded")) {
      sessionStorage.setItem("seeded", "1");
      for (const k of Object.keys(localStorage)) localStorage.removeItem(k);
      localStorage.setItem("cookin:v1", JSON.stringify({ docs: d, meta: {}, cursor: 0, queue: [] }));
    }
  }, docs);
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  const shot = (n) => p.screenshot({ path: `${out}/${process.env.DARK ? "dark" : "light"}-${n}.png` });
  const expect = (cond, msg) => { if (!cond) { console.error("FAIL:", msg); process.exitCode = 1; } else console.log("ok:", msg); };
  const rowClass = (name) => p.locator(".inv-row", { has: p.locator(".inv-row__name", { hasText: new RegExp(`^${name}$`) }) }).first().getAttribute("class");

  await p.goto(URL);
  await p.waitForSelector(".inv-row");
  await shot("1-pantry");
  expect((await p.locator(".inv-row__status", { hasText: "Banana bread" }).count()) === 1, "flour shows it's needed for banana bread");

  await p.locator(".inv-row__main", { hasText: "Spaghetti" }).click();
  expect((await rowClass("Spaghetti")).includes("inv-row--out"), "tap marks Spaghetti out");
  await shot("2-tapped-out");
  await p.getByRole("button", { name: "Add to list", exact: true }).click();
  expect((await p.locator(".inv-row__status", { hasText: /^Out · on your list$/ }).count()) === 1, "Add to list from toast");
  await p.getByRole("button", { name: "Undo" }).click();
  expect((await p.locator(".inv-row__status", { hasText: /^Out · on your list$/ }).count()) === 0, "undo takes it off the list");

  await p.locator('.inv-row', { hasText: "Honey" }).getByRole("radio", { name: "Low" }).click();
  expect((await rowClass("Honey")).includes("inv-row--low"), "Low button marks Honey low");

  await p.getByRole("tab", { name: /Spices/ }).click();
  await shot("3-spices");
  await p.getByRole("tab", { name: /Fridge/ }).click();
  await shot("4-fridge");

  await p.getByLabel("Search your kitchen").fill("flour");
  await p.waitForTimeout(150);
  await shot("5-search");
  await p.getByLabel("Search your kitchen").fill("gochujang");
  await p.waitForTimeout(150);
  await p.locator(".inv-row__main", { hasText: "Gochujang" }).first().click();
  expect((await p.locator(".inv-toast", { hasText: "Added Gochujang" }).count()) === 1, "add from catalog via search");
  await p.getByLabel("Search your kitchen").fill("fig bars");
  await p.waitForTimeout(150);
  await p.getByText('Add "fig bars" as a new item').click();
  await shot("6-add-custom");
  await p.getByRole("button", { name: "Add to kitchen" }).click();
  expect((await p.locator(".inv-row__name", { hasText: "Fig bars" }).count()) === 1, "custom item added");

  await p.getByRole("button", { name: /Just shopped/ }).click();
  await p.waitForTimeout(300);
  await shot("7-restock");
  await p.getByRole("button", { name: /^Restock \d+ items?$/ }).click();
  await p.waitForTimeout(200);
  await shot("8-restocked");

  const row = p.locator(".inv-row__main", { hasText: "Eggs" }).first();
  await p.getByRole("tab", { name: /Fridge/ }).click();
  const bb = await row.boundingBox();
  await p.mouse.move(bb.x + 40, bb.y + 20); await p.mouse.down(); await p.waitForTimeout(600); await p.mouse.up();
  await p.waitForTimeout(300);
  await shot("9-edit");
  await p.getByRole("button", { name: "I don't keep this anymore" }).click();
  expect((await p.locator(".inv-row__name", { hasText: /^Eggs$/ }).count()) === 0, "remove from kitchen");

  expect(errs.length === 0, "no console errors " + errs.join(" | "));
  await b.close();
})();
