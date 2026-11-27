import type { Env } from "./_lib";
import { json } from "./_lib";

/**
 * Private access for /api/*. Allowed when any of:
 *  1. Authorization: Bearer <API_TOKEN>            (automation: weekly NYT sync)
 *  2. A valid Cloudflare Access JWT (Cf-Access-Jwt-Assertion header or CF_Authorization cookie):
 *     RS256 signature from https://<ACCESS_TEAM_DOMAIN>/cdn-cgi/access/certs, aud = ACCESS_AUD,
 *     not expired, email in ALLOWED_EMAILS. The plain email header alone is never trusted.
 *  3. DEV_ALLOW_ANON=1                              (local wrangler dev only)
 */
export const onRequest: PagesFunction<Env> = async ctx => {
  const url = new URL(ctx.request.url);
  if (!url.pathname.startsWith("/api/")) return ctx.next();
  const env = ctx.env;
  const auth = ctx.request.headers.get("authorization") || "";
  if (env.API_TOKEN && env.API_TOKEN.length >= 24 && timingSafeEqual(auth, `Bearer ${env.API_TOKEN}`)) return ctx.next();
  if (env.DEV_ALLOW_ANON === "1") return ctx.next();
  const token = ctx.request.headers.get("cf-access-jwt-assertion") || cookie(ctx.request.headers.get("cookie"), "CF_Authorization");
  if (token && env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD) {
    const email = await verifyAccessJwt(token, env.ACCESS_TEAM_DOMAIN, env.ACCESS_AUD).catch(() => null);
    const allowed = (env.ALLOWED_EMAILS || "").toLowerCase().split(",").map(s => s.trim()).filter(Boolean);
    if (email && allowed.includes(email.toLowerCase())) return ctx.next();
  }
  return json({ error: "not_authorized" }, 401);
};

function cookie(header: string | null, name: string): string | null {
  for (const part of (header || "").split(";")) { const [k, ...v] = part.trim().split("="); if (k === name) return v.join("="); }
  return null;
}
function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
const b64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), c => c.charCodeAt(0));
type Jwk = JsonWebKey & { kid: string };
let certCache: { at: number; keys: Jwk[] } | null = null;
async function accessKeys(team: string): Promise<Jwk[]> {
  if (certCache && Date.now() - certCache.at < 3600_000) return certCache.keys;
  const res = await fetch(`https://${team}/cdn-cgi/access/certs`);
  const body = (await res.json()) as { keys: Jwk[] };
  certCache = { at: Date.now(), keys: body.keys };
  return body.keys;
}
/** Returns the verified email, or null. */
async function verifyAccessJwt(token: string, team: string, aud: string): Promise<string | null> {
  const [h, p, sig] = token.split(".");
  if (!h || !p || !sig) return null;
  const header = JSON.parse(new TextDecoder().decode(b64url(h))) as { kid?: string; alg?: string };
  if (header.alg !== "RS256") return null;
  const jwk = (await accessKeys(team)).find(k => k.kid === header.kid);
  if (!jwk) { certCache = null; return null; }
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64url(sig), new TextEncoder().encode(`${h}.${p}`));
  if (!ok) return null;
  const claims = JSON.parse(new TextDecoder().decode(b64url(p))) as { aud?: string | string[]; exp?: number; email?: string; iss?: string };
  const auds = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!auds.includes(aud)) return null;
  if (!claims.exp || claims.exp * 1000 < Date.now()) return null;
  if (claims.iss && claims.iss !== `https://${team}`) return null;
  return claims.email || null;
}
