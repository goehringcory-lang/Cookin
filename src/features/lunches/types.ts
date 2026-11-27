/**
 * Lunch feature types. The shared contract (PlanEntry, LunchIdea, ListReason)
 * lives in src/shared/types.ts; these add what the lunch logic needs on top.
 */
import type { LunchIdea, ListReason, StockStatus } from "@shared/types";

/** Catalog ingredient id, e.g. "peanut-butter". */
export type CatalogId = string;

/**
 * What's in the kitchen. Accepts the shared `useOwned()` Set (have + low), a
 * full status map (lets the picker flag "running low"), or a predicate.
 */
export type Kitchen = ReadonlySet<CatalogId> | Readonly<Record<CatalogId, StockStatus>> | ((id: CatalogId) => boolean);

/** An ISO date, "YYYY-MM-DD", local time. */
export type ISODate = string;

/** One requirement. `anyOf` lists interchangeable catalog items, preferred first. */
export interface LunchIngredient {
  anyOf: CatalogId[];
  /** Nice to have. Never blocks "ready now" and never goes on the list. */
  optional?: boolean;
  /** Display label for the group, e.g. "Fruit". */
  label?: string;
}

export type LunchStyle =
  /** Eaten at home, usually hot. */
  | "home"
  /** Packs well in a lunchbox, no reheating. */
  | "lunchbox"
  /** Either. */
  | "both";

/** A library lunch. Satisfies the shared LunchIdea, plus swaps and how-to. */
export interface LibraryLunch extends LunchIdea {
  emoji: string;
  style: LunchStyle;
  minutes: number;
  kidFriendly: boolean;
  ingredients: LunchIngredient[];
  /** One line, shown in the picker. */
  howTo: string;
  /** Same-family lunches (all the peanut butter ones) get spread across the week. */
  family?: string;
  tags?: string[];
}

/** A dinner on the week's plan, as the lunch logic sees it. */
export interface PlannedDinner {
  date: ISODate;
  recipeId: string;
  title: string;
  /** Servings the recipe makes, parsed from its yield, if known. */
  servings?: number;
  /** Recipe.makesLeftovers. Undefined = estimate from servings. */
  makesLeftovers?: boolean;
  /** Catalog ids the dinner uses. */
  ingredientIds?: CatalogId[];
  /** Catalog ids the dinner still needs to buy. */
  missingIds?: CatalogId[];
}

/** What fills a lunch slot; maps 1:1 onto a lunch PlanEntry. */
export type LunchChoice =
  | { type: "idea"; lunchId: string }
  | { type: "leftovers"; fromDate: ISODate; recipeId: string; title?: string }
  | { type: "none"; note?: string };

export interface LunchSettings {
  /** People eating dinner (AppSettings.householdSize; Cory: 3, with a toddler and a newborn). */
  householdSize: number;
  /** Leftover portions needed for a dinner to count as covering lunch. */
  leftoverPortionsForLunch: number;
  /** Fill Saturday and Sunday lunches too. */
  includeWeekends: boolean;
}

export const DEFAULT_LUNCH_SETTINGS: LunchSettings = {
  householdSize: 3,
  leftoverPortionsForLunch: 2,
  includeWeekends: true,
};

/** ready = all owned. short = 1 or 2 missing. needs = more. */
export type Readiness = "ready" | "short" | "needs";

export interface LunchMatch {
  idea: LibraryLunch;
  readiness: Readiness;
  /** One catalog id per missing required group (its first option). */
  missing: CatalogId[];
  /** Owned ids that are running low (only when the kitchen has statuses). */
  low: CatalogId[];
  score: number;
  /** Short reasons for the suggestion, e.g. "Ready now". */
  reasons: string[];
}

/** One line the lunches add to the shopping list. */
export interface LunchShoppingNeed {
  itemId: CatalogId;
  name: string;
  reasons: Extract<ListReason, { type: "lunch" }>[];
}
