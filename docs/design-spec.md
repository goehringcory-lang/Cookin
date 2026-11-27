# Cookin design spec

A private, phone-first meal planner for one family. This spec is the source of truth for screens, flows, copy tone and the visual system. Tokens live in `src/styles/tokens.css` (and `tokens.ts`); component styles live in `src/styles/components.css`. Screen mockups (home, pantry setup, list) live on the Cookin screen designs canvas: https://claude.ai/artifact/6U3xMfF2PTuvBn9x3VpdSk (private to Cory).

## 1. What we took from TapCook (and what we didn't)

TapCook ("Budget Meal Plans", 2026) is a weekly-dinner planner with a long, friendly onboarding, a pantry memory, swap-a-meal, and a grocery list it exports to delivery apps. We borrow its **patterns**, not its name, logo, art or copy.

| TapCook pattern | What Cookin does with it |
| --- | --- |
| Long, one-question-per-screen onboarding with big tappable cards | Same rhythm, but only questions that matter to us: household, cooking nights, lunches, staples, pantry. No ZIP, store, budget, diet, allergy, rating or paywall screens. |
| Pantry captured during onboarding as a grid of chips | Our pantry step is the heart of setup: ~250 items across 12 categories, grouped, searchable, with "select all in group". |
| Horizontal day strip above a week of dinner cards; a "tonight" hero card | Same. Home = tonight hero + day strip + week list. |
| Swap modal with alternatives, prep time and price deltas | We show **"You can make tonight"** swaps ranked by missing-ingredient count, with a **"Quicker"** filter. No prices. |
| Recipe detail: hero photo, meta row, servings stepper, numbered steps, "I cooked it" | Same, plus every ingredient tagged *Have* / *Need*. "Cooked it" offers to mark used-up items as low. |
| Grocery list grouped by store section with totals | **Flat list, no grouping, no prices.** Each row shows which recipe wants it. Copy for Keep. |
| Undo toasts everywhere | Same. Any destructive tap gets a 5-second Undo. |
| Previous weeks, favorites, hidden recipes | Favorites and "not for us" hide; past weeks kept forever (it's ours). |

Patterns from list-transfer UX research we adopt: a checkmark means one thing per screen ("I have it" in pantry, "in cart" on the list); provenance on every list row; Undo for every removal; never double-add.

## 2. Principles

1. **Thumb first.** Everything important sits in the bottom 60% of the screen. Primary actions are full-width at the bottom. Tap targets are ≥ 48 px.
2. **One tap to the answer.** "What's for dinner tonight?" is answered on launch, with no scrolling.
3. **Have / Need is the core signal.** Green check = in the kitchen. Saffron = running low. Tomato = need to buy. Used consistently on every screen.
4. **Warm, not cute.** Kitchen-table feel: cream paper, tomato red, herb green, a serif for headlines. No mascots, no emoji in UI chrome (emoji are fine as category icons in the pantry).
5. **Forgiving.** Nothing is ever lost: swaps, removals and pantry changes all have Undo.
6. **Private and calm.** No accounts screen, no notifications nagging, no marketing.

## 3. Information architecture

Bottom tab bar, four tabs, always visible (except in onboarding and full-screen recipe cooking mode):

| Tab (route) | Icon | Purpose |
| --- | --- | --- |
| **This week** (`#home`) | calendar | Tonight, the week's dinners and lunches, swaps |
| **List** (`#list`) | basket | Flat shopping list; badge shows item count; Copy for Keep |
| **Kitchen** (`#kitchen`) | jar | Pantry, fridge, freezer, spices; toggle have / low / out |
| **Recipes** (`#recipes`, `#recipe/<id>`) | book | Recipe Box (NYT sync), search, filters, add to plan |

Order and routes match the scaffold in `src/app/App.tsx`. Below, "Pantry" means the Kitchen tab.

Settings (staples, household, sync, data) open from a gear button in the top-right of **This week**.

## 4. Onboarding (first run)

One question per screen. Progress shown as a thin segmented bar at the top. "Back" top-left, "Skip" top-right only where skipping makes sense. Primary button pinned to the bottom ("Continue"). Everything chosen here is editable later in Settings or Pantry.

1. **Welcome.** Headline "Dinner, sorted." Sub "Tell me what's in your kitchen once. I'll plan the week and write the list." Button "Let's set up". Illustration: simple line drawing of a pot (our own, drawn in SVG, tomato stroke).
2. **Household.** "Who's eating?" Two steppers: Adults (default 2), Kids (default 2). Used to scale servings.
3. **Cooking nights.** "Which nights do you cook?" Day chips Mon–Sun (multi-select, default Sun–Thu). Shows "5 dinners a week" live below.
4. **Lunches.** "Plan lunches too?" Three option cards: *Leftovers when we can* (default, selected), *Easy lunches every day*, *Skip lunches*. Sub-option toggle "Kids' lunchbox ideas".
5. **Staples.** "What do you always buy?" Pre-checked chips: Milk, Bananas, Fig bars, Fruit bars, Bread, Eggs, Yogurt, Cheese sticks, Apples, Goldfish crackers, Applesauce pouches, Granola bars. Add your own with a text field. Staples always appear on the list.
6. **Pantry, fridge, freezer** (the big one). Intro screen: "Now the fun part. Tap everything you have." Then a scrolling, sectioned chip grid:
   - Sticky search bar on top ("Search 250 ingredients").
   - Sticky segmented control: **Pantry · Fridge · Freezer · Spices**.
   - Sections by category (Baking, Pasta & grains, Canned & jarred, Oils & vinegars, Sauces & condiments, Spices & dried herbs, Dairy & eggs, Produce that keeps, Meat & fish (freezer), Frozen, Nuts & dried fruit, Bread & tortillas). Each section header has "Select all".
   - Chips toggle between off (outline) and **have** (filled herb green with check). Long-press a chip to mark **low**.
   - Bottom bar: "112 items" counter and "Continue".
   - Specificity matters for NYT recipes, so the catalog splits where recipes split: e.g. pasta into spaghetti, penne, rigatoni, orzo, lasagna sheets, egg noodles; flour into all-purpose, bread, whole wheat; vinegar into red wine, white wine, rice, balsamic, apple cider.
7. **Recipe Box.** "Connect your NYT Recipe Box." Explains the Sync bookmark plus weekly Sunday sync. Buttons "Set up sync" and "Later".
8. **Done.** "You're all set." Shows a summary card (2 adults, 2 kids · 5 dinners · 112 pantry items · 7 staples). Button "Plan my first week" goes to Recipes in plan mode.

## 5. This week (home)

Top to bottom:

1. **App bar**: "This week" in display serif, date range below ("Nov 30 – Dec 6"), gear icon right. Chevrons let you go to next week to plan ahead.
2. **Tonight hero card**: large food photo, overline "TONIGHT · THURSDAY", recipe title, meta row (⏱ 45 min · serves 4 · ✓ all ingredients / ⚠ need 2). Buttons: **Cook this** (primary) and **Swap** (secondary).
3. **Swap bar** (the "top bar of swaps" Cory asked for). Sits directly under the hero. Title "Or make instead, with what you have". Horizontal scroll of compact recipe cards. Filter chips above it: **All · Quicker · Under 30 min**. Each card: photo, title, time, and a have-badge ("Have everything" green or "Need 1" saffron). Sorted by: missing count ascending, then time ascending. Tapping a card opens recipe detail with a sticky "Make this tonight" button, which swaps it into tonight and moves the original to the next open night (toast with Undo).
4. **Day strip**: 7 pills (Mon 30 … Sun 6). Today ringed; days with a planned dinner show a dot. Tapping scrolls the list.
5. **Week list**: one row per day. Each row: day label, dinner card (thumbnail, title, time, have-badge), lunch line beneath ("Lunch: leftovers from Tuesday's chili" or "Lunch: turkey & cheese roll-ups"). Empty nights show a dashed "Add dinner" card. Long-press or "⋯" menu: Move to another day, Swap, Remove, Mark as eat-out.
6. **Shopping nudge** at the bottom: "8 items to buy for this week → List".

Tapping any planned meal opens the **Meal sheet** (bottom sheet, 90% height): the recipe summary at top and, pinned at the top of the sheet, the same swap bar scoped to that day. This is how "tapping a planned meal shows swaps you can make now" works.

## 6. Recipes

- **Header**: "Recipes" + search field + sync status pill ("Synced Sunday · 214 recipes").
- **Filter chips** (horizontal): *Can make now*, *Need ≤ 2*, *Under 30 min*, *Dinner*, *Lunch*, *Favorites*, *New this week*.
- **Grid**: 2 columns of recipe cards (4:3 photo, title 2 lines max, time, have-badge, heart).
- **Plan mode** (entered from onboarding or from an empty night): cards get a "+" button; a bottom bar shows "4 of 5 dinners picked · Done".
- **Recipe detail**:
  - Hero photo (edge to edge, 4:3), back button floating top-left, heart top-right.
  - Title (display serif), source line "NYT Cooking · Melissa Clark", meta row (time, servings stepper, rating).
  - **Ingredients**: each line has a status dot: ✓ have, ◐ low, ○ need. Need items have an "Add" pill; a header button "Add 3 missing to list".
  - **Steps**: numbered, large type, each step its own card in cooking mode.
  - Sticky bottom: "Add to plan" (choose day sheet) or "Make this tonight" when entered from a swap.
  - "Open on NYT Cooking" link.

## 7. Pantry

- **Header**: "Pantry" + search + count ("146 items").
- **Segmented control**: Pantry · Fridge · Freezer · Spices.
- **Filter chips**: All · Running low · Out.
- **List layout** (not grid, faster for scanning after setup): sections by category. Each row: emoji icon, name, and a three-state toggle **Have / Low / Out** on the right.
  - Out = item goes to the List only if a planned recipe needs it. Low = item goes on the List right away, marked "running low".
  - Changing state shows a toast: "Flour moved to Out. Added to list for Banana bread. Undo".
- **Add item** floating button opens a search over the full catalog plus "Add custom".

## 8. List

- **Header**: "List", item count, overflow menu (Clear checked, Share).
- **Primary action**: full-width **Copy for Keep** button at the top (tomato). On tap: copies a plain checklist (one item per line), shows a toast "Copied 14 items. Open Keep, new list, paste." with an "Open Keep" link.
- **Flat list**, sorted: recipe needs first (alphabetical), then running-low, then staples. No section headers, but a subtle tag on each row explains why it's there: "Chicken thighs · for Sheet-pan chicken (Tue)", "Flour · running low", "Milk · staple".
- Rows: big round checkbox, name, quantity (merged across recipes: "Onions · 3"), provenance tag. Checked rows strike through and sink to the bottom.
- Swipe left to remove (Undo). Text field at the bottom: "Add an item".
- Checking off items offers (once, when all are checked): "Got everything? Mark these as in the pantry." This keeps the pantry in sync after a shop.

## 9. Visual system

### Color

Warm neutrals with three semantic accents. All text pairs meet WCAG AA.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--ck-bg` | `#FBF7F1` cream | `#1A1714` | App background |
| `--ck-surface` | `#FFFFFF` | `#24201C` | Cards, sheets |
| `--ck-surface-2` | `#F4EDE3` | `#2E2924` | Chips, inputs, wells |
| `--ck-border` | `#E7DDD0` | `#3A342E` | Hairlines |
| `--ck-text` | `#2A221B` espresso | `#F5EFE7` | Body text |
| `--ck-text-muted` | `#6E6257` | `#B5A99C` | Secondary text |
| `--ck-primary` | `#C8492F` tomato | `#E7694E` | Primary buttons, active tab, links |
| `--ck-have` | `#3F7D4E` herb | `#6BB37D` | In the kitchen, "have everything" |
| `--ck-low` | `#C98A12` saffron | `#E6AE3F` | Running low, "need 1–2" |
| `--ck-need` | `#C8492F` tomato | `#E7694E` | Need to buy |

Each accent has a `-soft` tint for backgrounds (chips, badges) and an `-ink` for text on that tint.

### Type

- **Display**: *Fraunces* (Google Fonts, variable, opsz + soft axis), weight 600, used for screen titles, recipe titles and the onboarding headlines.
- **UI**: *Inter* (variable), 400/500/600.
- Scale (px): 12 caption · 14 small · 16 body · 18 lead · 22 title · 28 headline · 36 display. Line height 1.45 body, 1.15 display.
- Overlines: 12 px, 600, letter-spacing 0.08em, uppercase.

### Shape, space, depth

- 4 px spacing grid: 4, 8, 12, 16, 20, 24, 32, 40, 56.
- Radii: 8 (chips, inputs), 14 (cards), 20 (hero, sheets), 999 (pills, buttons).
- Shadows are soft and warm (brown-tinted): `sm` for cards, `md` for floating bars, `lg` for sheets.
- Screen gutter 16 px. Max content width 560 px (centered on tablets/desktop).

### Motion

- 160 ms ease-out for taps and toggles; 260 ms spring-ish (`cubic-bezier(.2,.8,.2,1)`) for sheets and card swaps.
- Chip toggle: quick scale 0.96 → 1 and fill. Checking a list item: check draws in, row fades and slides to bottom.
- Respect `prefers-reduced-motion`: drop transforms, keep fades.

### Imagery and icons

- Recipe photos come from NYT image URLs. Fallback: a warm gradient tile with the recipe's first letter in Fraunces.
- Icons: Lucide (MIT), 1.75 px stroke, 22 px in tab bar, 20 px inline.
- Pantry categories use emoji (🧂 🍝 🥫 🫒 🧈 🥕 🥩 🧊 🥜 🍞) for fast recognition.

### Voice

Short, warm, second person, a little dry. "Dinner, sorted." "You can make this tonight." "Running low on flour, added it." Never "Oops!", never exclamation marks in errors.

## 10. Components (in `components.css`)

| Class | Notes |
| --- | --- |
| `ck-app`, `ck-screen` (shell uses `ck-main`, onboarding `ck-app--bare`) | Root layout, safe-area padding, bottom space for tab bar |
| `ck-appbar` | Screen title + subtitle + actions |
| `ck-tabbar`, `ck-tab` (alias `ck-tabbar__tab`) | Fixed bottom nav; `aria-current="page"` styles active; `ck-tab__badge` |
| `ck-btn` + `--primary` `--secondary` `--ghost` `--block` `--sm` | Pill buttons |
| `ck-icon-btn` | 44 px round icon button |
| `ck-chip` + `[aria-pressed=true]` + `--low` | Pantry/filter toggle chips |
| `ck-segmented` | Pantry / Fridge / Freezer / Spices |
| `ck-card`, `ck-recipe-card` (+ `--compact`, `--hero`) | Recipe cards |
| `ck-badge` + `--have` `--low` `--need` | Have / Need badges |
| `ck-swap-bar` | Horizontal scroll of compact recipe cards with snap |
| `ck-daystrip`, `ck-day` | Week day pills |
| `ck-week-row`, `ck-add-slot` | Week list rows and empty slot |
| `ck-list-item`, `ck-check` | Shopping list row with round checkbox |
| `ck-ingredient` + status dot | Recipe ingredient line |
| `ck-pantry-row`, `ck-tristate` | Pantry row with Have / Low / Out |
| `ck-stepper` | − 2 + |
| `ck-input`, `ck-search` | Inputs |
| `ck-sheet`, `ck-scrim` | Bottom sheet |
| `ck-toast` | Snackbar with Undo |
| `ck-progress` | Onboarding segmented progress |
| `ck-option-card` | Onboarding big choice card |
| `ck-empty` | Empty states |

## 11. Accessibility

- Every toggle is a real `button` with `aria-pressed` (chips) or a radio group (tri-state, segmented).
- Color is never the only signal: have/low/need also carry an icon (✓ ◐ ○) and text.
- Minimum tap target 48 × 48. Focus ring: 3 px `--ck-focus` outline, offset 2.
- Supports Dynamic Type up to 200% without horizontal scroll.

## 12. PWA shell

- `manifest.webmanifest`: name "Cookin", short_name "Cookin", `display: standalone`, `theme_color #FBF7F1`, `background_color #FBF7F1`, icons 192/512 + maskable (a tomato-red rounded square with a cream pot outline, our own art).
- `apple-mobile-web-app-status-bar-style: default`, iOS splash uses cream background.
- Safe-area insets on app bar and tab bar (`env(safe-area-inset-*)`).

## 13. Using the system in code

- `src/main.tsx` imports `@styles/base.css`, which pulls in `tokens.css` and `components.css` and keeps the scaffold's old variable names (`--ck-ink`, `--ck-muted`, `--ck-line`, `--ck-accent`) as aliases. New code should use the names in §9.
- State lives in ARIA attributes, not modifier classes: `aria-pressed` on chips, `aria-checked` on checks, option cards, tri-state and segmented buttons, `aria-current="page"` on tabs, `aria-current="date"` on today, `data-status="have|low|need"` on ingredient rows, `data-checked` on list rows, `data-planned` on day pills.
- In TS, `import { haveBadge, availability } from "@styles/tokens"` gives the badge tone and text for a recipe's missing count, so every screen words it the same way.
