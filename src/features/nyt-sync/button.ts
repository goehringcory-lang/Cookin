/**
 * The "Sync to Cookin" bookmark button. Bundled by tools/bookmarklet/build.mjs into a javascript:
 * URL and run on cooking.nytimes.com/recipe-box.
 *
 * It is a thin proxy (see core/protocol.ts): it finds the saved recipe ids, opens Cookin in a new
 * window, then fetches whichever recipe pages Cookin asks for with Cory's NYT session. Cookin does
 * the parsing and saving, so the bookmark never needs reinstalling when parsing improves.
 *
 * For automation (weekly sync): `document.documentElement.dataset.cookinSync` reports the state
 * (collecting | ready | waiting | reading | saving | done | error), the main button has id
 * "cookin-sync-go" and the status text has id "cookin-sync-msg".
 */
import { collectBoxIds, fetchRecipePage } from "./collector";
import { isFetch, isHello, isStatus, PROTOCOL_VERSION, type BoxMessage, type ClipboardPayload, type PageMessage } from "./core/protocol";

export interface ButtonOptions {
  /** Cookin's origin, e.g. https://cookin.pages.dev (baked in when the button is installed). */
  app: string;
  via?: "button" | "weekly";
}

const C = { ink: "#2A221B", muted: "#6E6257", line: "#E7DDD0", bg: "#FBF7F1", primary: "#C8492F" };

export async function runSyncButton(opts: ButtonOptions) {
  const d = document;
  const via = opts.via === "weekly" ? "weekly" : "button";
  const app = opts.app.replace(/\/+$/, "");
  const setState = (s: string) => { d.documentElement.dataset.cookinSync = s; };
  d.getElementById("cookin-sync")?.remove();

  /* ---------- overlay ---------- */
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, css: string, text = "") => {
    const e = d.createElement(tag); e.style.cssText = css; if (text) e.textContent = text; return e;
  };
  const ov = el("div", `position:fixed;right:16px;top:16px;z-index:2147483647;box-sizing:border-box;width:min(380px,calc(100vw - 32px));background:${C.bg};color:${C.ink};border:1px solid ${C.line};border-radius:20px;padding:18px;font:15px/1.45 Inter,-apple-system,system-ui,sans-serif;box-shadow:0 18px 50px rgba(42,34,27,.28);display:flex;flex-direction:column;gap:12px;text-align:left`);
  ov.id = "cookin-sync";
  ov.setAttribute("role", "dialog");
  ov.setAttribute("aria-label", "Sync to Cookin");
  const head = el("div", "display:flex;align-items:center;gap:10px");
  head.append(
    el("span", `width:32px;height:32px;border-radius:10px;background:${C.primary};color:#fff;display:grid;place-items:center;font:700 17px Georgia,serif;flex:none`, "C"),
    el("strong", "font:600 17px Georgia,serif;flex:1", "Sync to Cookin"),
  );
  const x = el("button", `border:0;background:none;font:18px sans-serif;color:${C.muted};cursor:pointer;width:44px;height:44px;border-radius:10px`, "✕");
  x.setAttribute("aria-label", "Close");
  head.appendChild(x);
  const msg = el("div", "font-weight:500");
  msg.id = "cookin-sync-msg";
  msg.setAttribute("aria-live", "polite");
  const sub = el("div", `color:${C.muted};font-size:13px`);
  const bar = el("div", `height:6px;border-radius:99px;background:${C.line};overflow:hidden;display:none`);
  const fill = el("div", `height:100%;width:0;background:${C.primary};transition:width .3s`);
  bar.appendChild(fill);
  const btns = el("div", "display:flex;gap:8px;flex-wrap:wrap");
  ov.append(head, msg, bar, sub, btns);
  d.body.appendChild(ov);

  let closed = false;
  const cleanups: (() => void)[] = [];
  x.onclick = () => { closed = true; cleanups.forEach(f => f()); ov.remove(); };
  const say = (t: string, s = "") => { msg.textContent = t; sub.textContent = s; };
  const progressBar = (n?: number, of?: number) => {
    bar.style.display = of ? "block" : "none";
    if (of) fill.style.width = `${Math.round(((n ?? 0) / of) * 100)}%`;
  };
  const button = (label: string, primary: boolean, fn: () => void, main = false) => {
    const b = el("button", `font:600 15px Inter,system-ui,sans-serif;min-height:44px;padding:0 18px;border-radius:999px;cursor:pointer;border:1px solid ${primary ? C.primary : C.line};background:${primary ? C.primary : "#fff"};color:${primary ? "#fff" : C.ink}`, label);
    if (main) b.id = "cookin-sync-go";
    b.onclick = fn;
    btns.appendChild(b);
    return b;
  };
  const clearButtons = () => { btns.textContent = ""; };
  const openBox = () => { location.href = "https://cooking.nytimes.com/recipe-box"; };

  if (!/(^|\.)cooking\.nytimes\.com$/.test(location.hostname) || !/^\/recipe-box/.test(location.pathname)) {
    setState("error");
    say("Open your NYT Cooking Recipe Box first.", "Go to cooking.nytimes.com/recipe-box while signed in, then tap Sync to Cookin again.");
    if (/(^|\.)nytimes\.com$/.test(location.hostname)) button("Open Recipe Box", true, openBox, true);
    return;
  }

  /* ---------- 1. find every saved recipe ---------- */
  setState("collecting");
  say("Looking through your Recipe Box…");
  const ids = await collectBoxIds(n => say("Looking through your Recipe Box…", `${n} saved recipes so far`));
  if (closed) return;
  if (!ids.length) {
    setState("error");
    say("No saved recipes found on this page.", "Make sure you're signed in and looking at all saved recipes, then try again.");
    return;
  }

  /* ---------- 2a. copy fallback: read every page here, paste in Cookin ---------- */
  const copyFallback = async () => {
    clearButtons();
    setState("reading");
    const pages: ClipboardPayload["pages"] = [];
    for (let i = 0; i < ids.length && !closed; i++) {
      say("Reading recipes for copying…", `${i + 1} of ${ids.length}. This takes a while the first time.`);
      progressBar(i + 1, ids.length);
      try { const page = await fetchRecipePage(ids[i]); if (page.blocked || page.status === 403 || page.status === 429) break; pages.push({ id: ids[i], page }); } catch { /* skip */ }
      await new Promise(r => setTimeout(r, 600 + Math.random() * 400));
    }
    if (closed) return;
    const text = JSON.stringify({ cookin: 3, via, ids, pages } satisfies ClipboardPayload);
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch { /* below */ }
    if (!ok) {
      const ta = el("textarea", "width:100%;height:70px;font:12px monospace");
      ta.value = text; ov.insertBefore(ta, btns); ta.select();
      try { ok = d.execCommand("copy"); } catch { /* manual */ }
    }
    setState("done");
    progressBar();
    say(ok ? `Copied ${pages.length} recipes.` : "Select the text above and copy it.", "In Cookin, open Recipes → Sync from NYT → Paste.");
    button("Open Cookin", true, () => { window.open(`${app}/?import=paste#import`, "_blank"); }, true);
  };

  /* ---------- 2b. hand-off to Cookin ---------- */
  setState("ready");
  say(`Found ${ids.length} saved recipes.`, "Cookin opens in a new window and reads only the new ones.");
  button("Sync to Cookin", true, () => start(), true).focus();
  button("Copy instead", false, () => { void copyFallback(); });

  function start() {
    const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
    // Opened inside the click handler so it isn't blocked as a pop-up.
    const win = window.open(`${app}/?import=1&nonce=${nonce}#import`, "cookin-import");
    clearButtons();
    if (!win) {
      setState("error");
      say("Your browser blocked the Cookin window.", "Allow pop-ups for cooking.nytimes.com, or copy instead.");
      button("Try again", true, () => start(), true);
      button("Copy instead", false, () => { void copyFallback(); });
      return;
    }
    setState("waiting");
    say("Opening Cookin…", "Sign in there if it asks. Keep this tab open until it finishes.");
    let talking = false;
    const onMessage = async (e: MessageEvent) => {
      if (e.origin !== app || !e.data || e.data.nonce !== nonce) return;
      const reply = (m: object) => (e.source as Window | null || win).postMessage(m, app);
      if (isHello(e.data)) {
        if (!talking) { talking = true; clearTimeout(timer); say("Connected to Cookin…"); }
        reply({ type: "cookin-box", nonce, v: PROTOCOL_VERSION, ids, via } satisfies BoxMessage);
      } else if (isFetch(e.data)) {
        const { reqId, id } = e.data;
        const page = await fetchRecipePage(id).catch(() => ({ status: 0, url: "", ld: [] }));
        reply({ type: "cookin-page", nonce, reqId, page } satisfies PageMessage);
      } else if (isStatus(e.data)) {
        const s = e.data;
        setState(s.state);
        progressBar(s.n, s.state === "reading" ? s.of : undefined);
        if (s.state === "done" && s.result) {
          const r = s.result;
          const parts = [r.added ? `${r.added} new` : "", r.updated ? `${r.updated} updated` : "", r.archived ? `${r.archived} no longer saved` : ""].filter(Boolean);
          say(parts.length ? `Synced: ${parts.join(", ")}.` : "You're up to date. No new recipes.", `${r.total} recipes in your Recipe Box.${r.failed ? ` ${r.failed} couldn't be read (guides or outside links).` : ""}`);
          clearButtons();
          button("Done", true, () => x.click(), true);
          cleanup();
        } else if (s.state === "error") {
          say(s.text);
          clearButtons();
          button("Try again", true, () => start(), true);
          cleanup();
        } else say(s.text);
      }
    };
    const cleanup = () => { window.removeEventListener("message", onMessage); clearTimeout(timer); };
    cleanups.push(cleanup);
    window.addEventListener("message", onMessage);
    const timer = setTimeout(() => {
      if (talking) return;
      cleanup();
      setState("error");
      say("Cookin didn't answer.", "If it asked you to sign in, finish that and try again. Otherwise copy instead.");
      button("Try again", true, () => start(), true);
      button("Copy instead", false, () => { void copyFallback(); });
    }, 120_000);
  }
}
