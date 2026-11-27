/** Where an item lives in the kitchen. Onboarding walks these in this order. */
export type Location = 'pantry' | 'fridge' | 'freezer';

/** An onboarding section, e.g. "Pasta & noodles". Each category belongs to one location. */
export interface Category {
  id: string;
  name: string;
  location: Location;
  /** Emoji shown next to the section heading. */
  icon: string;
}

/** One canonical ingredient that can be owned, missing, or bought. */
export interface CatalogItem {
  /** Stable kebab-case slug. Stored in the inventory table, so never rename one. */
  id: string;
  /** Display name, e.g. "All-purpose flour". */
  name: string;
  /** Category id from CATEGORIES. */
  category: string;
  /** Storage location (same as the category's location). */
  location: Location;
  /** Most US kitchens keep this on hand. Pre-checked by "select all common" in onboarding. */
  common: boolean;
  /**
   * Name for the shopping list when it differs from `name`, e.g. "Rice" for "Rice (any)".
   * Filled in automatically for generic items; use listNameOf(id) to read it.
   */
  listName?: string;
  /** Other phrasings recipes use. Matching is case-insensitive and singular/plural-insensitive. */
  aliases: string[];
  /** Always on hand (salt, water, ice). Never missing, never on a list, hidden from onboarding. */
  assumed?: boolean;
  /**
   * A generic recipe term rather than something you buy, e.g. "short pasta" or "cooking oil".
   * Hidden from onboarding. Owned when any item whose `satisfies` lists it is owned.
   */
  generic?: boolean;
  /**
   * On a generic item: its members are interchangeable, so owning one member covers a recipe
   * asking for another (owning penne covers rigatoni). Reported as a substitute, never silently.
   */
  swappable?: boolean;
  /** Ids of generic (or broader) items that owning this item also covers. */
  satisfies?: string[];
}

/** One parsed recipe ingredient line. JSON-serializable, safe to cache in the database. */
export interface ParsedIngredient {
  /** The original line, untouched. */
  raw: string;
  /** Leading amount, e.g. 1.5 for "1 ½ cups". Null when the line has none. */
  quantity: number | null;
  /** Upper end of a range, e.g. 3 for "2 to 3 cloves". */
  quantityMax: number | null;
  /** Normalized unit, e.g. "cup", "tbsp", "tsp", "lb", "oz", "g", "can", "clove". */
  unit: string | null;
  /** Package size note, e.g. "15-ounce" from "1 (15-ounce) can". */
  size: string | null;
  /** The ingredient phrase after quantity and unit, before prep notes. */
  name: string;
  /** Text after the first comma or in trailing parentheses, e.g. "finely chopped". */
  note: string | null;
  /** Line says "optional". */
  optional: boolean;
  /** Line says "to taste" or "as needed". */
  toTaste: boolean;
  /** Line is for garnish, serving, or drizzling. */
  garnish: boolean;
  /**
   * Catalog ids this line needs. Every inner group is required; ids inside one group are
   * alternatives ("chicken or vegetable stock" is one group of two).
   */
  groups: string[][];
  /** True when every group is assumed (salt, water), so the line never matters. */
  assumedOnly: boolean;
  /** True when no catalog item matched. The UI can show these as "unknown" lines. */
  unmatched: boolean;
}

/** Anything describing what the user owns: a Set or array of ids, or a predicate. */
export type Owned = ReadonlySet<string> | readonly string[] | ((id: string) => boolean);

/** Minimal recipe shape the matcher needs. Extra fields are ignored. */
export interface RecipeLike {
  id: string;
  /** Raw ingredient lines, e.g. from NYT JSON-LD recipeIngredient. */
  ingredients: string[];
  /** Optional pre-parsed lines (from parseIngredients) to skip re-parsing. */
  parsed?: ParsedIngredient[];
}

export interface IngredientStatus {
  line: ParsedIngredient;
  /** For a missing line: the catalog ids to buy (first alternative of each unmet group). */
  missing: string[];
  /**
   * Requested id -> owned id that stands in for it (same swappable family), e.g.
   * { 'long-grain-white-rice': 'jasmine-rice' }. Only on lines counted as `have`.
   */
  substitutes?: Record<string, string>;
}

export interface RecipeAnalysis {
  recipeId: string;
  /** Required lines fully covered by the inventory. */
  have: IngredientStatus[];
  /** Required lines with at least one unmet group. */
  missing: IngredientStatus[];
  /** Optional, to-taste, or garnish lines that are not covered. Never block cooking. */
  optionalMissing: IngredientStatus[];
  /** Lines the catalog could not match. Not counted against the recipe. */
  unknown: ParsedIngredient[];
  /** Unique catalog ids to buy for the required lines. */
  missingIds: string[];
  /** Share of required, matched lines you have, 0 to 1. 1 when there are none. */
  coverage: number;
  /** True when nothing required is missing. */
  canMake: boolean;
}

export interface ShoppingNeed {
  itemId: string;
  /** Recipe ids that need this item. */
  recipeIds: string[];
  /** The raw lines asking for it, for display ("2 cups flour" etc.). */
  lines: string[];
}
