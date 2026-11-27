import type { PlanEntry, Recipe } from "@shared/types";
import { describeLunch } from "../describe";
import { getLunchIdea } from "../library";
import { checkIdea } from "../match";
import type { Kitchen } from "../types";

export interface LunchSlotProps {
  entry?: PlanEntry;
  recipes?: Readonly<Record<string, Pick<Recipe, "title">>>;
  kitchen?: Kitchen;
  onOpen: () => void;
}

/**
 * The lunch line under a dinner in the week list (design spec: .ck-meal__lunch).
 * "Lunch: leftovers from Monday's chili" / "Lunch: PB&J · 2 to buy".
 */
export function LunchSlot({ entry, recipes, kitchen, onOpen }: LunchSlotProps) {
  const d = describeLunch(entry, recipes);
  const idea = entry?.kind === "lunch" && entry.refId ? getLunchIdea(entry.refId) : undefined;
  const toBuy = idea && kitchen ? checkIdea(idea, kitchen).missing.length : 0;
  return (
    <button type="button" className={`ck-meal__lunch ck-lunch-slot${d.empty ? " is-empty" : ""}`} onClick={onOpen}>
      {d.emoji && <span className="ck-lunch-slot__emoji" aria-hidden="true">{d.emoji}</span>}
      <span className="ck-lunch-slot__label">{d.label}</span>
      {toBuy > 0 && <span className="ck-lunch-slot__tag">{toBuy} to buy</span>}
    </button>
  );
}
