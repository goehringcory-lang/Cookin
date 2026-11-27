/**
 * Lunch suggestions and automatic week filling.
 *
 * Ranking, best first:
 *   1. Ready now with what's in the kitchen.
 *   2. Short only items that are already on this week's list.
 *   3. Short 1 or 2 items.
 *   4. Variety: a repeat inside the week loses to a lunch that needs one item,
 *      and same-family lunches (peanut butter x3) get spread out.
 *   5. Kid-friendly, then quicker.
 */
import type { PlanEntry } from "@shared/types";
import { nameOf } from "./kitchen";
import { isWeekend, leftoverDinnerFor } from "./leftovers";
import { LUNCH_LIBRARY, getLunchIdea } from "./library";
import { checkIdea } from "./match";
import type { CatalogId, ISODate, Kitchen, LibraryLunch, LunchMatch, LunchSettings, LunchStyle, PlannedDinner } from "./types";
import { DEFAULT_LUNCH_SETTINGS } from "./types";

export interface SuggestContext {
  /** Catalog ids already going on this week's list (dinners, other lunches). */
  alreadyBuying?: ReadonlySet<CatalogId>;
  /** Catalog ids this week's dinners use. */
  dinnerIngredients?: ReadonlySet<CatalogId>;
  /** Lunch ids already planned this week, with counts. */
  usedThisWeek?: ReadonlyMap<string, number>;
  /** Lunch families already planned this week, with counts. */
  familiesThisWeek?: ReadonlyMap<string, number>;
  /** "lunchbox" keeps lunchbox and both. */
  style?: LunchStyle;
  maxMinutes?: number;
  /** Reshuffles near-ties. Use for a Shuffle button. */
  seed?: number;
  library?: readonly LibraryLunch[];
}

function jitter(id: string, seed: number): number {
  let h = seed | 0;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 2654435761) >>> 0;
  return (h % 600) / 100;
}

const fitsStyle = (idea: LibraryLunch, style?: LunchStyle) =>
  !style || style === "both" || idea.style === style || idea.style === "both";

const lower = (ids: CatalogId[]) => ids.map((id) => nameOf(id).toLowerCase()).join(", ");

export function scoreIdea(idea: LibraryLunch, kitchen: Kitchen, ctx: SuggestContext = {}): LunchMatch {
  const check = checkIdea(idea, kitchen);
  const reasons: string[] = [];
  const buying = ctx.alreadyBuying;
  const toBuy = buying ? check.missing.filter((id) => !buying.has(id)) : check.missing;
  const onList = buying ? check.missing.filter((id) => buying.has(id)) : [];

  let score: number;
  if (check.missing.length === 0) {
    score = 100;
    reasons.push("Ready now");
  } else if (toBuy.length === 0) {
    score = 85;
    reasons.push(`${capitalize(lower(onList))} already on your list`);
  } else {
    score = 40 - 18 * toBuy.length;
    reasons.push(`Need ${lower(toBuy)}`);
  }
  score -= 3 * check.low.length;

  if (ctx.dinnerIngredients?.size) {
    const shared = check.checks.map((c) => c.using).find((id) => !!id && ctx.dinnerIngredients!.has(id));
    if (shared) {
      score += 4;
      reasons.push(`Uses up ${nameOf(shared).toLowerCase()} from dinner`);
    }
  }

  score -= 90 * (ctx.usedThisWeek?.get(idea.id) ?? 0);
  if (idea.family) score -= 30 * (ctx.familiesThisWeek?.get(idea.family) ?? 0);
  if (idea.kidFriendly) {
    score += 8;
    reasons.push("Kid-friendly");
  }
  score += Math.max(0, 15 - idea.minutes) * 0.6;
  if (ctx.seed !== undefined) score += jitter(idea.id, ctx.seed);

  return { idea, readiness: check.readiness, missing: check.missing, low: check.low, score, reasons };
}

const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Library lunches ranked for right now. */
export function suggestLunches(kitchen: Kitchen, ctx: SuggestContext = {}): LunchMatch[] {
  const lib = ctx.library ?? LUNCH_LIBRARY;
  return lib
    .filter((l) => fitsStyle(l, ctx.style))
    .filter((l) => ctx.maxMinutes === undefined || l.minutes <= ctx.maxMinutes)
    .map((l) => scoreIdea(l, kitchen, ctx))
    .sort((a, b) => b.score - a.score || a.idea.minutes - b.idea.minutes || a.idea.id.localeCompare(b.idea.id));
}

/** Lunches makeable this minute, quickest first. "What can we have right now?" */
export function readyNow(kitchen: Kitchen, ctx: Omit<SuggestContext, "usedThisWeek" | "alreadyBuying"> = {}): LunchMatch[] {
  return suggestLunches(kitchen, ctx)
    .filter((m) => m.readiness === "ready")
    .sort((a, b) => a.idea.minutes - b.idea.minutes || b.score - a.score);
}

/** A lunch slot to write with setPlan(). */
export type LunchPlanDraft = Omit<PlanEntry, "id" | "updatedAt"> & { meal: "lunch" };

export interface PlanWeekInput {
  dates: readonly ISODate[];
  dinners: readonly PlannedDinner[];
  kitchen: Kitchen;
  /** Lunch entries already on the plan. Their slots are left alone. */
  existing?: readonly PlanEntry[];
  settings?: LunchSettings;
  seed?: number;
  library?: readonly LibraryLunch[];
}

/** Ids and families already used by planned lunches. */
export function usageOf(entries: readonly Pick<PlanEntry, "kind" | "refId" | "meal">[]) {
  const used = new Map<string, number>();
  const families = new Map<string, number>();
  for (const e of entries) {
    if (e.meal !== "lunch" || e.kind !== "lunch" || !e.refId) continue;
    used.set(e.refId, (used.get(e.refId) ?? 0) + 1);
    const fam = getLunchIdea(e.refId)?.family;
    if (fam) families.set(fam, (families.get(fam) ?? 0) + 1);
  }
  return { used, families };
}

/**
 * Plans every empty lunch slot in `dates`: leftovers after any dinner that
 * makes them, otherwise the best-ranked library lunch. Never touches a slot
 * that already has an entry. Returns only the new entries.
 */
export function planWeekLunches(input: PlanWeekInput): LunchPlanDraft[] {
  const settings = input.settings ?? DEFAULT_LUNCH_SETTINGS;
  const lib = input.library ?? LUNCH_LIBRARY;
  const existing = (input.existing ?? []).filter((e) => e.meal === "lunch");
  const taken = new Set(existing.map((e) => e.date));

  const dinnerIngredients = new Set<CatalogId>();
  const buying = new Set<CatalogId>();
  for (const d of input.dinners) {
    d.ingredientIds?.forEach((i) => dinnerIngredients.add(i));
    d.missingIds?.forEach((i) => buying.add(i));
  }
  const { used, families } = usageOf(existing);
  for (const e of existing) {
    const idea = e.kind === "lunch" && e.refId ? getLunchIdea(e.refId) : undefined;
    if (idea) checkIdea(idea, input.kitchen).missing.forEach((m) => buying.add(m));
  }
  // A dinner's leftovers feed one lunch; don't reuse one already claimed.
  const claimed = new Set(existing.filter((e) => e.kind === "leftovers").map((e) => e.fromDate));

  const out: LunchPlanDraft[] = [];
  for (const date of input.dates) {
    if (taken.has(date)) continue;
    if (!settings.includeWeekends && isWeekend(date)) continue;

    const lo = leftoverDinnerFor(date, input.dinners, settings);
    if (lo && !claimed.has(lo.date)) {
      out.push({ date, meal: "lunch", kind: "leftovers", refId: lo.recipeId, fromDate: lo.date });
      claimed.add(lo.date);
      continue;
    }

    const [best] = suggestLunches(input.kitchen, {
      alreadyBuying: buying,
      dinnerIngredients,
      usedThisWeek: used,
      familiesThisWeek: families,
      seed: input.seed,
      library: lib,
    });
    if (!best) continue;
    out.push({ date, meal: "lunch", kind: "lunch", refId: best.idea.id });
    used.set(best.idea.id, (used.get(best.idea.id) ?? 0) + 1);
    if (best.idea.family) families.set(best.idea.family, (families.get(best.idea.family) ?? 0) + 1);
    best.missing.forEach((m) => buying.add(m));
  }
  return out;
}
