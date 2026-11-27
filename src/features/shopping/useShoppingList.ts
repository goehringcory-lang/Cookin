import { useMemo } from "react";
import { useCollection } from "@shared/store";
import { DEFAULT_STAPLES, addDays, parseYmd, todayYmd, useCatalogVersion, useListEntries, useSettings, weekStart } from "@shared/domain";
import type { PlanEntry, Recipe, Staple } from "@shared/types";
import { buildShoppingList, type LunchNeed, type ShoppingList } from "./build";

/**
 * Hooks into the lunches feature (lunchShoppingNeeds, leftoverScale). It is
 * registered rather than imported so this module builds before that one lands;
 * once both are on main this can become a plain import.
 */
export interface LunchModule {
  lunchShoppingNeeds: (plan: PlanEntry[], owned: Set<string>) => LunchNeed[];
  leftoverScale?: (recipe: Recipe) => number;
}
let lunches: LunchModule | undefined;
export function registerLunchModule(m: LunchModule) {
  lunches = m;
}

/** Staples from the store, or the defaults until any are saved. */
export function useStaples(): Staple[] {
  const saved = useCollection("staples");
  return useMemo(() => {
    const list = Object.values(saved);
    return list.length ? list : DEFAULT_STAPLES.map((s) => ({ ...s, updatedAt: 0 }));
  }, [saved]);
}

/**
 * The plan week this shopping trip is for. On the last two days of a week
 * (Sat and Sun when weeks start Monday) you're shopping for the week ahead,
 * so checks and "bought" dismissals belong to next week and last through it.
 */
export function shoppingWeek(today: string, startsOn: 0 | 1): string {
  const start = weekStart(today, startsOn);
  const dayIndex = (parseYmd(today).getDay() - startsOn + 7) % 7;
  return dayIndex >= 5 ? addDays(start, 7) : start;
}

/**
 * The live shopping list. Shops for everything planned from today through the
 * end of next week, so planning next week before a shop puts it all on the list.
 */
export function useShoppingList(): ShoppingList & { weekOf: string } {
  const plan = useCollection("plan");
  const recipes = useCollection("recipes");
  const inventory = useCollection("inventory");
  const staples = useStaples();
  const settings = useSettings();
  const today = todayYmd();
  const weekOf = shoppingWeek(today, settings.weekStartsOn);
  const entries = useListEntries(weekOf);
  const catalogVersion = useCatalogVersion();

  return useMemo(() => {
    const end = addDays(weekStart(today, settings.weekStartsOn), 13);
    const upcoming = Object.values(plan).filter((p) => p.date >= today && p.date <= end && !p.cooked);
    const owned = new Set(Object.values(inventory).filter((e) => e.status === "have" || e.status === "low").map((e) => e.itemId));
    const built = buildShoppingList({
      plan: upcoming,
      recipes,
      inventory,
      staples,
      entries,
      householdSize: settings.householdSize,
      lunchNeeds: lunches?.lunchShoppingNeeds(upcoming.filter((p) => p.kind === "lunch"), owned),
      leftoverScale: lunches?.leftoverScale,
    });
    return { ...built, weekOf };
    // catalogVersion: custom kitchen items change what recipe lines match.
  }, [plan, recipes, inventory, staples, entries, settings.householdSize, settings.weekStartsOn, today, weekOf, catalogVersion]);
}
