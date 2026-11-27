import { useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Sheet, toast } from "@shared/ui";
import { StaplesEditor } from "@features/settings";
import { useShoppingList } from "./useShoppingList";
import { addManual, clearChecked, finishShopping, removeLine, removeRestocks, toggleChecked } from "./actions";
import { canShareToKeep, copyForKeep, shareToKeep, toKeepText } from "./keep";
import type { ShoppingLine } from "./build";
import "./shopping.css";

const KEEP_URL = "https://keep.google.com/";

const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

export function ListScreen() {
  const { lines, doubleCheck, toBuy, inCart, weekOf } = useShoppingList();
  const [staplesOpen, setStaplesOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const share = canShareToKeep();
  const all = [...lines, ...doubleCheck];
  const allChecked = all.length > 0 && toBuy === 0;

  const exportText = () => toKeepText(all);

  const onCopy = async () => {
    const text = exportText();
    if (!text) return toast("Nothing left to buy.");
    const res = await copyForKeep(text);
    if (res === "copied") toast(`Copied ${plural(toBuy, "item")}. Open Keep and paste into your list.`, { label: "Open Keep", run: () => window.open(KEEP_URL, "_blank", "noopener") });
    else toast("Couldn't copy. Try Share instead.");
  };

  const onShare = async () => {
    const text = exportText();
    if (!text) return toast("Nothing left to buy.");
    const res = await shareToKeep(text);
    if (res === "copied") toast(`Copied ${plural(toBuy, "item")}. Open Keep and paste.`);
    else if (res === "shared") toast("Sent. In Keep, tap ⋮ then Show checkboxes.");
    else if (res === "failed") toast("Couldn't share or copy.");
  };

  const onAdd = (e: FormEvent) => {
    e.preventDefault();
    if (addManual(draft, weekOf)) setDraft("");
  };

  const onRemove = (line: ShoppingLine) => {
    const undo = removeLine(line, weekOf);
    const msg = removeRestocks(line)
      ? `${line.name} marked as in the kitchen.`
      : `Removed ${line.name}.`;
    toast(msg, { label: "Undo", run: undo });
  };

  const onDone = () => {
    const { restocked, bought, undo } = finishShopping(all, weekOf);
    const text = restocked ? `Nice. ${plural(restocked, "item")} back in the kitchen.` : `Cleared ${plural(bought, "item")}.`;
    toast(text, { label: "Undo", run: undo });
  };

  return (
    <section className="ck-shop" aria-labelledby="ck-shop-title">
      <header className="ck-appbar">
        <div>
          <h1 id="ck-shop-title" className="ck-shop__title">List</h1>
          <div className="ck-appbar__sub" aria-live="polite">
            {all.length === 0 ? "Nothing to buy yet" : `${toBuy} to buy${inCart ? ` · ${inCart} in cart` : ""}`}
          </div>
        </div>
        {inCart > 0 && !allChecked && (
          <div className="ck-appbar__actions">
            <button className="ck-btn ck-btn--ghost ck-btn--sm" onClick={() => clearChecked(all)}>Uncheck all</button>
          </div>
        )}
      </header>

      {all.length > 0 && (
        <div className="ck-shop__export">
          <button className="ck-btn ck-btn--primary ck-btn--block" onClick={onCopy} disabled={toBuy === 0}>
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>
            Copy for Keep
          </button>
          <p className="ck-shop__help">
            One item per line. Paste into a Keep checklist and each line becomes a checkbox.
            {share && <> Or <button className="ck-shop__link" onClick={onShare} disabled={toBuy === 0}>share to Keep</button> as a new note.</>}
          </p>
        </div>
      )}

      {all.length === 0 ? (
        <div className="ck-empty">
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" /></svg>
          <p>Plan some meals on <a href="#home">This week</a> and anything you're missing shows up here, with your staples.</p>
        </div>
      ) : (
        <ul className="ck-list" aria-label="Shopping list">
          {lines.map((l) => <Row key={l.key} line={l} weekOf={weekOf} onRemove={onRemove} />)}
        </ul>
      )}

      {doubleCheck.length > 0 && (
        <>
          <div className="ck-section-title"><h2>Double-check</h2></div>
          <p className="ck-shop__help ck-shop__help--tight">These recipe lines didn't match anything in your kitchen. Swipe away the ones you have.</p>
          <ul className="ck-list" aria-label="Double-check">
            {doubleCheck.map((l) => <Row key={l.key} line={l} weekOf={weekOf} onRemove={onRemove} removeLabel="Have it" />)}
          </ul>
        </>
      )}

      {inCart > 0 && (
        <div className={`ck-shop__done${allChecked ? " ck-shop__done--all" : ""}`}>
          <p>{allChecked ? "Got everything? " : ""}Mark {plural(inCart, "checked item")} as bought. Kitchen items go back in stock.</p>
          <button className={`ck-btn ${allChecked ? "ck-btn--primary" : "ck-btn--secondary"} ck-btn--block`} onClick={onDone}>Done shopping</button>
        </div>
      )}

      <form className="ck-shop__add" onSubmit={onAdd}>
        <label className="ck-visually-hidden" htmlFor="ck-shop-add">Add an item</label>
        <input id="ck-shop-add" className="ck-input" placeholder="Add an item" value={draft} onChange={(e) => setDraft(e.target.value)} autoComplete="off" enterKeyHint="done" />
        <button className="ck-btn ck-btn--secondary" type="submit" disabled={!draft.trim()}>Add</button>
      </form>

      <p className="ck-shop__staples">
        <button className="ck-shop__link" onClick={() => setStaplesOpen(true)}>Edit always-buy items</button>
      </p>

      <Sheet open={staplesOpen} onClose={() => setStaplesOpen(false)} title="Always buy">
        <StaplesEditor />
      </Sheet>
    </section>
  );
}

const SWIPE_REMOVE = 90;

function Row({ line, weekOf, onRemove, removeLabel = "Remove" }: { line: ShoppingLine; weekOf: string; onRemove: (l: ShoppingLine) => void; removeLabel?: string }) {
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; id: number; swiping: boolean } | null>(null);

  const down = (e: ReactPointerEvent) => {
    if (e.pointerType === "mouse") return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, swiping: false };
  };
  const move = (e: ReactPointerEvent<HTMLLIElement>) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    const mx = e.clientX - s.x, my = e.clientY - s.y;
    if (!s.swiping) {
      if (Math.abs(my) > 10) { start.current = null; return; } // vertical scroll wins
      if (mx < -10) { s.swiping = true; e.currentTarget.setPointerCapture(e.pointerId); }
    }
    if (s.swiping) setDx(Math.min(0, mx));
  };
  const up = () => {
    const swiped = start.current?.swiping && dx < -SWIPE_REMOVE;
    start.current = null;
    setDx(0);
    if (swiped) onRemove(line);
  };

  const label = line.amount ? `${line.name}, ${line.amount}` : line.name;
  return (
    <li
      className="ck-list-item ck-shop__row"
      data-checked={line.checked ? "true" : undefined}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      style={dx ? { transform: `translateX(${dx}px)`, transition: "none" } : undefined}
      data-swipe={dx < -SWIPE_REMOVE ? "remove" : undefined}
    >
      {/* 44 px tap target around the 28 px circle: easier to hit with a cart in one hand. */}
      <button
        className="ck-shop__hit"
        role="checkbox"
        aria-checked={line.checked}
        aria-label={label}
        onClick={() => toggleChecked(line, weekOf)}
      >
        <span className="ck-check" aria-hidden="true" aria-checked={line.checked} />
      </button>
      <span className="ck-shop__text" onClick={() => toggleChecked(line, weekOf)}>
        <span className="ck-list-item__name">{line.name}</span>
        {line.why && <span className="ck-list-item__why">{line.why}</span>}
      </span>
      {line.amount && <span className="ck-list-item__qty">{line.amount}</span>}
      <button className="ck-shop__remove" aria-label={`${removeLabel}: ${line.name}`} title={removeLabel} onClick={() => onRemove(line)}>
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M7 7l10 10M17 7 7 17" /></svg>
      </button>
    </li>
  );
}
