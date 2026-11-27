/**
 * What the week's lunches add to the shopping list.
 *
 * Only `kind: "lunch"` entries add items. Leftovers add nothing (their dinner's
 * recipe is already on the list). Optional ingredients never go on the list.
 * Items that are owned but low are left to the list's own "low" rule.
 */
import type { PlanEntry } from "@shared/types";
import { canonicalId, nameOf } from "./kitchen";
import { getLunchIdea } from "./library";
import { checkIdea } from "./match";
import type { CatalogId, Kitchen, LunchShoppingNeed } from "./types";

/**
 * Flat, de-duplicated list of catalog items to buy for the planned lunches.
 * `plan` can be an array or the Record from usePlanWeek(); non-lunch entries
 * are ignored. `owned` is useOwned()'s Set (or any Kitchen).
 */
export function lunchShoppingNeeds(
  plan: readonly PlanEntry[] | Readonly<Record<string, PlanEntry>>,
  owned: Kitchen,
): LunchShoppingNeed[] {
  const entries = Array.isArray(plan) ? plan : Object.values(plan);
  const needs = new Map<CatalogId, LunchShoppingNeed>();
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  for (const e of sorted) {
    if (e.meal !== "lunch" || e.kind !== "lunch" || !e.refId) continue;
    const idea = getLunchIdea(e.refId);
    if (!idea) continue;
    for (const raw of checkIdea(idea, owned).missing) {
      const id = canonicalId(raw);
      const reason = { type: "lunch" as const, ideaId: idea.id, name: idea.name, date: e.date };
      const n = needs.get(id);
      if (n) n.reasons.push(reason);
      else needs.set(id, { itemId: id, name: nameOf(id), reasons: [reason] });
    }
  }
  return [...needs.values()];
}
