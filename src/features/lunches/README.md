# Lunches and leftovers

Easy lunches for the family plus "leftovers from last night", planned alongside dinners.

## For the planner (home screen)

- `<LunchWeek start="YYYY-MM-DD" />`: drop-in section with a "Plan the week's lunches" button, one line per day, and the picker sheet.
- Or inside your own day rows: `<LunchSlot entry={plan[`${date}:lunch`]} recipes={recipes} kitchen={owned} onOpen={…} />` and `<LunchPickerSheet date start onClose />`.
- On a dinner or recipe screen: `<LeftoversToggle dinner={toPlannedDinner(entry, recipe)} onChange={(v) => setMakesLeftovers(recipe.id, v)} />`.
- `useLunchWeek(start).fillEmpty()` plans every empty lunch: leftovers the day after a dinner that makes extra, otherwise the best library lunch. It never overwrites a lunch already on the plan.

## For the shopping list

```ts
import { lunchShoppingNeeds } from "@features/lunches";
lunchShoppingNeeds(planWeek, owned) // -> [{ itemId, name, reasons: ListReason[] (type "lunch") }]
```

Only `kind: "lunch"` entries add items. Leftovers add nothing. Optional ingredients never go on the list. Low items are left to the list's own "low" rule.

## How leftovers work

A dinner makes leftovers when `Recipe.makesLeftovers` is set, or, if it isn't, when the recipe serves at least `householdSize + 2`. `leftoverScale(dinner)` says how much to scale a recipe that's flagged but too small (a 4-serving recipe for 4 people becomes 1.5x).

## Library

`library.ts`: 34 lunches, all 15 minutes or less, with swaps (`anyOf`), lunchbox flags and a one-line how-to. Ids are shared catalog ids; the few lunchbox items the catalog doesn't have yet are in `LUNCH_EXTRA_ITEMS` (kitchen.ts).
