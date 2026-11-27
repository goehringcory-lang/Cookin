/**
 * Cookin shared data model. This file is the contract between feature modules.
 * Change it only through the lead thread (see docs/ARCHITECTURE.md).
 *
 * Everything is stored as JSON documents in named collections (see `Collections`).
 * Each document has a string id that is unique within its collection.
 */

/* ---------- ingredient catalog (owned by the catalog module) ---------- */

export type Location = "pantry" | "fridge" | "freezer";

export interface CatalogItem {
  /** Stable kebab-case slug, e.g. "short-pasta", "peanut-butter". Never rename once shipped. */
  id: string;
  name: string;
  location: Location;
  /** Onboarding / inventory section heading, e.g. "Pasta & noodles". */
  category: string;
  aliases: string[];
  /** Pre-checked during onboarding because most kitchens have it. */
  common?: boolean;
  /** Always treated as owned and never listed (salt, water, ice). */
  assumed?: boolean;
  /** This item also satisfies these more generic ids (penne -> short-pasta). */
  satisfies?: string[];
  /** True for items Cory added himself (stored in `customItems`). */
  custom?: boolean;
  /** Shopping-list name when it differs from `name` ("Rice" for "Rice (any)"). Use listNameOf(id). */
  listName?: string;
}

/* ---------- inventory ---------- */

/** have = in stock; low = in stock but running low (goes on the list); out = used up. */
export type StockStatus = "have" | "low" | "out";

/** Collection `inventory`, doc id = CatalogItem.id. No doc means "not in the kitchen" (same as out). */
export interface InventoryEntry {
  itemId: string;
  status: StockStatus;
  updatedAt: number;
}

/* ---------- recipes ---------- */

export type RecipeSource = "nyt" | "manual";

/** Collection `recipes`, doc id = "nyt-<nyt numeric id>" or "my-<random>". */
export interface Recipe {
  id: string;
  source: RecipeSource;
  title: string;
  /** https URL of the recipe page (NYT Cooking for nyt recipes). */
  url?: string;
  /** Raw ingredient lines exactly as the source lists them. Matching to catalog ids happens at read time. */
  ingredients: string[];
  /** Optional raw instruction steps (NYT JSON-LD recipeInstructions). */
  steps?: string[];
  totalMinutes?: number;
  yield?: string;
  /** Numeric servings parsed from yield (e.g. "4 servings" -> 4). Planner scales by householdSize / servings. */
  servings?: number;
  /** Free-text categories/tags from the source, e.g. "dinner, weeknight". */
  tags?: string[];
  imageUrl?: string;
  /** Dinner usually makes enough for next-day lunch. Set by the user or a heuristic. */
  makesLeftovers?: boolean;
  /** Recipe no longer in the NYT Recipe Box; hidden from suggestions but kept for history. */
  archived?: boolean;
  addedAt: number;
  updatedAt: number;
}

/* ---------- meal plan ---------- */

export type Meal = "dinner" | "lunch";

/**
 * Collection `plan`, doc id = `${date}:${meal}` (e.g. "2026-11-30:dinner") for the main dish.
 * Extra dishes for the same slot (a side) use `${date}:${meal}:2`, `:3`, ...
 * kind:
 *  - recipe:    refId = Recipe.id
 *  - lunch:     refId = LunchIdea.id from the lunch library
 *  - leftovers: refId = Recipe.id being eaten again, fromDate = date it was cooked
 *  - none:      no cooking (eating out, on your own); note optional
 */
export interface PlanEntry {
  id: string;
  date: string; // YYYY-MM-DD, local time
  meal: Meal;
  kind: "recipe" | "lunch" | "leftovers" | "none";
  refId?: string;
  fromDate?: string;
  note?: string;
  servings?: number;
  /** Marked cooked; lets inventory offer "used up anything?" afterwards. */
  cooked?: boolean;
  updatedAt: number;
}

/** Built-in easy lunch (lives in code, not the database). */
export interface LunchIdea {
  id: string; // "l-grilled-cheese"
  name: string;
  items: string[]; // CatalogItem ids
  minutes?: number;
  kidFriendly?: boolean;
}

/* ---------- staples (always-buy items, kids' snacks) ---------- */

/**
 * Collection `staples`, doc id = slug of the name ("milk", "fig-bars").
 * when:
 *  - always:   on every week's list (milk, bananas)
 *  - when-low: only when its inventory item is low/out (needs itemId)
 */
export interface Staple {
  id: string;
  name: string;
  itemId?: string;
  kind: "staple" | "kids-snack" | "household";
  when: "always" | "when-low";
  active: boolean;
  updatedAt: number;
}

/* ---------- shopping list ---------- */

/** Why something is on the list. A line can have several reasons. */
export type ListReason =
  | { type: "recipe"; recipeId: string; title: string; date?: string }
  | { type: "lunch"; ideaId: string; name: string; date?: string }
  | { type: "low"; itemId: string }
  | { type: "staple"; stapleId: string }
  | { type: "manual" }
  | { type: "unmatched"; recipeId: string; line: string };

/** A derived list line (computed, not stored). key is stable across renders. */
export interface ListLine {
  /** "item:<catalogId>" | "staple:<id>" | "manual:<id>" | "text:<normalized text>" */
  key: string;
  name: string;
  itemId?: string;
  reasons: ListReason[];
  checked: boolean;
}

/**
 * Collection `list`: one small doc per entry so edits on two devices never clobber each other.
 *  - check:   id `check:<ListLine.key>`   checked off at the store during week `weekOf`
 *  - dismiss: id `dismiss:<ListLine.key>` hidden for week `weekOf` ("I have it" on an unmatched line)
 *  - manual:  id `manual:<random>`        typed in by hand; stays until bought (then deleted)
 * `weekOf` is the plan week start (YYYY-MM-DD); check/dismiss docs from other weeks are ignored.
 */
export interface ListEntry {
  id: string;
  type: "check" | "dismiss" | "manual";
  /** ListLine.key for check/dismiss. */
  key?: string;
  /** Display name for manual items. */
  name?: string;
  weekOf: string;
  updatedAt: number;
}

/* ---------- settings ---------- */

/** Collection `settings`, single doc id "app". */
export interface AppSettings {
  onboardingComplete: boolean;
  /** Dinners to plan per week (Cory: 7). */
  dinnersPerWeek: number;
  /** People eating (Cory: 3 = 2 adults + a toddler). Planner/list scale by this. */
  householdSize: number;
  /** 1 = Monday. */
  weekStartsOn: 0 | 1;
  updatedAt: number;
}

/** Collection `meta`, doc id "nyt": written by the server on each recipe import. */
export interface NytSyncInfo {
  at: number;
  total: number;
  added: number;
  updated: number;
  archived: number;
  via: "button" | "weekly";
  updatedAt: number;
}

/* ---------- collections registry ---------- */

export interface Collections {
  inventory: InventoryEntry;
  customItems: CatalogItem;
  recipes: Recipe;
  plan: PlanEntry;
  staples: Staple;
  list: ListEntry;
  settings: AppSettings;
  meta: NytSyncInfo;
}
export type CollectionName = keyof Collections;
export const COLLECTIONS: CollectionName[] = ["inventory", "customItems", "recipes", "plan", "staples", "list", "settings", "meta"];

/* ---------- sync wire format (client <-> /api) ---------- */

/** One document change. data null = deleted. */
export interface WireDoc {
  c: CollectionName;
  id: string;
  data: unknown | null;
  updatedAt: number;
  /** Server sequence number; present on docs coming from the server. */
  v?: number;
}
/** `more` = call again with the new cursor (the server pages at 500 docs). */
export interface SyncPullResponse { docs: WireDoc[]; cursor: number; more: boolean }
export interface SyncPushRequest { changes: WireDoc[] }
/** rejected = indexes of changes that were invalid and skipped (the client drops them). */
export interface SyncPushResponse { cursor: number; applied: number; rejected: number[] }

/** POST /api/import/recipes body (NYT bookmark button and weekly sync). */
export interface RecipeImportRequest {
  via: "button" | "weekly";
  /** Total recipes seen in the Recipe Box this run (for "archived" detection when complete=true). */
  total?: number;
  /** True when `recipes` is the whole Recipe Box, so missing nyt recipes may be archived. */
  complete?: boolean;
  recipes: Omit<Recipe, "addedAt" | "updatedAt" | "source">[];
}
export interface RecipeImportResponse { added: number; updated: number; unchanged: number; archived: number }
