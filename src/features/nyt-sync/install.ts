import { BOOKMARKLET_CODE, BOOKMARKLET_PLACEHOLDER } from "./bookmarklet.generated";

/** The bookmark's javascript: URL, pointing at this Cookin's origin. */
export function bookmarkletHref(origin = location.origin): string {
  return "javascript:" + encodeURIComponent(BOOKMARKLET_CODE.split(BOOKMARKLET_PLACEHOLDER).join(origin));
}

/** Plain JS for automation (Claude in Chrome's JavaScript tool): set the weekly flag, then run. */
export function automationScript(origin = location.origin): string {
  return `window.__cookinOpts={via:"weekly"};` + BOOKMARKLET_CODE.split(BOOKMARKLET_PLACEHOLDER).join(origin);
}

/**
 * One-liner for the weekly automation, run on cooking.nytimes.com/recipe-box. Works once the
 * bookmark has been tapped there at least once (it stores itself in that site's localStorage).
 */
export const AUTOMATION_SNIPPET = `window.__cookinOpts={via:"weekly"};var s=localStorage.getItem("cookin-button");s?((0,eval)(s),"started"):"missing: tap the Sync to Cookin bookmark once on this page"`;
