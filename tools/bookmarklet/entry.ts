// Entry for the bookmarklet bundle. __COOKIN_APP__ is replaced with the app origin when the
// app renders the install link (see src/features/nyt-sync/install.ts).
import { runSyncButton } from "../../src/features/nyt-sync/button";

declare const __COOKIN_APP__: string;
const o = (window as unknown as { __cookinOpts?: { via?: "button" | "weekly" } }).__cookinOpts || {};
void runSyncButton({ app: __COOKIN_APP__, via: o.via });
