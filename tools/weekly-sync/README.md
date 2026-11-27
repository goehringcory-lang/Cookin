# Weekly Sunday NYT sync

Every Sunday a Claude scheduled task drives **Claude in Chrome on Cory's computer** and runs the same
"Sync to Cookin" button Cory uses by hand. No API token, no Cloudflare Access bypass, and no recipe
data passes through Claude: the NYT tab and the Cookin window talk to each other directly
(see `src/features/nyt-sync/core/protocol.ts`), and Cookin saves with its own signed-in session.

## One-time setup (Cory, on the computer)

1. In Cookin → Recipes → **Sync**, drag **Sync to Cookin** to Chrome's bookmarks bar.
2. Open https://cooking.nytimes.com/recipe-box (signed in) and tap the bookmark once. Besides syncing,
   this stores the button in that site's local storage so the weekly run can start it with one line.
3. Allow pop-ups for `cooking.nytimes.com` if Chrome asks (address bar icon → Always allow).
4. Claude in Chrome: the extension is installed and connected, with site access for
   `cooking.nytimes.com` and the Cookin domain.
5. Cloudflare Access: set the Cookin application's **session duration to 1 month** so the Sunday run
   doesn't land on a login page. (Zero Trust → Access → Applications → Cookin → Session duration.)

If the button is updated (rare: parsing lives in the app), re-drag it and tap it once on the Recipe Box.

## The scheduled task

- Schedule: Sundays, 9:00 AM in Cory's time zone (`0 9 * * 0`).
- Needs: Cory's computer awake, Chrome open, Claude in Chrome connected.
- Replace `<APP>` with Cookin's URL (e.g. `https://cookin.pages.dev`).

Prompt for the task:

```text
Weekly Cookin NYT sync. Use Claude in Chrome on Cory's computer. Do not read, copy or summarize recipe
contents; the page does the transfer itself.

1. Call tabs_context_mcp, then open a new tab at https://cooking.nytimes.com/recipe-box.
   If NYT shows a sign-in page or "Log in", stop and report: "NYT Cooking is signed out on your computer."
2. Run this with the JavaScript tool in that tab and read the result:
   window.__cookinOpts={via:"weekly"};var s=localStorage.getItem("cookin-button");s?((0,eval)(s),"started"):"missing: tap the Sync to Cookin bookmark once on this page"
   - "missing…": stop and report that Cory needs to tap the Sync to Cookin bookmark once on the Recipe Box.
   - An error mentioning eval or Content Security Policy: use the fallback below.
3. Every 5 seconds (up to 5 minutes), read document.documentElement.dataset.cookinSync with the JavaScript
   tool until it is "ready" or "error". The Recipe Box scrolls by itself while it is "collecting".
4. When "ready": click the button with id cookin-sync-go using a real click (find it, then the computer
   tool's left_click). It must be a real click, or Chrome blocks the Cookin window as a pop-up.
   A Cookin window opens. Leave both tabs open.
5. Every 10 seconds (up to 15 minutes), read document.documentElement.dataset.cookinSync in the NYT tab
   until it is "done" or "error". Then read document.getElementById("cookin-sync").innerText.
6. If the Cookin window shows a Cloudflare sign-in page, stop and report: "Cookin needs you to sign in
   again on your computer." Do not enter any email or code.
7. Close the tabs you opened. Reply with one line: the overlay's result text (for example
   "Synced: 3 new." or "You're up to date"), or what went wrong.

If step 2 fails because the page blocks eval (Content Security Policy), stop and report:
"The weekly sync couldn't start the button on its own this week. Tap Sync to Cookin on your Recipe Box."
```

## What Cory sees

- Cookin → Recipes shows "Synced Sunday · N recipes". The badge turns amber when the last sync is more
  than 9 days old, so a missed Sunday is visible.
- The sync sheet says "Last synced Sunday by the Sunday auto-sync: 3 new, 214 in your Recipe Box."

## Testing it by hand

On the computer, open the Recipe Box, open DevTools → Console, paste the step 2 line, then click
**Sync to Cookin** in the panel. That is exactly what the scheduled task does.
