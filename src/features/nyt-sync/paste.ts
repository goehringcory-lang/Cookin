import { recipeFromLdTexts } from "./core/jsonld";
import { cleanNumericIds, sanitizeRequest, type ImportRecipe, type NytImportRequest } from "./core/protocol";

/**
 * Parse what the button's "Copy instead" put on the clipboard. Accepts the current format
 * ({cokkin: 3, ids, pages}), a plain import request, and the first prototype's format.
 */
export function parsePaste(text: string): { request: NytImportRequest; failed: number } | undefined {
  let j: unknown;
  try { j = JSON.parse(text.trim()); } catch { return undefined; }
  if (!j || typeof j !== "object") return undefined;
  const o = j as Record<string, unknown>;
  const via = o.via === "weekly" ? "weekly" : "button";
  if (o.cokkin === 3 && Array.isArray(o.pages)) {
    const ids = cleanNumericIds(o.ids);
    const recipes: ImportRecipe[] = [];
    let failed = 0;
    for (const p of o.pages as { id?: unknown; page?: { url?: unknown; ld?: unknown } }[]) {
      const id = String(p?.id ?? "");
      const ld = Array.isArray(p?.page?.ld) ? (p.page.ld as unknown[]).map(String) : [];
      const r = /^\d+$/.test(id) ? recipeFromLdTexts(ld, `https://cooking.nytimes.com/recipes/${id}`) : undefined;
      if (r) recipes.push({ ...r, id: `nyt-${id}` }); else failed++;
    }
    const request = sanitizeRequest({ via, total: ids.length, complete: ids.length > 0 && ids.length === (o.pages as unknown[]).length, boxIds: ids.map(id => `nyt-${id}`), recipes });
    return request ? { request, failed } : undefined;
  }
  if (o.cokkin === 2 && o.request) { const request = sanitizeRequest(o.request); return request ? { request, failed: 0 } : undefined; }
  if (o.cokkin === 1 && Array.isArray(o.recipes)) {
    // First prototype: {id, url, title, ing, time, yield, cat}
    const recipes = (o.recipes as Record<string, unknown>[]).map(r => ({ id: r.id, url: r.url, title: r.title, ingredients: r.ing, yield: r.yield, tags: typeof r.cat === "string" ? r.cat.split(",").map(s => s.trim().toLowerCase()).filter(Boolean) : undefined }));
    const request = sanitizeRequest({ via, total: o.total, complete: false, recipes });
    return request ? { request, failed: 0 } : undefined;
  }
  if (Array.isArray(o.recipes)) { const request = sanitizeRequest(o); return request ? { request, failed: 0 } : undefined; }
  return undefined;
}
