import type { PlanEntry, Recipe } from "@shared/types";
import { dayName } from "./leftovers";
import { getLunchIdea } from "./library";

/**
 * One-line label for a lunch slot, in the design spec's wording:
 * "Lunch: leftovers from Monday's chili" / "Lunch: turkey and cheese sandwich".
 */
export function describeLunch(
  entry: Pick<PlanEntry, "kind" | "refId" | "fromDate" | "note"> | undefined,
  recipes?: Readonly<Record<string, Pick<Recipe, "title">>>,
): { emoji: string; label: string; detail?: string; empty: boolean } {
  if (!entry) return { emoji: "", label: "Lunch: pick one", empty: true };
  switch (entry.kind) {
    case "lunch": {
      const idea = entry.refId ? getLunchIdea(entry.refId) : undefined;
      return idea
        ? { emoji: idea.emoji, label: `Lunch: ${lowerFirst(idea.name)}`, detail: `${idea.minutes} min`, empty: false }
        : { emoji: "🍽️", label: "Lunch", empty: false };
    }
    case "leftovers": {
      const title = (entry.refId && recipes?.[entry.refId]?.title) || "dinner";
      const day = entry.fromDate ? `${dayName(entry.fromDate)}'s ` : "";
      return { emoji: "♻️", label: `Lunch: leftovers from ${day}${lowerFirst(title)}`, empty: false };
    }
    case "none":
      return { emoji: "", label: entry.note ? `Lunch: ${entry.note}` : "Lunch: on our own", empty: false };
    default:
      return { emoji: "", label: "Lunch", empty: false };
  }
}

/** Lowercase the first letter unless it looks like a name or acronym ("PB&J"). */
function lowerFirst(s: string): string {
  if (!s) return s;
  if (s.length > 1 && s[1] === s[1].toUpperCase() && /[A-Z]/.test(s[1])) return s;
  return s[0].toLowerCase() + s.slice(1);
}
