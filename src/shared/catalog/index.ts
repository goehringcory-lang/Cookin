/**
 * App-facing catalog + matcher API. Features import only from "@shared/catalog".
 * The implementation lives in packages/ingredients (catalog thread); this file keeps the
 * stable names and shapes the features were built against, and adds richer extras.
 */
import type { CatalogItem as SharedCatalogItem, Location } from "../types";
import * as ing from "../../../packages/ingredients/src";
import type { ParsedIngredient, RecipeAnalysis as DetailedAnalysis } from "../../../packages/ingredients/src";
export type { DetailedAnalysis };

export type { ParsedIngredient, ShoppingNeed, Category } from "../../../packages/ingredients/src";
export {
  parseIngredientLine, parseIngredients, missingFor, missingForRecipe, missingForRecipes, recipeItemIds,
  makeHas, commonItemIds, CATEGORIES,
} from "../../../packages/ingredients/src";

export const LOCATION_NAMES: Record<Location, string> = { pantry: "Pantry", fridge: "Fridge", freezer: "Freezer" };

const CATEGORY_NAME = new Map(ing.CATEGORIES.map((c) => [c.id, c.name]));

/** Convert a package item to the shared shape: `category` is the section heading. */
function toShared(i: ing.CatalogItem): SharedCatalogItem {
  const out: SharedCatalogItem = {
    id: i.id, name: i.name, location: i.location, category: CATEGORY_NAME.get(i.category) ?? i.category,
    aliases: i.aliases,
  };
  if (i.common) out.common = true;
  if (i.assumed) out.assumed = true;
  if (i.satisfies?.length) out.satisfies = i.satisfies;
  if ((i as SharedCatalogItem).custom) out.custom = true;
  return out;
}

/** Selectable built-in items (no assumed or generic terms), in onboarding order. */
export const CATALOG: SharedCatalogItem[] = ing.SELECTABLE_ITEMS.map(toShared);

/** Rebuild the matcher with Cory's custom items (collection `customItems`). Cheap; call when they change. */
export function setCustomItems(custom: SharedCatalogItem[]): void {
  ing.setCustomItems(custom.map((c) => ({ ...c, custom: true, common: !!c.common, aliases: c.aliases ?? [] })));
}

export function getItem(id: string): SharedCatalogItem | undefined {
  const i = ing.getItem(id);
  return i ? toShared(i) : undefined;
}

/** Every selectable item, built-in and custom. */
export const allItems = (): SharedCatalogItem[] => ing.allItems().filter(ing.isSelectable).map(toShared);

/** Search by name or alias, best matches first. Empty query returns everything. */
export function searchCatalog(q: string, limit = 30): SharedCatalogItem[] {
  if (!q.trim()) return allItems();
  return ing.searchCatalog(q, limit).map(toShared);
}

/** Sections for onboarding/inventory, in walkthrough order. Custom items go last as "Added by you". */
export function catalogGroups(location: Location): { category: string; items: SharedCatalogItem[] }[] {
  const groups = ing.catalogByLocation(location).map((c) => ({ category: c.name, items: c.items.map(toShared) }));
  const custom = allItems().filter((i) => i.custom && i.location === location);
  if (custom.length) groups.push({ category: "Added by you", items: custom });
  return groups;
}

/** Catalog ids an ingredient line refers to (may be several, e.g. "salt and pepper"). */
export function matchLine(line: string): string[] {
  return [...new Set(ing.parseIngredientLine(line).groups.map((g) => g[0]!))];
}

export type Owned = ing.Owned;

export type LineStatus = "have" | "missing" | "optional" | "unknown" | "ignored";

export interface RecipeAnalysis {
  /** Catalog ids the recipe needs that are owned. */
  have: string[];
  /** Catalog ids the recipe needs (required lines) that are not owned: the shopping list. */
  missing: string[];
  /** Catalog ids from optional, to-taste, or garnish lines that are not owned. Never block cooking. */
  optionalMissing: string[];
  /** Ingredient lines that matched nothing in the catalog. */
  unknown: string[];
  /** Per line detail, in recipe order. `ids` = first alternative of each group. */
  lines: { line: string; ids: string[]; status: LineStatus; parsed: ParsedIngredient }[];
  /** Share of required, matched lines you have, 0..1 (1 when nothing is tracked). */
  coverage: number;
  /** Every required ingredient is owned. */
  canMake: boolean;
  /** The full package analysis (have/missing per line, with parsed quantities). */
  detail: DetailedAnalysis;
}

export function analyzeRecipe(recipe: { id?: string; ingredients: string[] }, owned: Owned): RecipeAnalysis {
  const has = ing.makeHas(owned);
  const detail = ing.analyzeRecipe({ id: recipe.id ?? "", ingredients: recipe.ingredients ?? [] }, has);
  const have = new Set<string>();
  const statusOf = new Map<ParsedIngredient, LineStatus>();
  for (const s of detail.have) statusOf.set(s.line, "have");
  for (const s of detail.missing) statusOf.set(s.line, "missing");
  for (const s of detail.optionalMissing) statusOf.set(s.line, "optional");
  for (const l of detail.unknown) statusOf.set(l, "unknown");

  const parsed = [...detail.have, ...detail.missing, ...detail.optionalMissing].map((s) => s.line)
    .concat(detail.unknown);
  const byRaw = new Map<string, ParsedIngredient>();
  for (const p of parsed) if (!byRaw.has(p.raw)) byRaw.set(p.raw, p);

  const lines = (recipe.ingredients ?? []).map((line) => {
    const p = byRaw.get(line) ?? ing.parseIngredientLine(line);
    const ids = [...new Set(p.groups.map((g) => g.find(has) ?? g[0]!))];
    const status: LineStatus = statusOf.get(p) ?? (p.unmatched ? "ignored" : p.assumedOnly ? "ignored" : "have");
    if (status === "have") for (const id of ids) if (has(id) && !getItemAssumed(id)) have.add(id);
    return { line, ids, status, parsed: p };
  });

  const optionalMissing = [...new Set(detail.optionalMissing.flatMap((s) => s.missing))];
  return {
    have: [...have],
    missing: detail.missingIds,
    optionalMissing,
    unknown: detail.unknown.map((l) => l.raw),
    lines,
    coverage: detail.coverage,
    canMake: detail.canMake,
    detail,
  };
}

function getItemAssumed(id: string): boolean {
  return !!ing.getItem(id)?.assumed;
}

/** Recipes ranked for "you can make this now": canMake first, then by fewest missing. */
export function makeableRecipes<R extends { id?: string; ingredients: string[] }>(
  recipes: R[], owned: Owned, opts: { maxMissing?: number } = {},
): { recipe: R; analysis: RecipeAnalysis }[] {
  const max = opts.maxMissing ?? 0;
  const has = ing.makeHas(owned);
  return recipes.map((r) => ({ recipe: r, analysis: analyzeRecipe(r, has) }))
    .filter((x) => x.analysis.missing.length <= max)
    .sort((a, b) => a.analysis.missing.length - b.analysis.missing.length || b.analysis.coverage - a.analysis.coverage);
}

/** Clean display name from an unmatched line: "2 cups fresh tarragon, chopped" -> "Fresh tarragon". */
export function cleanIngredientName(line: string): string {
  const name = ing.parseIngredientLine(line).name
    .replace(/^(large|medium|small|whole|about|plus)\s+/i, "")
    .replace(/\s+/g, " ").trim();
  return name ? name[0]!.toUpperCase() + name.slice(1) : String(line).trim();
}
