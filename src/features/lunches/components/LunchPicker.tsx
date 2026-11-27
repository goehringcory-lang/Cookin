import { useMemo, useState } from "react";
import { nameOf } from "../kitchen";
import { addDays, dayName, leftoverDinnerFor } from "../leftovers";
import { suggestLunches } from "../suggest";
import type { CatalogId, ISODate, Kitchen, LunchChoice, LunchMatch, LunchSettings, PlannedDinner } from "../types";
import { DEFAULT_LUNCH_SETTINGS } from "../types";

type Filter = "all" | "lunchbox" | "quick";

export interface LunchPickerProps {
  date: ISODate;
  kitchen: Kitchen;
  dinners: readonly PlannedDinner[];
  /** Currently planned lunch id, to highlight it. */
  currentLunchId?: string;
  usedThisWeek?: ReadonlyMap<string, number>;
  familiesThisWeek?: ReadonlyMap<string, number>;
  alreadyBuying?: ReadonlySet<CatalogId>;
  settings?: LunchSettings;
  onPick: (choice: LunchChoice) => void;
  onClear?: () => void;
  onClose?: () => void;
}

/**
 * Body of the "choose lunch" sheet. Last night's leftovers first, then what
 * you can make right now, then lunches that are one or two items short.
 */
export function LunchPicker(props: LunchPickerProps) {
  const settings = props.settings ?? DEFAULT_LUNCH_SETTINGS;
  const [filter, setFilter] = useState<Filter>("all");
  const [seed, setSeed] = useState<number | undefined>(undefined);
  const [note, setNote] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const flagged = leftoverDinnerFor(props.date, props.dinners, settings);
  const yesterday = flagged ?? props.dinners.find((d) => d.date === addDays(props.date, -1));

  const matches = useMemo(
    () =>
      suggestLunches(props.kitchen, {
        style: filter === "lunchbox" ? "lunchbox" : undefined,
        maxMinutes: filter === "quick" ? 10 : undefined,
        usedThisWeek: props.usedThisWeek,
        familiesThisWeek: props.familiesThisWeek,
        alreadyBuying: props.alreadyBuying,
        seed,
      }),
    [props.kitchen, props.usedThisWeek, props.familiesThisWeek, props.alreadyBuying, filter, seed],
  );
  const ready = matches.filter((m) => m.readiness === "ready");
  const short = matches.filter((m) => m.readiness === "short");
  const pickIdea = (id: string) => props.onPick({ type: "idea", lunchId: id });

  return (
    <div className="ck-lunch-picker" aria-label={`Lunch for ${dayName(props.date)}`}>
      <header className="ck-lunch-picker__head">
        <h2>Lunch for {dayName(props.date)}</h2>
        {props.onClose && (
          <button type="button" className="ck-lunch-icon-btn" onClick={props.onClose} aria-label="Close">
            ✕
          </button>
        )}
      </header>

      {yesterday && (
        <section className="ck-lunch-section">
          <h3>From last night</h3>
          <button
            type="button"
            className="ck-lunch-card ck-lunch-card--leftovers"
            onClick={() => props.onPick({ type: "leftovers", fromDate: yesterday.date, recipeId: yesterday.recipeId, title: yesterday.title })}
          >
            <span className="ck-lunch-card__emoji" aria-hidden="true">♻️</span>
            <span className="ck-lunch-card__body">
              <span className="ck-lunch-card__name">Leftovers: {yesterday.title}</span>
              <span className="ck-lunch-card__meta">{flagged ? "Makes extra, nothing to buy" : "Nothing to buy, if there's enough left"}</span>
            </span>
          </button>
        </section>
      )}

      <div className="ck-lunch-filters" role="group" aria-label="Filter lunches">
        {(
          [
            ["all", "All"],
            ["lunchbox", "Lunchbox"],
            ["quick", "10 min or less"],
          ] as const
        ).map(([key, label]) => (
          <button key={key} type="button" aria-pressed={filter === key} className="ck-lunch-chip" onClick={() => setFilter(key)}>
            {label}
          </button>
        ))}
        <button type="button" className="ck-lunch-chip" onClick={() => setSeed((s) => (s ?? 0) + 1)}>
          Shuffle
        </button>
      </div>

      <MatchList title="Ready now" empty="Nothing for this filter is fully stocked. Try the list below." matches={ready} currentId={props.currentLunchId} openId={openId} onToggle={setOpenId} onPick={pickIdea} />
      <MatchList title="Need 1 or 2 things" matches={short} currentId={props.currentLunchId} openId={openId} onToggle={setOpenId} onPick={pickIdea} />

      <section className="ck-lunch-section">
        <h3>Something else</h3>
        <form
          className="ck-lunch-note"
          onSubmit={(e) => {
            e.preventDefault();
            props.onPick({ type: "none", note: note.trim() || undefined });
          }}
        >
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="School pizza day, eating out…" aria-label="Lunch note" />
          <button type="submit" className="ck-lunch-btn">
            {note.trim() ? "Save" : "No lunch to plan"}
          </button>
        </form>
        {props.onClear && (
          <button type="button" className="ck-lunch-link" onClick={props.onClear}>
            Clear this lunch
          </button>
        )}
      </section>
    </div>
  );
}

function MatchList(p: {
  title: string;
  empty?: string;
  matches: LunchMatch[];
  currentId?: string;
  openId: string | null;
  onToggle: (id: string | null) => void;
  onPick: (id: string) => void;
}) {
  if (!p.matches.length && !p.empty) return null;
  return (
    <section className="ck-lunch-section">
      <h3>
        {p.title} <span className="ck-lunch-count">{p.matches.length}</span>
      </h3>
      {!p.matches.length && <p className="ck-lunch-empty">{p.empty}</p>}
      <ul className="ck-lunch-list">
        {p.matches.map((m) => {
          const open = p.openId === m.idea.id;
          return (
            <li key={m.idea.id} className={`ck-lunch-card${p.currentId === m.idea.id ? " is-selected" : ""}`}>
              <button type="button" className="ck-lunch-card__main" onClick={() => p.onPick(m.idea.id)}>
                <span className="ck-lunch-card__emoji" aria-hidden="true">{m.idea.emoji}</span>
                <span className="ck-lunch-card__body">
                  <span className="ck-lunch-card__name">{m.idea.name}</span>
                  <span className="ck-lunch-card__meta">
                    {m.idea.minutes} min{m.idea.style !== "home" ? " · packs well" : ""}
                    {m.idea.kidFriendly ? " · kid-friendly" : ""}
                  </span>
                  {m.missing.length > 0 && <span className="ck-lunch-card__need">Need {m.missing.map((id) => nameOf(id).toLowerCase()).join(", ")}</span>}
                  {m.low.length > 0 && <span className="ck-lunch-card__low">Running low: {m.low.map((id) => nameOf(id).toLowerCase()).join(", ")}</span>}
                </span>
              </button>
              <button type="button" className="ck-lunch-icon-btn" aria-expanded={open} aria-label={`How to make ${m.idea.name}`} onClick={() => p.onToggle(open ? null : m.idea.id)}>
                {open ? "–" : "i"}
              </button>
              {open && <p className="ck-lunch-card__howto">{m.idea.howTo}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
