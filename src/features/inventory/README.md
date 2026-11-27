# Kitchen (inventory) feature

Exports `KitchenScreen` for the `#kitchen` tab.

- **Tabs:** Pantry, Fridge, Freezer, Spices (pantry spices and dried herbs, so the pantry stays short).
- **Rows:** tap the name to flip Have / Out, or pick Have / Low / Out on the right. Press and hold for the item sheet
  (status, "put it on my grocery list" for out items, remove; custom items can also be renamed and moved).
- **Grocery list rules** (matches docs/ARCHITECTURE.md): Low goes on the list. Out goes on the list when a planned
  recipe in the next 14 days needs it (the row says which recipe), or when added by hand with "Add to list".
  Hand-added lines are written to `list.manual` with id `inv-<itemId>` and removed when the item is back in stock.
- **Search:** filters your kitchen across all tabs, offers catalog items you don't stock yet (tap to add, "Need it" to
  add straight to the list), and "Add '…' as a new item" for anything else (saved to `customItems` as `c-<slug>`).
- **Just shopped:** lists everything low or out; items on your list (or already checked off on the List tab) are
  pre-selected. One tap marks them all Have.
- Every change shows a toast with Undo.

Files: `KitchenScreen.tsx` (store wiring), `InventoryScreen.tsx` (UI, props only), `ItemRow.tsx`, `Sheets.tsx`,
`logic.ts` (pure helpers, unit tested), `icons.ts`, `inventory.css` (uses `--ck-*` design tokens with fallbacks).

Phone walkthrough: `npm run build && npx vite preview --port 4174 & node e2e/kitchen.walkthrough.cjs`.
