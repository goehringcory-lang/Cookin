/**
 * Leftovers: a dinner can cover the next day's lunch.
 *
 * A dinner makes leftovers when Cory says so (Recipe.makesLeftovers), or, if
 * he hasn't said, when the recipe's yield leaves at least
 * `leftoverPortionsForLunch` portions after the family eats.
 */
import type { ISODate, LunchSettings, PlannedDinner } from "./types";
import { DEFAULT_LUNCH_SETTINGS } from "./types";

/**
 * Servings from a recipe yield string: "4 servings" -> 4, "6 to 8 servings" -> 6,
 * "Serves 4-6" -> 4, "1 loaf" -> undefined. Takes the low end to stay honest.
 */
export function parseServings(yieldText: string | undefined | null): number | undefined {
  if (!yieldText) return undefined;
  const t = String(yieldText).toLowerCase();
  if (/\b(loaf|loaves|cups?|dozen|cookies|bars|pints?|quarts?|jars?)\b/.test(t) && !/serv/.test(t)) return undefined;
  const m = t.match(/(\d+)(?:\s*(?:to|-|–|or)\s*(\d+))?/);
  if (!m) return undefined;
  const n = parseInt(m[1], 10);
  return n > 0 && n <= 40 ? n : undefined;
}

/** Portions left after dinner. 0 when the yield is unknown. */
export function leftoverPortions(dinner: PlannedDinner, settings: LunchSettings = DEFAULT_LUNCH_SETTINGS): number {
  if (!dinner.servings || dinner.servings <= 0) return 0;
  return Math.max(0, dinner.servings - settings.householdSize);
}

/** The app's guess when Cory hasn't toggled it. */
export function autoMakesLeftovers(dinner: PlannedDinner, settings: LunchSettings = DEFAULT_LUNCH_SETTINGS): boolean {
  return leftoverPortions(dinner, settings) >= settings.leftoverPortionsForLunch;
}

export function makesLeftovers(dinner: PlannedDinner, settings: LunchSettings = DEFAULT_LUNCH_SETTINGS): boolean {
  return dinner.makesLeftovers ?? autoMakesLeftovers(dinner, settings);
}

/** Servings to cook so dinner also covers tomorrow's lunch. */
export function servingsToCook(dinner: PlannedDinner, settings: LunchSettings = DEFAULT_LUNCH_SETTINGS): number {
  const base = dinner.servings ?? settings.householdSize;
  if (!makesLeftovers(dinner, settings)) return base;
  return Math.max(base, settings.householdSize + settings.leftoverPortionsForLunch);
}

/** Multiply the recipe by this to have lunch leftovers (1 = cook as written). */
export function leftoverScale(dinner: PlannedDinner, settings: LunchSettings = DEFAULT_LUNCH_SETTINGS): number {
  const base = dinner.servings ?? settings.householdSize;
  if (base <= 0) return 1;
  return servingsToCook(dinner, settings) / base;
}

/** Plain-language hint for the leftovers toggle. */
export function leftoversHint(dinner: PlannedDinner, settings: LunchSettings = DEFAULT_LUNCH_SETTINGS): string {
  const left = leftoverPortions(dinner, settings);
  if (dinner.makesLeftovers === false) return "Not saving any for lunch";
  if (left >= settings.leftoverPortionsForLunch) return `Serves ${dinner.servings}, so about ${left} portions left for lunch`;
  if (dinner.makesLeftovers) {
    const scale = leftoverScale(dinner, settings);
    return scale > 1 ? `Make ${formatScale(scale)} the recipe to have lunch the next day` : "Saving some for lunch";
  }
  return dinner.servings ? `Serves ${dinner.servings}, about right for dinner` : "Turn on if this usually makes extra";
}

function formatScale(x: number): string {
  if (Math.abs(x - 1.5) < 0.01) return "1½×";
  if (Math.abs(x - 2) < 0.01) return "double";
  return `${Math.round(x * 10) / 10}×`;
}

/* ---------- dates (pure, no time zone drift) ---------- */

export function addDays(date: ISODate, days: number): ISODate {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** 0 = Sunday ... 6 = Saturday. */
export function dayOfWeek(date: ISODate): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export const isWeekend = (date: ISODate) => [0, 6].includes(dayOfWeek(date));

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const dayName = (date: ISODate) => DAY_NAMES[dayOfWeek(date)];

/** Previous night's dinner, if it makes leftovers. */
export function leftoverDinnerFor(
  date: ISODate,
  dinners: readonly PlannedDinner[],
  settings: LunchSettings = DEFAULT_LUNCH_SETTINGS,
): PlannedDinner | undefined {
  const yesterday = addDays(date, -1);
  const dinner = dinners.find((d) => d.date === yesterday);
  return dinner && makesLeftovers(dinner, settings) ? dinner : undefined;
}
