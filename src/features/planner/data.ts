/** Store access for the planner: live data hooks and plan actions. */
import { useMemo } from "react";
import type { Meal, PlanEntry, Recipe } from "@shared/types";
import { store, useCollection } from "@shared/store";
import { addDays, clearPlan, planId, setPlan, useCatalogVersion, useSettings, weekDates, weekStart } from "@shared/domain";
import { nextOpenDinner, type StatusMap } from "./logic";

export function useRecipes(): { list: Recipe[]; byId: Record<string, Recipe> } {
  const byId = useCollection("recipes");
  const list = useMemo(() => Object.values(byId).filter((r) => !r.archived).sort((a, b) => a.title.localeCompare(b.title)), [byId]);
  return { list, byId };
}

/**
 * Live itemId -> stock status. A new object whenever inventory or the catalog changes, so
 * memos keyed on it re-run analyzeRecipe when Cory adds a custom item.
 */
export function useStatusMap(): StatusMap {
  const inv = useCollection("inventory");
  const catalogVersion = useCatalogVersion();
  return useMemo(() => { void catalogVersion; return Object.fromEntries(Object.values(inv).map((e) => [e.itemId, e.status])); }, [inv, catalogVersion]);
}

export const usePlan = () => useCollection("plan");
export { useSettings };

export type NewEntry = Omit<PlanEntry, "id" | "updatedAt" | "date" | "meal">;

export function assign(date: string, meal: Meal, entry: NewEntry) {
  setPlan({ date, meal, ...entry });
}
export function clear(date: string, meal: Meal) {
  clearPlan(date, meal);
}
export const getEntry = (date: string, meal: Meal) => store.get("plan", planId(date, meal));

/** Snapshot that can be written back to undo an edit. */
export type Snapshot = { date: string; meal: Meal; entry?: PlanEntry }[];
export function snapshot(slots: { date: string; meal: Meal }[]): Snapshot {
  return slots.map((s) => ({ ...s, entry: getEntry(s.date, s.meal) }));
}
export function restore(snap: Snapshot) {
  for (const s of snap) {
    if (s.entry) { const { id: _i, updatedAt: _u, ...rest } = s.entry; void _i; void _u; setPlan(rest); }
    else clearPlan(s.date, s.meal);
  }
}

/** Swap the contents of two slots (empty slots allowed). */
export function swapSlots(a: { date: string; meal: Meal }, b: { date: string; meal: Meal }) {
  const ea = getEntry(a.date, a.meal), eb = getEntry(b.date, b.meal);
  const strip = (e: PlanEntry) => { const { id: _i, updatedAt: _u, date: _d, meal: _m, ...rest } = e; void _i; void _u; void _d; void _m; return rest; };
  if (eb) assign(a.date, a.meal, strip(eb)); else clear(a.date, a.meal);
  if (ea) assign(b.date, b.meal, strip(ea)); else clear(b.date, b.meal);
}

/**
 * Put `recipeId` into a dinner slot instead of what was there. The dish it replaces moves to
 * the same recipe's old night when it was planned elsewhere this week, otherwise to the next
 * open night, so nothing Cory shopped for gets lost. Returns a message and an undo snapshot.
 */
export function swapDinner(date: string, recipeId: string, titleOf: (id?: string) => string | undefined): { text: string; undo: Snapshot } {
  const week = weekDates(weekStart(date));
  const plan = store.all("plan");
  const current = plan[planId(date, "dinner")];
  const elsewhere = week.find((d) => d !== date && plan[planId(d, "dinner")]?.kind === "recipe" && plan[planId(d, "dinner")]?.refId === recipeId);
  const open = !elsewhere && current?.kind === "recipe" ? nextOpenDinner(plan, week, addDays(date, 1)) : undefined;
  const touched = [{ date, meal: "dinner" as Meal }, ...(elsewhere ? [{ date: elsewhere, meal: "dinner" as Meal }] : []), ...(open ? [{ date: open, meal: "dinner" as Meal }] : [])];
  const undo = snapshot(touched);
  const oldTitle = current?.kind === "recipe" ? titleOf(current.refId) : undefined;
  const servings = current?.servings;

  if (elsewhere) {
    swapSlots({ date, meal: "dinner" }, { date: elsewhere, meal: "dinner" });
  } else {
    assign(date, "dinner", { kind: "recipe", refId: recipeId, servings });
    if (open && current) assign(open, "dinner", { kind: "recipe", refId: current.refId, servings: current.servings });
  }
  const moved = elsewhere ?? open;
  const text = oldTitle && moved ? `Swapped. ${oldTitle} moved to ${dayLong(moved)}.` : `Swapped in ${titleOf(recipeId) ?? "the new recipe"}.`;
  return { text, undo };
}

const dayLong = (d: string) => ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(d + "T12:00").getDay()];
