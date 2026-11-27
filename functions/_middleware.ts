import type { Env } from "./_lib";
import { json } from "./_lib";

/**
 * Private access. Production sits behind Cloudflare Access (only Cory's email), which adds
 * Cf-Access-Authenticated-User-Email on every request. Automation (weekly NYT sync) uses
 * `Authorization: Bearer <API_TOKEN>`. Locally, DEV_ALLOW_ANON=1 skips the check.
 */
export const onRequest: PagesFunction<Env> = async ctx => {
  const url = new URL(ctx.request.url);
  if (!url.pathname.startsWith("/api/")) return ctx.next();
  const env = ctx.env;
  const auth = ctx.request.headers.get("authorization") || "";
  if (env.API_TOKEN && auth === `Bearer ${env.API_TOKEN}`) return ctx.next();
  const email = (ctx.request.headers.get("cf-access-authenticated-user-email") || "").toLowerCase();
  const allowed = (env.ALLOWED_EMAILS || "").toLowerCase().split(",").map(s => s.trim()).filter(Boolean);
  if (email && allowed.includes(email)) return ctx.next();
  if (env.DEV_ALLOW_ANON === "1") return ctx.next();
  return json({ error: "not_authorized" }, 401);
};
