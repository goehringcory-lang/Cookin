import { findUrl, readRecipePage } from "../../../src/features/nyt-sync/core/link";
import type { Env } from "../../_lib";
import { json } from "../../_lib";

/**
 * POST /api/recipes/fetch {url} — read one recipe page server-side (NYT Cooking, NYT gift links,
 * or any site with schema.org Recipe JSON-LD). Returns the parsed recipe; the app saves it.
 *
 *   200 {ok: true, source, recipe}
 *   200 {ok: false, reason: "no_recipe" | "blocked" | "unreachable", status?, title?, imageUrl?}
 *       -> the app offers the paste-the-ingredients fallback, prefilled with what we could read.
 *   400 {error: "bad_url"}
 */
const MAX_BYTES = 4_000_000;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

export const onRequestPost: PagesFunction<Env> = async ({ request }) => {
  let body: { url?: unknown };
  try { body = await request.json(); } catch { return json({ error: "bad_json" }, 400); }
  const url = findUrl(String(body?.url ?? ""));
  if (!url) return json({ error: "bad_url" }, 400);
  const u = new URL(url);
  // Public web pages only: no IP literals, no localhost, no odd ports.
  if (/^(\d+\.){3}\d+$|^\[|localhost$|\.local$|\.internal$/i.test(u.hostname) || (u.port && u.port !== "443" && u.port !== "80")) return json({ error: "bad_url" }, 400);
  if (u.protocol === "http:") u.protocol = "https:";

  let res: Response;
  try {
    res = await fetch(u.toString(), {
      redirect: "follow",
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml", "accept-language": "en-US,en;q=0.9" },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return json({ ok: false, reason: "unreachable" });
  }
  const html = await readCapped(res);
  // Short links (nyti.ms) resolve to the real recipe URL; parse against the final URL but keep the gift code.
  const finalUrl = res.url && res.url.startsWith("https://") ? mergeGift(res.url, u.toString()) : u.toString();
  const page = readRecipePage(html, finalUrl);
  if (page.ok) return json(page);
  if (!res.ok || /captcha|are you a robot|access denied/i.test(html.slice(0, 20_000))) return json({ ok: false, reason: "blocked", status: res.status, title: page.title, imageUrl: page.imageUrl });
  return json(page);
};

async function readCapped(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let out = "", n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.byteLength;
    out += dec.decode(value, { stream: true });
    if (n > MAX_BYTES) { await reader.cancel(); break; }
  }
  return out + dec.decode();
}

function mergeGift(finalUrl: string, asked: string): string {
  try {
    const code = new URL(asked).searchParams.get("unlocked_article_code");
    const f = new URL(finalUrl);
    if (code && !f.searchParams.has("unlocked_article_code")) f.searchParams.set("unlocked_article_code", code);
    return f.toString();
  } catch { return finalUrl; }
}
