import type {
  IngredientStatus, Owned, ParsedIngredient, RecipeAnalysis, RecipeLike, ShoppingNeed,
} from './types';
import { getIndex, legacyIdsFor, resolveId, type CatalogIndex } from './catalog';
import { parseIngredients } from './parse';

/** Turn any Owned shape into a predicate. */
function toPredicate(owned: Owned): (id: string) => boolean {
  if (typeof owned === 'function') return owned;
  const set = owned instanceof Set ? owned : new Set(owned as readonly string[]);
  return (id) => set.has(id);
}

/**
 * Build an "is this id covered?" check that understands assumed items (salt, water) and
 * generics (owning penne covers "short pasta"; owning extra-virgin olive oil covers "olive oil").
 */
export function makeHas(owned: Owned, index: CatalogIndex = getIndex()): (id: string) => boolean {
  const rawOwn = toPredicate(owned);
  const own = (id: string) => rawOwn(id) || legacyIdsFor(id).some(rawOwn);
  const cache = new Map<string, boolean>();
  return (query: string) => {
    const id = resolveId(query);
    const hit = cache.get(id);
    if (hit !== undefined) return hit;
    let ok = index.assumed.has(id) || own(id);
    if (!ok) {
      const by = index.satisfiedBy.get(id);
      if (by) for (const other of by) if (own(other)) { ok = true; break; }
    }
    cache.set(id, ok);
    return ok;
  };
}

/** Of these catalog ids, which are not covered by what you own? Order preserved, duplicates removed. */
export function missingFor(ingredientIds: readonly string[], owned: Owned, index: CatalogIndex = getIndex()): string[] {
  const has = makeHas(owned, index);
  return [...new Set(ingredientIds.map(resolveId))].filter((id) => !has(id));
}

function parsedOf(recipe: RecipeLike, index: CatalogIndex): ParsedIngredient[] {
  return recipe.parsed ?? parseIngredients(recipe.ingredients, index);
}

function isSoft(line: ParsedIngredient): boolean {
  return line.optional || line.toTaste || line.garnish;
}

/** Sort each recipe line into have / missing / optional-missing / unknown. */
export function analyzeRecipe(recipe: RecipeLike, owned: Owned, index: CatalogIndex = getIndex()): RecipeAnalysis {
  const has = makeHas(owned, index);
  const out: RecipeAnalysis = {
    recipeId: recipe.id, have: [], missing: [], optionalMissing: [], unknown: [],
    missingIds: [], coverage: 1, canMake: true,
  };
  const missingIds = new Set<string>();
  for (const line of parsedOf(recipe, index)) {
    if (line.unmatched) {
      if (line.name.trim()) out.unknown.push(line);
      continue;
    }
    if (line.assumedOnly) continue;
    const unmet = line.groups.filter((g) => !g.some(has));
    const status: IngredientStatus = { line, missing: unmet.map((g) => g[0]!).filter(Boolean) };
    if (unmet.length === 0) out.have.push(status);
    else if (isSoft(line)) out.optionalMissing.push(status);
    else {
      out.missing.push(status);
      for (const id of status.missing) missingIds.add(id);
    }
  }
  const required = out.have.filter((s) => !isSoft(s.line)).length + out.missing.length;
  out.missingIds = [...missingIds];
  out.coverage = required === 0 ? 1 : Math.round(((required - out.missing.length) / required) * 1000) / 1000;
  out.canMake = out.missing.length === 0;
  return out;
}

/** Catalog ids to buy for one recipe. */
export function missingForRecipe(recipe: RecipeLike, owned: Owned, index: CatalogIndex = getIndex()): string[] {
  return analyzeRecipe(recipe, owned, index).missingIds;
}

export interface MakeableOptions {
  /** Allow up to this many missing required items. Default 0 (fully makeable now). */
  maxMissing?: number;
}

/**
 * Recipes you can make with what you own, best first: fewest missing items, then highest
 * coverage. Each result is the full analysis so the UI can mark owned ingredients.
 */
export function makeableRecipes(
  recipes: readonly RecipeLike[], owned: Owned, opts: MakeableOptions = {}, index: CatalogIndex = getIndex(),
): RecipeAnalysis[] {
  const max = opts.maxMissing ?? 0;
  const has = makeHas(owned, index);
  return recipes
    .map((r) => analyzeRecipe(r, has, index))
    .filter((a) => a.missingIds.length <= max)
    .sort((a, b) => a.missingIds.length - b.missingIds.length || b.coverage - a.coverage);
}

/**
 * Everything missing across a set of recipes (a week's plan), merged by item, in first-seen order.
 * Optional, to-taste and garnish lines are left out.
 */
export function missingForRecipes(
  recipes: readonly RecipeLike[], owned: Owned, index: CatalogIndex = getIndex(),
): ShoppingNeed[] {
  const has = makeHas(owned, index);
  const needs = new Map<string, ShoppingNeed>();
  for (const r of recipes) {
    for (const s of analyzeRecipe(r, has, index).missing) {
      for (const id of s.missing) {
        let n = needs.get(id);
        if (!n) { n = { itemId: id, recipeIds: [], lines: [] }; needs.set(id, n); }
        if (!n.recipeIds.includes(r.id)) n.recipeIds.push(r.id);
        n.lines.push(s.line.raw);
      }
    }
  }
  return [...needs.values()];
}

/** Every catalog id a recipe uses (first alternative of each group), excluding assumed items. */
export function recipeItemIds(recipe: RecipeLike, index: CatalogIndex = getIndex()): string[] {
  const ids = new Set<string>();
  for (const line of parsedOf(recipe, index)) {
    for (const g of line.groups) {
      if (g.some((id) => index.assumed.has(id))) continue;
      if (g[0]) ids.add(g[0]);
    }
  }
  return [...ids];
}
