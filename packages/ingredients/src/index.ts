/**
 * @cookin/ingredients — the ingredient catalog, recipe line parser, and pantry matcher.
 * Pure functions, no dependencies, JSON-serializable results.
 */
export type {
  Location, Category, CatalogItem, ParsedIngredient, Owned, RecipeLike,
  IngredientStatus, RecipeAnalysis, ShoppingNeed,
} from './types';

export {
  CATALOG, CATEGORIES, SELECTABLE_ITEMS, getItem, allItems, setCustomItems, isSelectable, catalogByLocation, commonItemIds,
  searchCatalog, buildIndex, getIndex, resolveId, legacyIdsFor, listNameOf, LEGACY_IDS,
} from './catalog';
export type { CatalogIndex, CategoryWithItems } from './catalog';

export { parseIngredientLine, parseIngredients, matchGroups } from './parse';

export {
  makeHas, findSubstitute, missingFor, analyzeRecipe, missingForRecipe, makeableRecipes, missingForRecipes, recipeItemIds,
} from './match';
export type { MakeableOptions, AnalyzeOptions } from './match';

export { normalizePhrase, normalizeTokens, singularize } from './normalize';
