/** Sync status badge and the "Sync from NYT" sheet on the Recipes screen. */
import { useEffect, useRef, useState } from "react";
import { useDoc } from "@shared/store";
import type { NytSyncInfo } from "@shared/types";
import { navigate } from "../../app/nav";
import { AUTOMATION_SNIPPET, bookmarkletHref } from "./install";
import { Sheet } from "@shared/ui";
import "./nyt-sync.css";

export const useNytSyncInfo = (): NytSyncInfo | undefined => useDoc("meta", "nyt");

/** "today", "yesterday", "Sunday", "Nov 3". */
export function syncWhen(at: number, now = Date.now()): string {
  const d = new Date(at), n = new Date(now);
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(n) - day(d)) / 86_400_000);
  if (diff <= 0) return "today";
  if (diff === 1) return "yesterday";
  if (diff < 7) return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function SyncStatusBadge({ count, onClick }: { count: number; onClick?: () => void }) {
  const info = useNytSyncInfo();
  const stale = !info || Date.now() - info.at > 9 * 86_400_000;
  const text = info ? `Synced ${syncWhen(info.at)} · ${count} recipes` : "Not synced yet";
  return (
    <button type="button" className={`ck-badge ${stale ? "ck-badge--low" : "ck-badge--have"} ck-nyt-badge`} onClick={onClick} aria-label={`${text}. Sync options`}>
      {text}
    </button>
  );
}

export function SyncSheet({ onClose }: { onClose: () => void }) {
  const info = useNytSyncInfo();
  const link = useRef<HTMLAnchorElement>(null);
  const [copied, setCopied] = useState<"" | "bookmark" | "script">("");
  // React blocks javascript: URLs in JSX, so the bookmark's href is set directly.
  useEffect(() => { link.current?.setAttribute("href", bookmarkletHref()); }, []);
  const copy = async (what: "bookmark" | "script") => {
    try { await navigator.clipboard.writeText(what === "bookmark" ? bookmarkletHref() : AUTOMATION_SNIPPET); setCopied(what); setTimeout(() => setCopied(""), 2000); } catch { /* clipboard blocked */ }
  };
  return (
    <Sheet open onClose={onClose} title="Sync from NYT Cooking">
      <div className="ck-nyt-sheet">
        <div>
          <p className="ck-muted ck-small">
            {info ? `Last synced ${syncWhen(info.at)} ${info.via === "weekly" ? "by the Sunday auto-sync" : "with the button"}: ${info.added ? `${info.added} new` : "no new recipes"}, ${info.total} in your Recipe Box.` : "Bring in your whole Recipe Box once, then just the new ones."}
          </p>
        </div>
        <div className="ck-card ck-card--pad ck-stack">
          <strong>On your computer</strong>
          <ol className="ck-small">
            <li>Drag this button to your bookmarks bar: <br /><a ref={link} className="ck-nyt-bookmark" onClick={e => e.preventDefault()} draggable>Sync to Cookin</a></li>
            <li>Open your <a href="https://cooking.nytimes.com/recipe-box" target="_blank" rel="noreferrer">NYT Recipe Box</a> while signed in.</li>
            <li>Tap <b>Sync to Cookin</b> in your bookmarks. Only new recipes are read.</li>
          </ol>
          <div className="ck-row">
            <button className="ck-btn ck-btn--ghost ck-btn--sm" onClick={() => copy("bookmark")}>{copied === "bookmark" ? "Copied" : "Copy bookmark link"}</button>
          </div>
          <p className="ck-muted ck-small">On a phone, save any page as a bookmark, then edit it and paste the copied link as its address.</p>
        </div>
        <div className="ck-card ck-card--pad ck-stack">
          <strong>Every Sunday, automatically</strong>
          <p className="ck-muted ck-small">Claude runs the same sync in Chrome on your computer each Sunday. Your computer needs to be on with Chrome open and signed in to NYT Cooking and Cookin.</p>
          <div className="ck-row"><button className="ck-btn ck-btn--ghost ck-btn--sm" onClick={() => copy("script")}>{copied === "script" ? "Copied" : "Copy weekly-sync line"}</button></div>
        </div>
        <div className="ck-row">
          <button className="ck-btn ck-btn--secondary" onClick={() => { onClose(); navigate("import"); }}>Paste from NYT</button>
          <button className="ck-btn ck-btn--ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </Sheet>
  );
}
