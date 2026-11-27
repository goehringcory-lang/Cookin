import type { Staple } from "@shared/types";
import { DEFAULT_STAPLES } from "@shared/domain";
import { slugify } from "./model";

type Suggestion = Omit<Staple, "updatedAt">;
const mk = (kind: Staple["kind"], name: string, itemId?: string): Suggestion => ({
  id: slugify(name),
  name,
  itemId,
  kind,
  when: "always",
  active: false,
});

/** Extra suggestions on top of DEFAULT_STAPLES. All start unselected. */
const EXTRA: Suggestion[] = [
  mk("staple", "Butter", "butter"),
  mk("staple", "Coffee"),
  mk("staple", "Yogurt", "yogurt"),
  ...[
    "Fruit leather",
    "Applesauce pouches",
    "String cheese",
    "Yogurt tubes",
    "Goldfish crackers",
    "Granola bars",
    "Pretzels",
    "Animal crackers",
    "Clementines",
    "Apples",
    "Grapes",
    "Baby carrots",
    "Peanut butter",
    "Jelly",
    "Deli turkey",
    "Juice boxes",
  ].map((n) => mk("kids-snack", n)),
];

/** Every staple chip shown in onboarding, in display order. */
export const STAPLE_SUGGESTIONS: Suggestion[] = [
  ...DEFAULT_STAPLES,
  ...EXTRA.filter((e) => !DEFAULT_STAPLES.some((d) => d.id === e.id)),
];

export const makeStaple = (name: string): Suggestion => ({ ...mk("household", name.trim()), active: true });
