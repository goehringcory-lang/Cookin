/** React glue: reads the shared store, writes lunch plan entries. */
import { useCallback, useMemo } from "react";
import { store, useCollection } from "@shared/store";
import { addDays as domainAddDays, clearPlan, setPlan, useCatalogVersion, usePlanWeek, useSettings, weekDates } from "@shared/domain";
import type { Recipe, StockStatus } from "@shared/types";
import { planWeekLunches, usageOf } from "./suggest";
import { lunchShoppingNeeds } from "./shopping";
import { lunchEntries, plannedDinners } from "./week";
import type { ISODate, LunchChoice, LunchSettings } from "./types";
import { DEFAULT_LUNCH_SETTINGS } from "./types";

/** Inventory as a status map so the picker can say "running low". */
export function useKitchenStatus(): Record<string, StockStatus> {
  const inv = useCollection("inventory");
  return useMemo(() => Object.fromEntries(Object.values(inv).map((e) => [e.itemId, e.status])), [inv]);
}

export function useLunchSettings(): LunchSettings {
  const s = useSettings();
  return useMemo(() => ({ ...DEFAULT_LUNCH_SETTINGS, householdSize: s.householdSize || DEFAULT_LUNCH_SETTINGS.householdSize }), [s.householdSize]);
}

/** Write one day's lunch. */
export function pickLunch(date: ISODate, choice: LunchChoice) {
  if (choice.type === "idea") setPlan({ date, meal: "lunch", kind: "lunch", refId: choice.lunchId });
  else if (choice.type === "leftovers") setPlan({ date, meal: "lunch", kind: "leftovers", refId: choice.recipeId, fromDate: choice.fromDate });
  else setPlan({ date, meal: "lunch", kind: "none", note: choice.note });
}

export const clearLunch = (date: ISODate) => clearPlan(date, "lunch");

/** Cory's "makes leftovers" toggle lives on the recipe. */
export function setMakesLeftovers(recipeId: string, value: boolean | undefined) {
  const r = store.get("recipes", recipeId) as Recipe | undefined;
  if (!r) return;
  store.put("recipes", recipeId, { ...r, makesLeftovers: value, updatedAt: Date.now() });
}

/** Everything the planner needs for one week of lunches. */
export function useLunchWeek(start: ISODate) {
  const plan = usePlanWeek(start);
  const recipes = useCollection("recipes");
  const kitchen = useKitchenStatus();
  const settings = useLunchSettings();
  const catalogVersion = useCatalogVersion();

  const dates = useMemo(() => weekDates(start), [start]);
  // Include the night before the week starts so Monday can get Sunday's leftovers.
  const prevDinner = useCollection("plan")[`${domainAddDays(start, -1)}:dinner`];
  const dinners = useMemo(
    () => plannedDinners(prevDinner ? [...Object.values(plan), prevDinner] : plan, recipes, kitchen),
    // catalogVersion: re-match recipe lines when Cory adds custom items.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan, prevDinner, recipes, kitchen, catalogVersion],
  );
  const lunches = useMemo(() => lunchEntries(plan), [plan]);
  const usage = useMemo(() => usageOf(lunches), [lunches]);
  const alreadyBuying = useMemo(() => {
    const s = new Set<string>();
    dinners.forEach((d) => d.missingIds?.forEach((i) => s.add(i)));
    lunchShoppingNeeds(lunches, kitchen).forEach((n) => s.add(n.itemId));
    return s;
  }, [dinners, lunches, kitchen]);

  /** Fill every empty lunch slot. Returns how many were filled. */
  const fillEmpty = useCallback(
    (seed?: number) => {
      const drafts = planWeekLunches({ dates, dinners, kitchen, existing: lunches, settings, seed });
      drafts.forEach((d) => setPlan(d));
      return drafts.length;
    },
    [dates, dinners, kitchen, lunches, settings],
  );

  return { dates, plan, recipes, kitchen, settings, dinners, lunches, usage, alreadyBuying, fillEmpty };
}
