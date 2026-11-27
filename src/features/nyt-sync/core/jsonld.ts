/**
 * Pure helpers that turn an NYT Cooking recipe page (schema.org JSON-LD) into an import record.
 * No DOM and no React: this file is bundled into the bookmarklet, used by the app and tested in node.
 */
import type { ImportRecipe } from "./protocol";

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", frac12: "½", frac14: "¼", frac34: "¾", frac13: "⅓", frac23: "⅔",
  deg: "°", eacute: "é", egrave: "è", ntilde: "ñ", uuml: "ü", ouml: "ö", auml: "ä", ccedil: "ç", times: "×", frasl: "⁄",
};

/** Decode HTML entities, drop tags, collapse whitespace. JSON-LD text often carries &amp;#39; and <a> tags. */
export function cleanText(input: unknown): string {
  let s = String(input ?? "");
  for (let i = 0; i < 2 && /&[#a-z0-9]+;/i.test(s); i++) {
    s = s.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
      }
      return NAMED[e.toLowerCase()] ?? m;
    });
  }
  return s.replace(/<[^>]*>/g, " ").replace(/[\s\u00a0]+/g, " ").trim();
}

/** ISO 8601 duration ("PT1H30M", "P0DT45M", "PT90M") to whole minutes. undefined when absent or zero. */
export function isoMinutes(d: unknown): number | undefined {
  if (typeof d !== "string") return undefined;
  const m = d.trim().match(/^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
  if (!m) return undefined;
  const [, days, h, min, sec] = m.map(x => (x ? parseFloat(x) : 0)) as number[];
  const total = Math.round(days * 1440 + h * 60 + min + sec / 60);
  return total > 0 ? total : undefined;
}

/** "https://cooking.nytimes.com/recipes/1017518-panzanella?x=1" -> "1017518". */
export function nytIdFromUrl(url: unknown): string | undefined {
  const m = String(url ?? "").match(/cooking\.nytimes\.com\/recipes\/(\d+)/) || String(url ?? "").match(/^\/recipes\/(\d+)/);
  return m ? m[1] : undefined;
}
/** Canonical recipe URL without query or hash. */
export const nytRecipeUrl = (url: string) => {
  const id = nytIdFromUrl(url);
  const m = url.match(/^(https:\/\/cooking\.nytimes\.com\/recipes\/\d+[^?#]*)/);
  return m ? m[1] : id ? `https://cooking.nytimes.com/recipes/${id}` : url;
};

type Json = Record<string, unknown>;
const asArray = (x: unknown): unknown[] => (x == null ? [] : Array.isArray(x) ? x : [x]);
const isType = (x: unknown, t: string) => !!x && typeof x === "object" && asArray((x as Json)["@type"]).some(v => v === t);

/** Find the schema.org Recipe object in a parsed JSON-LD blob (handles @graph and arrays). */
export function findRecipeNode(blob: unknown): Json | undefined {
  const queue = asArray(blob);
  for (let i = 0; i < queue.length && i < 200; i++) {
    const x = queue[i];
    if (!x || typeof x !== "object") continue;
    if (isType(x, "Recipe")) return x as Json;
    const g = (x as Json)["@graph"];
    if (g) queue.push(...asArray(g));
    if (Array.isArray(x)) queue.push(...x);
  }
  return undefined;
}

function instructions(x: unknown, out: string[] = [], depth = 0): string[] {
  if (depth > 4) return out;
  for (const step of asArray(x)) {
    if (typeof step === "string") {
      // Some sites put all steps in one string separated by newlines.
      for (const part of step.split(/\n+/)) { const t = cleanText(part); if (t) out.push(t); }
    } else if (step && typeof step === "object") {
      const s = step as Json;
      if (isType(s, "HowToSection") || s.itemListElement) instructions(s.itemListElement, out, depth + 1);
      else { const t = cleanText(s.text ?? s.name ?? ""); if (t) out.push(t); }
    }
  }
  return out;
}

function imageUrl(x: unknown): string | undefined {
  // Prefer the widest ImageObject, else the first string URL.
  let best: { url: string; w: number } | undefined;
  for (const im of asArray(x)) {
    const url = typeof im === "string" ? im : im && typeof im === "object" ? String((im as Json).url ?? (im as Json).contentUrl ?? "") : "";
    if (!/^https:\/\//.test(url)) continue;
    const w = im && typeof im === "object" ? Number((im as Json).width) || 0 : 0;
    if (!best || w > best.w) best = { url, w };
  }
  return best?.url;
}

function splitTags(...xs: unknown[]): string[] {
  const seen = new Set<string>(), out: string[] = [];
  for (const x of xs) for (const v of asArray(x)) for (const part of String(v ?? "").split(",")) {
    const t = cleanText(part).toLowerCase();
    if (t && t.length <= 40 && !seen.has(t)) { seen.add(t); out.push(t); }
  }
  return out.slice(0, 20);
}

/** Convert a schema.org Recipe node to an import record. Returns undefined if it has no ingredients. */
export function recipeFromJsonLd(node: Json, pageUrl: string): ImportRecipe | undefined {
  const id = nytIdFromUrl(pageUrl) ?? nytIdFromUrl(node.url) ?? nytIdFromUrl(node["@id"]);
  if (!id) return undefined;
  const ingredients = asArray(node.recipeIngredient ?? node.ingredients).map(cleanText).filter(Boolean);
  if (!ingredients.length) return undefined;
  const title = cleanText(node.name) || cleanText(node.headline) || "Untitled recipe";
  const y = asArray(node.recipeYield).map(cleanText).filter(Boolean);
  // recipeYield is often ["4", "4 servings"]; prefer the descriptive one.
  const yieldText = y.find(v => /[a-z]/i.test(v)) ?? (y[0] ? `${y[0]} servings` : undefined);
  const prep = isoMinutes(node.prepTime), cook = isoMinutes(node.cookTime);
  const total = isoMinutes(node.totalTime) ?? (prep || cook ? (prep ?? 0) + (cook ?? 0) : undefined);
  const steps = instructions(node.recipeInstructions);
  return {
    id: `nyt-${id}`,
    title: title.slice(0, 200),
    url: nytRecipeUrl(typeof pageUrl === "string" && pageUrl.startsWith("https://") ? pageUrl : `https://cooking.nytimes.com/recipes/${id}`),
    ingredients: ingredients.slice(0, 100),
    steps: steps.length ? steps.slice(0, 60) : undefined,
    totalMinutes: total,
    yield: yieldText?.slice(0, 80),
    servings: servingsFromYield(yieldText),
    tags: splitTags(node.recipeCategory, node.recipeCuisine, node.keywords),
    imageUrl: imageUrl(node.image ?? node.thumbnailUrl),
  };
}

/** Raw text of every JSON-LD script block in an HTML string. */
export function jsonLdTexts(html: string): string[] {
  const out: string[] = [];
  const re = /<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

/** Recipe from the JSON-LD block texts of a page (what the bookmark button sends). */
export function recipeFromLdTexts(texts: string[], pageUrl: string): ImportRecipe | undefined {
  for (const t of texts) {
    let blob: unknown;
    try { blob = JSON.parse(t.trim()); } catch { continue; }
    const node = findRecipeNode(blob);
    if (node) { const r = recipeFromJsonLd(node, pageUrl); if (r) return r; }
  }
  return undefined;
}

/** Parse a recipe page's HTML. */
export const recipeFromHtml = (html: string, pageUrl: string) => recipeFromLdTexts(jsonLdTexts(html), pageUrl);

/** Number of servings in a yield string ("4 to 6 servings" -> 6, "Makes 2 dozen" -> undefined). */
export function servingsFromYield(y?: string): number | undefined {
  if (!y || !/serv|people|portion|^\s*\d+\s*$/i.test(y)) return undefined;
  const nums = (y.match(/\d+/g) || []).map(Number).filter(n => n > 0 && n < 100);
  return nums.length ? Math.max(...nums) : undefined;
}
