/**
 * Add a recipe from a link: NYT Cooking (including gift links) or any site with schema.org Recipe
 * JSON-LD. Pure: used by the fetch endpoint (functions/api/recipes/fetch.ts), the app and tests.
 */
import type { ImportRecipe } from "./protocol";
import { cleanText, findRecipeNode, isoMinutes, jsonLdTexts, nytIdFromUrl, nytRecipeUrl, recipeFromJsonLd, servingsFromYield } from "./jsonld";

/** First http(s) URL in pasted or shared text ("Panzanella https://nyti.ms/abc" -> the URL). */
export function findUrl(text: string): string | undefined {
  const m = String(text ?? "").match(/https?:\/\/[^\s<>"'”’)]+/i);
  if (!m) return undefined;
  const url = m[0].replace(/[.,;:!?]+$/, "");
  try { const u = new URL(url); return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : undefined; } catch { return undefined; }
}

/** NYT gift links carry unlocked_article_code (or a share param) that opens the full recipe. */
export const isGiftLink = (url: string) => /[?&](unlocked_article_code|smid|giftCopy|gift)=/i.test(url);

/** Keep the gift code on the saved URL so "Open on NYT Cooking" stays unlocked; drop tracking noise otherwise. */
export function savedUrl(url: string): string {
  if (!nytIdFromUrl(url)) return url.split("#")[0];
  const base = nytRecipeUrl(url);
  try {
    const code = new URL(url).searchParams.get("unlocked_article_code");
    return code ? `${base}?unlocked_article_code=${encodeURIComponent(code)}` : base;
  } catch { return base; }
}

/** Short stable id for a non-NYT page: "my-" + hash of host and path. */
export function webRecipeId(url: string): string {
  let key = url;
  try { const u = new URL(url); key = u.host.replace(/^www\./, "") + u.pathname.replace(/\/$/, ""); } catch { /* keep raw */ }
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return `my-${(h >>> 0).toString(36)}`;
}

/** og:title / og:image / <title>, for a partly readable page. */
export function pageHints(html: string): { title?: string; imageUrl?: string } {
  const meta = (prop: string) => {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*>`, "i");
    const tag = html.match(re)?.[0];
    const c = tag?.match(/content=["']([^"']*)["']/i)?.[1];
    return c ? cleanText(c) : undefined;
  };
  const raw = meta("og:title") ?? cleanText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  // "Panzanella Recipe • 5★" / "Panzanella Recipe - NYT Cooking" -> "Panzanella"
  const title = raw?.replace(/\s*[•|–—-]\s*(NYT Cooking|The New York Times|\d★|[\d.]+ ?stars?).*$/i, "").replace(/\s+Recipe$/i, "").trim() || undefined;
  const img = meta("og:image");
  return { title, imageUrl: img && /^https:\/\//.test(img) ? img : undefined };
}

export type ReadPage =
  | { ok: true; recipe: ImportRecipe; source: "nyt" | "manual" }
  | { ok: false; reason: "no_recipe"; title?: string; imageUrl?: string };

/** Read a recipe page's HTML. NYT pages become nyt-<id>; other sites become my-<hash>. */
export function readRecipePage(html: string, url: string): ReadPage {
  const hints = pageHints(html);
  const nytId = nytIdFromUrl(url);
  for (const t of jsonLdTexts(html)) {
    let blob: unknown;
    try { blob = JSON.parse(t.trim()); } catch { continue; }
    const node = findRecipeNode(blob);
    if (!node) continue;
    if (nytId) {
      const r = recipeFromJsonLd(node, url);
      if (r) return { ok: true, source: "nyt", recipe: { ...r, url: savedUrl(url), imageUrl: r.imageUrl ?? hints.imageUrl } };
    } else {
      // Any other site: borrow the NYT parser by giving it a fake NYT url, then put the real one back.
      const r = recipeFromJsonLd(node, "https://cooking.nytimes.com/recipes/1");
      if (r) return { ok: true, source: "manual", recipe: { ...r, id: webRecipeId(url), url: savedUrl(url), imageUrl: r.imageUrl ?? hints.imageUrl } };
    }
  }
  return { ok: false, reason: "no_recipe", ...hints };
}

/** Lines of pasted ingredient text: drops bullets, blank lines and headings like "Ingredients" or "For the sauce:". */
export function ingredientLines(text: string): string[] {
  return String(text ?? "")
    .split(/\r?\n|•/)
    .map(l => l.replace(/^\s*(?:[-*–▢☐□○●◦]|\d+[.)](?=\s))\s*/, "").replace(/\s+/g, " ").trim())
    .filter(l => l && !/^(ingredients|yield:?.*|servings?:?.*|for the [^,]{1,40}:?|[a-z ]{1,30}:)$/i.test(l))
    .slice(0, 100);
}

/** Recipe from the typed/pasted fallback form. */
export function recipeFromText(input: { title: string; ingredients: string; steps?: string; minutes?: number | string; servings?: number | string; url?: string; imageUrl?: string }): ImportRecipe | undefined {
  const ingredients = ingredientLines(input.ingredients);
  const title = cleanText(input.title).slice(0, 200);
  if (!title || !ingredients.length) return undefined;
  const url = input.url ? findUrl(input.url) : undefined;
  const nytId = url ? nytIdFromUrl(url) : undefined;
  const steps = String(input.steps ?? "").split(/\r?\n+/).map(s => s.replace(/^\s*(?:step\s*)?\d+[.):]?\s+/i, "").trim()).filter(Boolean).slice(0, 60);
  const minutes = Number(input.minutes) || isoMinutes(input.minutes) || undefined;
  const servings = Number(input.servings) || servingsFromYield(String(input.servings ?? "")) || undefined;
  const id = nytId ? `nyt-${nytId}` : url ? webRecipeId(url) : `my-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return {
    id, title, ingredients,
    url: url ? savedUrl(url) : undefined,
    steps: steps.length ? steps : undefined,
    totalMinutes: minutes && minutes > 0 && minutes < 2000 ? Math.round(minutes) : undefined,
    servings: servings && servings > 0 && servings < 100 ? Math.round(servings) : undefined,
    yield: servings ? `${Math.round(servings)} servings` : undefined,
    imageUrl: input.imageUrl && /^https:\/\//.test(input.imageUrl) ? input.imageUrl : undefined,
  };
}
