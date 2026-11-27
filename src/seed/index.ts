/**
 * Demo seed for e2e tests, screenshots and trying the app without a backend.
 * Loaded by src/main.tsx when VITE_DEMO=1 or the URL has ?demo=1.
 *
 * URL flags (demo mode only):
 *   ?demo=1             a set-up kitchen with this week's plan filled in
 *   ?demo=1&fresh=1     first run: recipes only, onboarding not done
 *   ?demo=1&noplan=1    set-up kitchen, empty plan
 *
 * The JSON files use our own ingredient slugs; inventory is mapped onto the real
 * catalog with matchLine() so it follows catalog changes without edits here.
 */
import type { AppSettings, CollectionName, InventoryEntry, PlanEntry, Recipe, Staple, StockStatus } from "@shared/types";
import { getItem, matchLine } from "@shared/catalog";
import { DEFAULT_SETTINGS, DEFAULT_STAPLES, addDays, weekStart, todayYmd } from "@shared/domain";
import recipesJson from "./recipes.json";
import ingredientsJson from "./ingredients.json";
import inventoryJson from "./inventory.json";

type SeedDoc = { c: CollectionName; id: string; data: unknown };

interface SeedRecipe {
  id: string; title: string; url: string; totalTimeMin: number; servings: number;
  tags: string[]; ingredients: { raw: string; ingredientId: string }[]; steps: string[];
}

/** Fixed clock so docs are stable across runs. */
const T0 = Date.UTC(2026, 10, 1);

export const seedRecipes: Recipe[] = (recipesJson as SeedRecipe[]).map((r, i) => ({
  id: `nyt-demo-${i + 1}`,
  source: "nyt",
  title: r.title,
  url: r.url,
  ingredients: r.ingredients.map(x => x.raw),
  steps: r.steps,
  totalMinutes: r.totalTimeMin,
  yield: `${r.servings} servings`,
  tags: r.tags,
  makesLeftovers: r.servings >= 4,
  addedAt: T0 + i * 60_000,
  updatedAt: T0 + i * 60_000,
}));

const recipeIdByTitle = (title: string) => seedRecipes.find(r => r.title === title)?.id;

const ingredientName = new Map((ingredientsJson as { id: string; name: string }[]).map(i => [i.id, i.name]));

/** Seed inventory mapped to catalog ids. Unknown slugs fall back to an exact catalog id. */
export function seedInventory(): InventoryEntry[] {
  const out = new Map<string, InventoryEntry>();
  for (const { ingredientId, status } of (inventoryJson as { items: { ingredientId: string; status: StockStatus }[] }).items) {
    const name = ingredientName.get(ingredientId) ?? ingredientId.replace(/-/g, " ");
    let ids = matchLine(name);
    if (!ids.length && getItem(ingredientId)) ids = [ingredientId];
    for (const itemId of ids) {
      // "have" wins over "low" wins over "out" when two seed items hit the same catalog id.
      const prev = out.get(itemId);
      const rank = { have: 2, low: 1, out: 0 } as const;
      if (!prev || rank[status] > rank[prev.status]) out.set(itemId, { itemId, status, updatedAt: T0 });
    }
  }
  return [...out.values()];
}

/** This week's plan: five dinners, leftovers and easy lunches, one night out. */
export function seedPlan(start = weekStart(todayYmd(), 1)): PlanEntry[] {
  const dinners = [
    "Paprika Chicken Thighs with Rice",
    "Garlic Butter Spaghetti with Peas",
    "Sheet-Pan Lemon Chicken with Broccoli",
    "Beef Tacos with Crunchy Slaw",
    "One-Pot Chili Mac",
    null,
    "Sunday Pot Roast with Carrots and Potatoes",
  ];
  const out: PlanEntry[] = [];
  dinners.forEach((title, i) => {
    const date = addDays(start, i);
    const refId = title ? recipeIdByTitle(title) : undefined;
    out.push(refId
      ? { id: `${date}:dinner`, date, meal: "dinner", kind: "recipe", refId, updatedAt: T0 }
      : { id: `${date}:dinner`, date, meal: "dinner", kind: "none", note: "Pizza night out", updatedAt: T0 });
    if (i > 0 && dinners[i - 1]) {
      const prevId = recipeIdByTitle(dinners[i - 1]!);
      if (prevId) out.push({ id: `${date}:lunch`, date, meal: "lunch", kind: "leftovers", refId: prevId, fromDate: addDays(start, i - 1), updatedAt: T0 });
    }
  });
  return out;
}

function params(): URLSearchParams {
  return typeof location === "undefined" ? new URLSearchParams() : new URLSearchParams(location.search);
}

export function buildSeedDocs(opts: { fresh?: boolean; noPlan?: boolean } = {}): SeedDoc[] {
  const docs: SeedDoc[] = seedRecipes.map(r => ({ c: "recipes", id: r.id, data: r }));
  const settings: AppSettings = { ...DEFAULT_SETTINGS, onboardingComplete: !opts.fresh, updatedAt: T0 };
  docs.push({ c: "settings", id: "app", data: settings });
  if (opts.fresh) return docs;

  for (const e of seedInventory()) docs.push({ c: "inventory", id: e.itemId, data: e });
  for (const s of DEFAULT_STAPLES) {
    const staple: Staple = { ...s, active: true, updatedAt: T0 };
    docs.push({ c: "staples", id: s.id, data: staple });
  }
  if (!opts.noPlan) for (const p of seedPlan()) docs.push({ c: "plan", id: p.id, data: p });
  return docs;
}

const p = params();
export const seedDocs: SeedDoc[] = buildSeedDocs({ fresh: p.has("fresh"), noPlan: p.has("noplan") });
