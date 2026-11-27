/**
 * Read recipe pages through the bookmark button (which fetches with Cory's NYT session) and parse
 * them. Pure apart from the injected fetchPage, so it runs in the app and in tests.
 */
import { recipeFromLdTexts } from "./jsonld";
import type { FetchedPage, ImportRecipe } from "./protocol";

export interface ReadResult {
  recipes: ImportRecipe[];
  /** Numeric ids whose page had no readable recipe (guides, external saves, paywall). */
  failed: string[];
  /** Set when reading stopped early (signed out, blocked, rate limited). */
  stopped?: string;
}

export type FetchPage = (numericId: string) => Promise<FetchedPage>;
export type ReadProgress = (done: number, of: number) => void;

const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export async function readRecipes(ids: string[], fetchPage: FetchPage, progress: ReadProgress = () => {}, opts: { concurrency?: number; delayMs?: number } = {}): Promise<ReadResult> {
  const recipes: ImportRecipe[] = [], failed: string[] = [];
  let next = 0, done = 0, streak = 0;
  let stopped: string | undefined;
  const delay = opts.delayMs ?? 700;
  const one = async (id: string) => {
    let page: FetchedPage;
    try { page = await fetchPage(id); } catch { failed.push(id); streak++; return; }
    if (page.status === 403 || page.status === 429) { stopped = "NYT Cooking asked us to slow down. Try again in a little while."; return; }
    if (page.blocked) { stopped = "NYT Cooking showed a robot check. Open any recipe there, finish the check, then sync again."; return; }
    const r = page.status < 400 ? recipeFromLdTexts(page.ld || [], /\/recipes\/\d+/.test(page.url) ? page.url : `https://cooking.nytimes.com/recipes/${id}`) : undefined;
    if (r && r.id === `nyt-${id}`) { recipes.push(r); streak = 0; }
    else if (r) { recipes.push({ ...r, id: `nyt-${id}` }); streak = 0; }
    else { failed.push(id); streak++; }
  };
  const worker = async () => {
    while (next < ids.length && !stopped) {
      const id = ids[next++];
      await one(id);
      // Five unreadable pages in a row before any success: the session can't see recipes.
      if (!stopped && streak >= 5 && !recipes.length) stopped = "Couldn't read recipe pages. Make sure you're signed in to NYT Cooking, then sync again.";
      progress(++done, ids.length);
      if (next < ids.length && !stopped && delay) await wait(delay + Math.round(Math.random() * delay * 0.6));
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(opts.concurrency ?? 2, 3)) }, worker));
  return { recipes, failed, ...(stopped ? { stopped } : {}) };
}
