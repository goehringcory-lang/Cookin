# NYT sync

Brings Cory's NYT Cooking Recipe Box into Cookin. NYT has no API, so a bookmark button on
cooking.nytimes.com reads the Recipe Box with Cory's own session.

| File | Runs in | Does |
|---|---|---|
| `button.ts`, `collector.ts` | NYT tab (bookmarklet bundle) | Finds saved recipe ids, opens Cookin, fetches pages Cookin asks for |
| `ImportScreen.tsx` (`#import`) | Cookin window | Handshake, reads only new recipes, parses, saves |
| `core/protocol.ts` | both | Message types, request sanitizing |
| `core/jsonld.ts` | Cookin + tests | schema.org JSON-LD → recipe |
| `core/read.ts` | Cookin + tests | Polite page reading, stops on sign-out / robot check / 429 |
| `core/merge.ts` | server + local mode | Source-field merge, archive/unarchive by `boxIds` |
| `save.ts` | Cookin | POST `/api/import/recipes` (or local merge without a backend) |
| `SyncSheet.tsx` | Cookin | Install the button, last sync, paste fallback |

The button is deliberately thin: parsing lives in the app, so fixes ship with a deploy and the
bookmark never needs reinstalling. Rebuild it after changing `button.ts`/`collector.ts`/protocol:
`npm run build:bookmarklet` (a test fails if the generated file is stale).

Flow: button → `window.open(<app>/?import=1&nonce=…#import)` → app sends `hello` to the opener every
500 ms → button answers `box` (all ids) → app asks `fetch` for each new id → button answers `page`
(JSON-LD only) → app POSTs one import with `boxIds` → app sends `status` with the result. Origins and
the nonce are checked on both sides.

Weekly Sunday auto-sync: see `tools/weekly-sync/README.md`.
