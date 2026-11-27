/**
 * Runs inside cooking.nytimes.com (bundled into the bookmark button): finds the saved recipe ids
 * and fetches recipe pages with Cory's own signed-in session.
 */
import { nytIdFromUrl } from "./core/jsonld";
import type { FetchedPage } from "./core/protocol";

const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const SKIP = "header, footer, nav, [role=navigation], [aria-label*=ecommend i], [data-testid*=ecommend i], [class*=ecommend i]";

/** Recipe ids linked from a document's main content (skips header/footer/recommendation rails). */
export function boxIdsIn(root: ParentNode): string[] {
  const ids: string[] = [];
  root.querySelectorAll<HTMLAnchorElement>('a[href*="/recipes/"]').forEach(a => {
    if (a.closest(SKIP)) return;
    const href = a.getAttribute("href") || "";
    const id = nytIdFromUrl(href.startsWith("/") ? "https://cooking.nytimes.com" + href : href);
    if (id) ids.push(id);
  });
  return ids;
}

/**
 * Every recipe id in the Recipe Box. Scrolls the live page (collecting while scrolling, in case the
 * list is virtualized), presses "Load more"/"Show more", then probes ?page=N in case it is paginated.
 */
export async function collectBoxIds(progress: (count: number) => void, opts: { maxRounds?: number } = {}): Promise<string[]> {
  const found = new Set<string>();
  const add = (ids: string[]) => { let n = 0; for (const id of ids) if (!found.has(id)) { found.add(id); n++; } return n; };
  const root = () => document.querySelector("main") || document.body;
  const scroller = document.scrollingElement || document.documentElement;
  const startY = scroller.scrollTop;
  let stable = 0;
  for (let round = 0; round < (opts.maxRounds ?? 150) && stable < 4; round++) {
    const before = found.size;
    add(boxIdsIn(root()));
    window.scrollTo(0, scroller.scrollHeight);
    root().querySelectorAll("button").forEach(b => {
      if (/^(load|show|see|view) more/i.test((b.textContent || "").trim()) && !b.disabled) b.click();
    });
    progress(found.size);
    await wait(900);
    add(boxIdsIn(root()));
    stable = found.size === before ? stable + 1 : 0;
  }
  window.scrollTo(0, startY);
  // Paginated variant: /recipe-box?page=2 … stops at the first page that adds nothing new.
  const base = new URL(location.href);
  for (let page = 2; page <= 80; page++) {
    base.searchParams.set("page", String(page));
    try {
      const res = await fetch(base.href, { credentials: "include" });
      if (!res.ok) break;
      const doc = new DOMParser().parseFromString(await res.text(), "text/html");
      if (!add(boxIdsIn(doc.querySelector("main") || doc.body))) break;
      progress(found.size);
      await wait(400 + Math.random() * 300);
    } catch { break; }
  }
  return [...found];
}

const BLOCKED = /captcha|datadome|are you a robot|unusual activity/i;

/** Fetch one recipe page and keep only its JSON-LD (small enough to postMessage). */
export async function fetchRecipePage(numericId: string): Promise<FetchedPage> {
  if (!/^\d{1,12}$/.test(numericId)) return { status: 400, url: "", ld: [] };
  const res = await fetch(`https://cooking.nytimes.com/recipes/${numericId}`, { credentials: "include" });
  const html = await res.text();
  const ld: string[] = [];
  const re = /<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) ld.push(m[1]);
  return { status: res.status, url: res.url, ld, ...(!ld.length && BLOCKED.test(html.slice(0, 30000)) ? { blocked: true } : {}) };
}
