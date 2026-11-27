/** Bridges the shared plan + recipes into what the lunch logic needs. Pure. */
import { analyzeRecipe } from "@shared/catalog";
import type { PlanEntry, Recipe } from "@shared/types";
import { parseServings } from "./leftovers";
import type { Kitchen, PlannedDinner } from "./types";

const ownedFn = (k: Kitchen) =>
  typeof k === "function"
    ? k
    : k instanceof Set
      ? (id: string) => k.has(id)
      : (id: string) => {
          const s = (k as Record<string, string>)[id];
          return s === "have" || s === "low";
        };

export function toPlannedDinner(entry: PlanEntry, recipe: Recipe | undefined, kitchen?: Kitchen): PlannedDinner | undefined {
  if (entry.meal !== "dinner" || entry.kind !== "recipe" || !entry.refId) return undefined;
  const a = recipe && kitchen ? analyzeRecipe(recipe, ownedFn(kitchen)) : undefined;
  return {
    date: entry.date,
    recipeId: entry.refId,
    title: recipe?.title ?? "Dinner",
    servings: recipe?.servings ?? parseServings(recipe?.yield),
    makesLeftovers: recipe?.makesLeftovers,
    ingredientIds: a ? [...a.have, ...a.missing] : undefined,
    missingIds: a?.missing,
  };
}

/** Dinners on the plan, sorted by date. Accepts usePlanWeek()'s Record or an array. */
export function plannedDinners(
  plan: readonly PlanEntry[] | Readonly<Record<string, PlanEntry>>,
  recipes: Readonly<Record<string, Recipe>>,
  kitchen?: Kitchen,
): PlannedDinner[] {
  const entries = Array.isArray(plan) ? plan : Object.values(plan);
  return entries
    .map((e) => toPlannedDinner(e, e.refId ? recipes[e.refId] : undefined, kitchen))
    .filter((d): d is PlannedDinner => !!d)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function lunchEntries(plan: readonly PlanEntry[] | Readonly<Record<string, PlanEntry>>): PlanEntry[] {
  const entries = Array.isArray(plan) ? plan : Object.values(plan);
  return entries.filter((e) => e.meal === "lunch").sort((a, b) => a.date.localeCompare(b.date));
}
