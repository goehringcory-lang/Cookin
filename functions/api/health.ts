import type { Env } from "../_lib";
import { currentCursor, json } from "../_lib";

export const onRequestGet: PagesFunction<Env> = async ({ env }) => json({ ok: true, cursor: await currentCursor(env.DB) });
