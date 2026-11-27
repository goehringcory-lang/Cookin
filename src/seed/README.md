# Demo seed

Loaded only in demo mode (`?demo=1` in the URL, or `VITE_DEMO=1` at build time).
Used by the Playwright phone tests and for trying the app without a backend.

- `recipes.json`: 32 original NYT-style family recipes (fake demo URLs). `index.ts` turns
  them into `Recipe` docs with raw ingredient lines, ids `nyt-demo-<n>`.
- `inventory.json` + `ingredients.json`: a starter kitchen using our own slugs. `index.ts` maps
  each item onto the real catalog with `matchLine()`, so it follows catalog changes.
  About 7 recipes are fully makeable (three take 20 minutes); flour is out on purpose.
- `staples.json`: reference list; the app uses `DEFAULT_STAPLES` from `@shared/domain`, all active.
- `index.ts` also fills this week's plan (7 dinners incl. a night out, leftovers lunches).

URL flags: `?demo=1&fresh=1` = first run (onboarding), `?demo=1&noplan=1` = empty week.
