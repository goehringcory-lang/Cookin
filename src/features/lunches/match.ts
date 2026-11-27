/** Checks one library lunch against what's in the kitchen. */
import { isOwned, statusOf } from "./kitchen";
import type { CatalogId, Kitchen, LibraryLunch, LunchIngredient, Readiness } from "./types";

export interface IngredientCheck {
  ingredient: LunchIngredient;
  /** The owned option used, if any: a fully stocked one first, then a low one. */
  using?: CatalogId;
  low: boolean;
}

export function checkIngredient(ing: LunchIngredient, kitchen: Kitchen): IngredientCheck {
  const have = ing.anyOf.find((id) => statusOf(id, kitchen) === "have");
  if (have) return { ingredient: ing, using: have, low: false };
  const low = ing.anyOf.find((id) => isOwned(id, kitchen));
  if (low) return { ingredient: ing, using: low, low: true };
  return { ingredient: ing, low: false };
}

export interface IdeaCheck {
  readiness: Readiness;
  missing: CatalogId[];
  low: CatalogId[];
  checks: IngredientCheck[];
}

export function checkIdea(idea: LibraryLunch, kitchen: Kitchen): IdeaCheck {
  const checks = idea.ingredients.map((ing) => checkIngredient(ing, kitchen));
  const missing: CatalogId[] = [];
  const low: CatalogId[] = [];
  for (const c of checks) {
    if (c.using && c.low) low.push(c.using);
    if (!c.using && !c.ingredient.optional && !missing.includes(c.ingredient.anyOf[0])) missing.push(c.ingredient.anyOf[0]);
  }
  const readiness: Readiness = missing.length === 0 ? "ready" : missing.length <= 2 ? "short" : "needs";
  return { readiness, missing, low, checks };
}
