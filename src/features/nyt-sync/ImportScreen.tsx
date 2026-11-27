/**
 * #import: the window the "Sync to Cookin" bookmark button opens (?import=1&nonce=…).
 * Talks to the button over postMessage (core/protocol.ts), reads only the new recipe pages through
 * it, parses them and saves them with this window's own signed-in session.
 * Opened without a button (or ?import=paste) it shows the paste box for the "Copy instead" fallback.
 */
import { useEffect, useRef, useState } from "react";
import { store } from "@shared/store";
import { navigate } from "../../app/nav";
import { knownNytIds } from "./core/merge";
import {
  cleanNumericIds, isBox, isPage, NYT_ORIGIN,
  type FetchedPage, type FetchMessage, type HelloMessage, type NytImportRequest, type StatusMessage,
} from "./core/protocol";
import { readRecipes } from "./core/read";
import { parsePaste } from "./paste";
import { saveImport, type SaveResult } from "./save";
import "./nyt-sync.css";

type Phase =
  | { k: "connecting" }
  | { k: "reading"; n: number; of: number }
  | { k: "saving" }
  | { k: "done"; r: SaveResult; total: number; failed: number; note?: string }
  | { k: "error"; text: string }
  | { k: "paste" };

export function ImportScreen() {
  const params = new URLSearchParams(location.search);
  const nonce = params.get("nonce") || "";
  const handoff = params.get("import") === "1" && /^[a-z0-9]{8,40}$/.test(nonce) && !!window.opener;
  const [phase, setPhase] = useState<Phase>(handoff ? { k: "connecting" } : { k: "paste" });
  const started = useRef(false);

  useEffect(() => {
    if (!handoff || started.current) return;
    started.current = true;
    const opener = window.opener as Window;
    const send = (m: object) => { try { opener.postMessage(m, NYT_ORIGIN); } catch { /* opener closed */ } };
    const status = (m: Omit<StatusMessage, "type" | "nonce">) => send({ type: "cookin-status", nonce, ...m });
    const pending = new Map<number, (p: FetchedPage) => void>();
    let reqId = 0, gotBox = false;

    const fetchPage = (id: string) => new Promise<FetchedPage>((resolve, reject) => {
      const r = ++reqId;
      const t = setTimeout(() => { pending.delete(r); reject(new Error("timeout")); }, 60_000);
      pending.set(r, p => { clearTimeout(t); pending.delete(r); resolve(p); });
      send({ type: "cookin-fetch", nonce, reqId: r, id } satisfies FetchMessage);
    });

    const run = async (ids: string[], via: "button" | "weekly") => {
      try {
        await store.pull(); // make sure we know everything already saved
        const known = knownNytIds(store.list("recipes"));
        const todo = ids.filter(id => !known.has(`nyt-${id}`));
        setPhase({ k: "reading", n: 0, of: todo.length });
        status({ state: "reading", text: todo.length ? `Reading ${todo.length} new recipe${todo.length === 1 ? "" : "s"}…` : "Checking for changes…", n: 0, of: todo.length });
        const res = await readRecipes(todo, fetchPage, (n, of) => {
          setPhase({ k: "reading", n, of });
          status({ state: "reading", text: `Reading new recipes… ${n} of ${of}`, n, of });
        });
        if (res.stopped && !res.recipes.length && todo.length) throw new Error(res.stopped);
        setPhase({ k: "saving" });
        status({ state: "saving", text: "Saving to Cookin…" });
        const req: NytImportRequest = { via, total: ids.length, complete: true, boxIds: ids.map(id => `nyt-${id}`), recipes: res.recipes };
        const r = await saveImport(req);
        setPhase({ k: "done", r, total: ids.length, failed: res.failed.length, note: res.stopped });
        status({ state: "done", text: "Done", result: { added: r.added, updated: r.updated, archived: r.archived, total: ids.length, failed: res.failed.length } });
      } catch (e) {
        const text = (e as Error).message || "Something went wrong.";
        setPhase({ k: "error", text });
        status({ state: "error", text });
      }
    };

    const onMessage = (e: MessageEvent) => {
      if (e.origin !== NYT_ORIGIN || e.source !== opener || !e.data || e.data.nonce !== nonce) return;
      if (isPage(e.data)) pending.get(e.data.reqId)?.(e.data.page);
      else if (isBox(e.data) && !gotBox) {
        gotBox = true;
        clearInterval(hello);
        void run(cleanNumericIds(e.data.ids), e.data.via === "weekly" ? "weekly" : "button");
      }
    };
    window.addEventListener("message", onMessage);
    const hello = setInterval(() => send({ type: "cookin-hello", nonce } satisfies HelloMessage), 500);
    send({ type: "cookin-hello", nonce } satisfies HelloMessage);
    const giveUp = setTimeout(() => { if (!gotBox) { clearInterval(hello); setPhase({ k: "error", text: "Couldn't reach the NYT Cooking tab. Keep it open and tap Sync to Cookin again." }); } }, 30_000);
    return () => { window.removeEventListener("message", onMessage); clearInterval(hello); clearTimeout(giveUp); };
  }, [handoff, nonce]);

  return (
    <section className="ck-screen ck-import" aria-live="polite">
      <header className="ck-import__head">
        <span className="ck-import__logo" aria-hidden="true">C</span>
        <div>
          <h1 className="ck-h1">Sync from NYT Cooking</h1>
          <p className="ck-muted">Your Recipe Box, straight into Cookin.</p>
        </div>
      </header>
      {phase.k === "connecting" && <Step title="Connecting to your Recipe Box…" busy />}
      {phase.k === "reading" && (
        <Step title={phase.of ? `Reading new recipes… ${phase.n} of ${phase.of}` : "Checking for changes…"} busy
          detail="Only recipes Cookin doesn't have yet are read. Keep the NYT tab open.">
          {phase.of > 0 && <div className="ck-progress" role="progressbar" aria-valuemin={0} aria-valuemax={phase.of} aria-valuenow={phase.n}><span style={{ width: `${(phase.n / phase.of) * 100}%` }} /></div>}
        </Step>
      )}
      {phase.k === "saving" && <Step title="Saving to Cookin…" busy />}
      {phase.k === "done" && <Done {...phase} />}
      {phase.k === "error" && (
        <div className="ck-card ck-card--pad ck-stack">
          <strong>Sync didn't finish</strong>
          <p className="ck-muted">{phase.text}</p>
          <div className="ck-row"><button className="ck-btn ck-btn--secondary" onClick={() => setPhase({ k: "paste" })}>Paste instead</button></div>
        </div>
      )}
      {phase.k === "paste" && <PasteBox onDone={(r, total, failed) => setPhase({ k: "done", r, total, failed })} onError={text => setPhase({ k: "error", text })} />}
    </section>
  );
}

function Step({ title, detail, busy, children }: { title: string; detail?: string; busy?: boolean; children?: React.ReactNode }) {
  return (
    <div className="ck-card ck-card--pad ck-stack">
      <div className="ck-import__step">{busy && <span className="ck-import__spinner" aria-hidden="true" />}<strong>{title}</strong></div>
      {children}
      {detail && <p className="ck-muted ck-small">{detail}</p>}
    </div>
  );
}

function Done({ r, total, failed, note }: { r: SaveResult; total: number; failed: number; note?: string }) {
  const parts = [r.added && `${r.added} new`, r.updated && `${r.updated} updated`, r.archived && `${r.archived} no longer saved`].filter(Boolean);
  const close = () => { if (window.opener) window.close(); navigate("recipes"); };
  return (
    <div className="ck-card ck-card--pad ck-stack">
      <strong className="ck-h2">{parts.length ? `Synced: ${parts.join(", ")}` : "You're up to date"}</strong>
      <p className="ck-muted">{total} recipes in your Recipe Box.{failed ? ` ${failed} couldn't be read (guides or recipes saved from other sites).` : ""}</p>
      {r.archiveSkipped ? <p className="ck-small">{r.archiveSkipped} recipes looked missing from your box, so nothing was removed. If you did unsave them, sync again with the whole box loaded.</p> : null}
      {note && <p className="ck-small">{note} The rest will be read next time.</p>}
      <div className="ck-row">
        <button className="ck-btn ck-btn--primary" onClick={() => navigate("recipes")}>See recipes</button>
        {window.opener && <button className="ck-btn ck-btn--ghost" onClick={close}>Close window</button>}
      </div>
    </div>
  );
}

function PasteBox({ onDone, onError }: { onDone: (r: SaveResult, total: number, failed: number) => void; onError: (t: string) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      const p = parsePaste(text);
      if (!p) { onError("That doesn't look like a copy from the Sync to Cookin button."); return; }
      const r = await saveImport(p.request);
      onDone(r, p.request.total ?? p.request.recipes.length, p.failed);
    } catch (e) { onError((e as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <div className="ck-card ck-card--pad ck-stack">
      <strong>Paste from NYT</strong>
      <p className="ck-muted ck-small">On your Recipe Box, tap Sync to Cookin, then Copy instead. Paste it here.</p>
      <textarea className="ck-input ck-import__paste" value={text} onChange={e => setText(e.target.value)} placeholder="Paste here" aria-label="Copied Recipe Box data" />
      <div className="ck-row">
        <button className="ck-btn ck-btn--primary" disabled={!text.trim() || busy} onClick={go}>{busy ? "Saving…" : "Import recipes"}</button>
        <button className="ck-btn ck-btn--ghost" onClick={() => navigate("recipes")}>Cancel</button>
      </div>
    </div>
  );
}
