# Cookin architecture

Cookin is Cory's private meal-planning web app: pantry/fridge/freezer inventory, NYT Cooking
Recipe Box sync, a weekly dinner + lunch plan, and a grocery list that exports to Google Keep.
One user (Cory's household: 2 adults + a toddler, 7 dinners a week). Not public.

## Stack

| Layer | Choice |
|---|---|
| UI | React 19 + TypeScript, Vite. No UI framework; styles in `src/styles/` (`ck-` class prefix). |
| Hosting | Cloudflare Pages (free tier), static `dist/` + Pages Functions in `functions/`. |
| Data | Cloudflare D1, one generic JSON document table (`migrations/0001_init.sql`). |
| Sync | Local-first store in the browser (`src/shared/store`), pushes/pulls `/api/sync`. |
| Privacy | Cloudflare Access in front of the whole site (Cory's email only) + `API_TOKEN` bearer for automation. |
| Tests | Vitest (unit), Playwright (phone e2e, quality thread). |

## Folder layout

```
src/
  shared/
    types.ts          data model contract (lead thread owns; ask before changing)
    store/            local-first document store + React hooks (useCollection, useDoc)
    domain/           shared typed helpers: settings, inventory status, dates, plan ids, staples, list state
    catalog/          ingredient catalog + matcher API (catalog thread owns internals)
  features/<name>/    one folder per thread; see src/features/README.md
  styles/             design system (design thread owns)
  app/                shell: tab bar, hash router (lead)
  seed/               demo data for ?demo=1 / VITE_DEMO=1 (quality thread)
functions/            Cloudflare Pages Functions
  _middleware.ts      auth for /api/*
  api/sync.ts         GET ?since=cursor, POST {changes}
  api/import/recipes.ts  NYT import (NYT sync thread owns)
migrations/           D1 SQL
tools/bookmarklet/    NYT "Sync to Cookin" bookmark button source
packages/ingredients/ catalog thread's standalone package (re-exported by src/shared/catalog)
prototype/            first single-file prototype, for reference only
```

## Data model

All data is JSON documents in collections; the types are in `src/shared/types.ts`.

| Collection | Doc id | Type | Notes |
|---|---|---|---|
| `inventory` | catalog item id | `InventoryEntry` | `status: have / low / out`. No doc = not in the kitchen. Owned = have or low. |
| `customItems` | `c-<slug>` | `CatalogItem` | Items Cory adds; merged into the catalog/matcher. |
| `recipes` | `nyt-<id>` / `my-<id>` | `Recipe` | `ingredients` are raw lines; matching to catalog ids happens at read time with `analyzeRecipe`. |
| `plan` | `YYYY-MM-DD:dinner\|lunch` | `PlanEntry` | One doc per slot. `kind: recipe / lunch / leftovers / none`. |
| `staples` | slug | `Staple` | Always-buy (milk, bananas, eggs, bread, cereal) and kids' snacks. `when: always / when-low`. |
| `list` | `current` | `ListState` | Only what can't be derived: checked keys, manual items, dismissed keys. |
| `settings` | `app` | `AppSettings` | `onboardingComplete`, `dinnersPerWeek` (7), `householdSize` (3), last NYT sync. |

The shopping list is **derived**, not stored: planned recipes' missing items + planned lunches'
missing items + inventory items marked `low` + active staples + manual items, minus dismissed.
Line keys: `item:<catalogId>`, `staple:<id>`, `manual:<id>`, `text:<normalized>`.

## Using the store from a feature

```ts
import { useCollection, useDoc, store } from "@shared/store";
import { useOwned, setStatus, setPlan, usePlanWeek, weekStart, useSettings, updateSettings } from "@shared/domain";
import { analyzeRecipe, catalogGroups, getItem } from "@shared/catalog";

const recipes = useCollection("recipes");               // Record<id, Recipe>, re-renders on change
const owned = useOwned();                               // Set<catalogId>
const a = analyzeRecipe(recipe, owned);                 // { have, missing, unknown, lines, coverage, canMake }
setStatus(["flour"], "low");                            // writes inventory, syncs
setPlan({ date: "2026-11-30", meal: "dinner", kind: "recipe", refId: "nyt-123" });
store.put("staples", "milk", {...});                    // any collection, any doc
```

Reads are synchronous from memory. Writes apply immediately, persist to localStorage and sync
in the background. Conflicts are last-writer-wins per document, so keep docs small and focused
(one per item/slot, not one big blob) unless a collection says otherwise.

## Sync protocol

- `GET /api/sync?since=<cursor>` returns `{ docs: WireDoc[], cursor }` for everything changed after the cursor. Deleted docs come back with `data: null`.
- `POST /api/sync { changes: WireDoc[] }` upserts with last-writer-wins on `updatedAt`.
- `POST /api/import/recipes` (`RecipeImportRequest`) upserts NYT recipes server-side and records `settings.lastNytSync`.
- The client pulls on start, on focus/visibility, and every 30 s; pushes 0.4 s after a write.
- With no backend (plain `npm run dev`) the store stays in **local mode** and works from localStorage.

## Auth

`functions/_middleware.ts` guards `/api/*`: allowed if the Cloudflare Access email header is in
`ALLOWED_EMAILS`, or `Authorization: Bearer <API_TOKEN>`, or `DEV_ALLOW_ANON=1` (local only).
Cloudflare Access (Zero Trust, free) protects every path of the Pages site and its `*.pages.dev` alias.

## NYT Cooking sync

NYT has no API. Two paths, both owned by the NYT sync thread:
1. **Bookmark button** on cooking.nytimes.com/recipe-box: reads the saved recipe links, fetches each
   recipe page's JSON-LD with Cory's own session, then hands the data to Cookin. Preferred hand-off:
   `window.open("<app>/#import")` + `postMessage` (the app checks `event.origin === "https://cooking.nytimes.com"`)
   and posts to `/api/import/recipes`. Copy/paste is the fallback. Prototype: `tools/bookmarklet/`.
2. **Weekly Sunday sync**: a Claude scheduled task drives Chrome on Cory's computer, collects the same
   payload and POSTs `/api/import/recipes` with the `API_TOKEN`.

## Google Keep

Keep has no consumer write API. The list screen copies one item per line; pasting into a Keep
checklist note makes one checkbox per line. Web Share (`navigator.share`) is offered where available.

## Working rules for threads

- Work in your own folder on your own branch; open a draft PR to `main`. Keep PRs small and frequent.
- Don't edit `src/shared/types.ts`, `src/shared/store`, `src/app`, `functions/_*.ts` or `package.json`
  dependencies without asking the lead thread. Adding a dev script or a dependency your module needs is fine; say so in the PR.
- Every PR: `npm run typecheck && npm test && npm run build` pass.
- Mobile first (390 px wide), light and dark mode, 44 px tap targets.
