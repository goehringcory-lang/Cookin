/**
 * Lunches and leftovers. Public API for the planner and shopping list.
 *
 * Planner: <LunchWeek start=…/> for a ready-made section, or <LunchSlot/> +
 *   <LunchPickerSheet/> inside your own day rows, and <LeftoversToggle/> on
 *   a dinner. useLunchWeek(start).fillEmpty() plans every empty lunch.
 * Shopping list: lunchShoppingNeeds(plan, owned) -> [{ itemId, name, reasons }].
 */
import "./lunches.css";

export * from "./types";
export { LUNCH_LIBRARY, getLunchIdea, libraryCatalogIds } from "./library";
export { LUNCH_ID_ALIASES, canonicalId, isOwned, nameOf, statusOf } from "./kitchen";
export { checkIdea, checkIngredient } from "./match";
export type { IdeaCheck, IngredientCheck } from "./match";
export {
  addDays,
  autoMakesLeftovers,
  dayName,
  dayOfWeek,
  isWeekend,
  leftoverDinnerFor,
  leftoverPortions,
  leftoverScale,
  leftoversHint,
  makesLeftovers,
  parseServings,
  servingsToCook,
} from "./leftovers";
export { planWeekLunches, readyNow, scoreIdea, suggestLunches, usageOf } from "./suggest";
export type { LunchPlanDraft, PlanWeekInput, SuggestContext } from "./suggest";
export { lunchShoppingNeeds } from "./shopping";
export { describeLunch } from "./describe";
export { lunchEntries, plannedDinners, toPlannedDinner } from "./week";
export { clearLunch, pickLunch, setMakesLeftovers, useKitchenStatus, useLunchSettings, useLunchWeek } from "./hooks";
export { LunchPicker } from "./components/LunchPicker";
export type { LunchPickerProps } from "./components/LunchPicker";
export { LunchSlot } from "./components/LunchSlot";
export { LeftoversToggle } from "./components/LeftoversToggle";
export { LunchPickerSheet, LunchWeek, ReadyNowLunches } from "./components/LunchWeek";
