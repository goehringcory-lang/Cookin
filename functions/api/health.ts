import type { Env } from "../_lib";
import { json } from "../_lib";

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const row = await env.DB.prepare("SELECT n FROM seq WHERE k = 'docs'").first<{ n: number }>();
  return json({ ok: true, cursor: row?.n ?? 0 });
};
