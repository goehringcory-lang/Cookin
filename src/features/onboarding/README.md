# First-run onboarding

Tap-to-select walkthrough: Welcome → Pantry → Fridge → Freezer → Always buy → Done.

- One location per screen, categories as an accordion (one open at a time), common items first, "Show all" for the rest.
- "Select common" per category, with Undo. Nothing is pre-selected in inventory, so the grocery list never misses an item.
- Global search across all three locations, with "Add '<query>'" for anything not listed.
- Autosaves a draft to localStorage on every tap and calls `save()` on every step, so an interruption never loses progress.
- Always-buy staples: Milk, Bananas, Fig bars, Fruit bars pre-selected; household and kids' lunchbox suggestions; custom add.

## Use

```tsx
import { Onboarding } from './features/onboarding';

<Onboarding
  catalog={CATALOG}            // packages/ingredients CATALOG
  categories={CATEGORIES}      // optional walkthrough order
  save={(r) => store.applyOnboarding(r)}   // { haveIds, customItems, staples }
  onFinish={() => navigate('/plan')}
/>
```

Items flagged `assumed` (salt, water) or `generic` (e.g. `short-pasta`) are hidden.
`devCatalog.ts` is a fallback for local work only; the app should pass the shared catalog.
