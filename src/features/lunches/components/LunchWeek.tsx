import { useState } from "react";
import { pickLunch, clearLunch, useKitchenStatus, useLunchWeek } from "../hooks";
import { dayName } from "../leftovers";
import { lunchShoppingNeeds } from "../shopping";
import { readyNow } from "../suggest";
import type { ISODate } from "../types";
import { LunchPicker } from "./LunchPicker";
import { LunchSlot } from "./LunchSlot";

/**
 * Self-contained lunch section for the home screen: a "Plan lunches" button
 * that fills empty days, one line per day, and the picker sheet. The planner
 * can instead use LunchSlot + LunchPickerSheet inside its own day rows.
 */
export function LunchWeek({ start }: { start: ISODate }) {
  const w = useLunchWeek(start);
  const [openDate, setOpenDate] = useState<ISODate | null>(null);
  const [filled, setFilled] = useState<number | null>(null);
  const byDate = Object.fromEntries(w.lunches.map((l) => [l.date, l]));
  const empty = w.dates.filter((d) => !byDate[d]).length;
  const toBuy = lunchShoppingNeeds(w.lunches, w.kitchen).length;

  return (
    <section className="ck-lunch-week" aria-labelledby="ck-lunch-week-title">
      <div className="ck-lunch-week__head">
        <h2 id="ck-lunch-week-title">Lunches</h2>
        {empty > 0 && (
          <button type="button" className="ck-lunch-btn" onClick={() => setFilled(w.fillEmpty())}>
            Plan {empty === 7 ? "the week's" : `${empty} more`} lunches
          </button>
        )}
      </div>
      {filled !== null && (
        <p className="ck-lunch-week__note" role="status">
          Planned {filled} lunch{filled === 1 ? "" : "es"}
          {toBuy ? `. ${toBuy} item${toBuy === 1 ? "" : "s"} added to your list.` : ", nothing extra to buy."}
        </p>
      )}
      <ul className="ck-lunch-week__days">
        {w.dates.map((date) => (
          <li key={date}>
            <span className="ck-lunch-week__day">{dayName(date).slice(0, 3)}</span>
            <LunchSlot entry={byDate[date]} recipes={w.recipes} kitchen={w.kitchen} onOpen={() => setOpenDate(date)} />
          </li>
        ))}
      </ul>
      {openDate && <LunchPickerSheet date={openDate} start={start} onClose={() => setOpenDate(null)} />}
    </section>
  );
}

/** The picker in a bottom sheet, wired to the store. */
export function LunchPickerSheet({ date, start, onClose }: { date: ISODate; start: ISODate; onClose: () => void }) {
  const w = useLunchWeek(start);
  const current = w.lunches.find((l) => l.date === date);
  return (
    <div className="ck-lunch-sheet" role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ck-lunch-sheet__panel">
        <LunchPicker
          date={date}
          kitchen={w.kitchen}
          dinners={w.dinners}
          currentLunchId={current?.kind === "lunch" ? current.refId : undefined}
          usedThisWeek={w.usage.used}
          familiesThisWeek={w.usage.families}
          alreadyBuying={w.alreadyBuying}
          settings={w.settings}
          onPick={(c) => {
            pickLunch(date, c);
            onClose();
          }}
          onClear={current ? () => (clearLunch(date), onClose()) : undefined}
          onClose={onClose}
        />
      </div>
    </div>
  );
}

/** "What can we have right now?" strip: lunches makeable this minute. */
export function ReadyNowLunches({ limit = 6, onPick }: { limit?: number; onPick?: (lunchId: string) => void }) {
  const kitchen = useKitchenStatus();
  const list = readyNow(kitchen).slice(0, limit);
  if (!list.length) return null;
  return (
    <section className="ck-lunch-section">
      <h3>Lunch you can make right now</h3>
      <ul className="ck-lunch-chips">
        {list.map((m) => (
          <li key={m.idea.id}>
            <button type="button" className="ck-lunch-chip" onClick={() => onPick?.(m.idea.id)} title={m.idea.howTo}>
              {m.idea.emoji} {m.idea.name} · {m.idea.minutes} min
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
