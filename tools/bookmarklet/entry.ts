// Entry for the bookmarklet bundle. __COKKIN_APP__ is replaced with the app origin when the
// app renders the install link (see src/features/nyt-sync/install.ts).
import { runSyncButton } from "../../src/features/nyt-sync/button";

declare const __COKKIN_APP__: string;
const o = (window as unknown as { __cokkinOpts?: { via?: "button" | "weekly" } }).__cokkinOpts || {};
void runSyncButton({ app: __COKKIN_APP__, via: o.via });
