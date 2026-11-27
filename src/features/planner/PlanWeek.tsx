/**
 * Plan a week: pick a day, then pick from the Recipe Box ranked by what's already in the
 * kitchen. Adding a dinner jumps to the next open night so planning 7 dinners is 7 taps.
 */
import { useMemo, useState } from "react";
import type { Meal } from "@shared/types";
import { navigate } from "../../app/nav";
import { addDays, planId, todayYmd, weekDates, weekStart } from "@shared/domain";
import { dayName, nextOpenDinner, QUICK_MINUTES, rankForPlanning, relDay, shortDate, weekRange } from "./logic";
import { assign, clear, restore, snapshot, usePlan, useRecipes, useSettings, useStatusMap } from "./data";
import { entryLabel } from "./Home";
import { href, parseSlot } from "./routes";
import { LunchPickerSheet } from "@features/lunches";
import { BackIcon, CheckIcon, CloseIcon, HaveBadge, PlusIcon, RecipeImg, Time, toast } from "./ui";

type Filter = "best" | "ready" | "quick";

export function PlanWeek({ week, slot }: { week?: string; slot?: string }) {
  const today = todayYmd();
  const thisStart = weekStart(today);
  const ws = week ?? addDays(thisStart, 7);
  const dates = weekDates(ws);
  const plan = usePlan();
  const { list: recipes, byId } = useRecipes();
  const status = useStatusMap();
  const settings = useSettings();

  const pre = parseSlot(slot);
  const firstOpen = nextOpenDinner(plan, dates, ws === thisStart ? today : undefined);
  const [date, setDate] = useState<string>(pre && dates.includes(pre.date) ? pre.date : firstOpen ?? (ws === thisStart ? today : dates[0]));
  const [meal, setMeal] = useState<Meal>(pre?.meal ?? "dinner");
  const [filter, setFilter] = useState<Filter>("best");
  const [q, setQ] = useState("");
  const [lunchPicker, setLunchPicker] = useState(false);

  const weekPlanned = useMemo(() => new Set(dates.map((d) => plan[planId(d, "dinner")]).filter((e) => e?.kind === "recipe").map((e) => e!.refId!)), [plan, ws]);
  const recent = useMemo(() => {
    const from = addDays(ws, -14);
    return new Set(Object.values(plan).filter((e) => e.kind === "recipe" && e.date >= from && e.date < ws && e.refId).map((e) => e.refId!));
  }, [plan, ws]);
  const ranked = useMemo(() => rankForPlanning(recipes, status, { planned: weekPlanned, recent }), [recipes, status, weekPlanned, recent]);

  const needle = q.trim().toLowerCase();
  const shown = ranked.filter((m) => {
    if (filter === "ready" && !m.a.canMake) return false;
    if (filter === "quick" && (m.recipe.totalMinutes ?? 999) > QUICK_MINUTES) return false;
    if (needle && !(m.recipe.title.toLowerCase().includes(needle) || m.recipe.tags?.some((t) => t.toLowerCase().includes(needle)) || m.recipe.ingredients.some((l) => l.toLowerCase().includes(needle)))) return false;
    return true;
  });

  const slotId = planId(date, meal);
  const current = plan[slotId];
  const planned = dates.filter((d) => plan[planId(d, "dinner")]).length;
  const isPast = (d: string) => ws === thisStart && d < today;

  // Leftovers for lunch: dinners from the night before and two nights before.
  const leftovers = meal === "lunch"
    ? [addDays(date, -1), addDays(date, -2)].map((d) => plan[planId(d, "dinner")]).filter((e) => e?.kind === "recipe" && e.refId && byId[e.refId])
    : [];

  const put = (entry: Parameters<typeof assign>[2], label: string) => {
    const undo = snapshot([{ date, meal }]);
    assign(date, meal, entry);
    const where = relDay(date, today) === "Today" ? (meal === "dinner" ? "tonight" : "today") : dayName(date, true);
    let next: string | undefined;
    if (meal === "dinner") {
      const after = { ...plan, [slotId]: { id: slotId } as never };
      next = nextOpenDinner(after, dates, date) ?? nextOpenDinner(after, dates, ws === thisStart ? today : undefined);
      if (next) setDate(next);
    }
    const tail = meal !== "dinner" ? "" : next ? ` Next up: ${dayName(next, true)}.` : " Every night is planned.";
    toast(`Added to ${where}.${tail}`, { label: "Undo", run: () => { restore(undo); setDate(date); } });
    void label;
  };

  const back = () => (history.length > 1 ? history.back() : navigate("home"));
  const title = ws === thisStart ? "Plan this week" : ws === addDays(thisStart, 7) ? "Plan next week" : `Plan week of ${shortDate(ws)}`;

  return (
    <div className="ck-pl ck-pl-plan">
      <header className="ck-appbar ck-pl-appbar ck-pl-appbar--plan">
        <button className="ck-icon-btn" aria-label="Back" onClick={back}><BackIcon /></button>
        <div className="ck-pl-appbar__title">
          <h1 className="ck-h1">{title}</h1>
          <div className="ck-appbar__sub ck-muted">{weekRange(dates)} · {planned} of {settings.dinnersPerWeek} dinners</div>
        </div>
      </header>

      <nav className="ck-daystrip" role="tablist" aria-label="Day">
        {dates.map((d) => (
          <button key={d} role="tab" className="ck-day" aria-selected={d === date} aria-current={d === today ? "date" : undefined}
            data-planned={plan[planId(d, meal)] ? "true" : undefined} disabled={isPast(d)} onClick={() => setDate(d)}>
            <span className="ck-day__dow">{dayName(d)}</span>
            <span className="ck-day__num">{Number(d.slice(8))}</span>
          </button>
        ))}
      </nav>

      <div className="ck-card ck-card--pad ck-pl-slot">
        <div className="ck-segmented" role="radiogroup" aria-label="Meal">
          {(["dinner", "lunch"] as const).map((m) => (
            <button key={m} role="radio" aria-checked={meal === m} onClick={() => setMeal(m)}>{m === "dinner" ? "Dinner" : "Lunch"}</button>
          ))}
        </div>
        <div className="ck-pl-slot__current">
          {current ? (
            <>
              <span><span className="ck-muted">{dayName(date, true)} {meal}:</span> <b>{entryLabel(current, byId)}</b></span>
              <button className="ck-icon-btn" aria-label={`Clear ${dayName(date, true)} ${meal}`} onClick={() => {
                const undo = snapshot([{ date, meal }]);
                clear(date, meal);
                toast("Cleared.", { label: "Undo", run: () => restore(undo) });
              }}><CloseIcon /></button>
            </>
          ) : (
            <span className="ck-muted">Pick {meal} for {relDay(date, today) === "Today" ? "today" : dayName(date, true)}, {shortDate(date)}</span>
          )}
        </div>
        {meal === "lunch" && (
          <div className="ck-chips ck-pl-slot__extras">
            {leftovers.map((e) => (
              <button key={e!.id} className="ck-chip" onClick={() => put({ kind: "leftovers", refId: e!.refId, fromDate: e!.date }, "Leftovers")}>
                Leftover {byId[e!.refId!].title.split(/ with | and /i)[0]} <span className="ck-muted">· {dayName(e!.date)}</span>
              </button>
            ))}
            <button className="ck-chip ck-chip--filter" aria-pressed="true" onClick={() => setLunchPicker(true)}>Easy lunch ideas</button>
            <button className="ck-chip" onClick={() => put({ kind: "none", note: "On our own" }, "No-cook lunch")}>No lunch to plan</button>
          </div>
        )}
        {meal === "dinner" && (
          <div className="ck-chips ck-pl-slot__extras">
            <button className="ck-chip" onClick={() => put({ kind: "none", note: "Eating out" }, "Eating out")}>Eating out</button>
          </div>
        )}
      </div>

      <div className="ck-pl-filters">
        <input type="search" className="ck-search" placeholder="Search your recipes" aria-label="Search recipes" value={q} onChange={(e) => setQ(e.target.value)} enterKeyHint="search" autoComplete="off" />
        <div className="ck-chips ck-chips--scroll" role="group" aria-label="Filter recipes">
          {([["best", "Best match"], ["ready", "Have everything"], ["quick", `Under ${QUICK_MINUTES} min`]] as const).map(([k, l]) => (
            <button key={k} className="ck-chip ck-chip--filter" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
      </div>

      {recipes.length === 0 ? (
        <div className="ck-empty">
          <h2 className="ck-h2">No recipes yet</h2>
          <p>Add recipes by pasting NYT Cooking links on the Recipes tab, and they show up here, ranked by what you already have.</p>
          <button className="ck-btn ck-btn--primary" onClick={() => navigate("recipes")}>Go to Recipes</button>
        </div>
      ) : (
        <ul className="ck-pl-results">
          {shown.length === 0 && <li className="ck-muted ck-pl-results__none">No recipes match. Try another filter.</li>}
          {shown.map((m) => {
            const here = current?.kind === "recipe" && current.refId === m.recipe.id;
            const elsewhere = !here && weekPlanned.has(m.recipe.id);
            return (
              <li key={m.recipe.id} className="ck-pl-result">
                <button className="ck-pl-result__main" onClick={() => navigate(href.recipe(m.recipe.id, { add: slotId }))}>
                  <div className="ck-meal__img"><RecipeImg recipe={m.recipe} /></div>
                  <div className="ck-pl-result__body">
                    <span className="ck-pl-result__title">{m.recipe.title}</span>
                    <span className="ck-recipe-card__meta">
                      <Time minutes={m.recipe.totalMinutes} />
                      <HaveBadge missing={m.a.missing.length} />
                      {elsewhere && <span className="ck-badge">Planned</span>}
                    </span>
                    {m.a.missing.length > 0 && m.a.missing.length <= 2 && <span className="ck-pl-result__reason">{m.reason}</span>}
                  </div>
                </button>
                <button className="ck-pl-add" aria-pressed={here} aria-label={here ? `Remove from ${dayName(date, true)}` : `Add to ${dayName(date, true)} ${meal}`}
                  onClick={() => (here ? clear(date, meal) : put({ kind: "recipe", refId: m.recipe.id, servings: current?.servings }, m.recipe.title))}>
                  {here ? <CheckIcon /> : <PlusIcon />}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {lunchPicker && <LunchPickerSheet date={date} start={ws} onClose={() => setLunchPicker(false)} />}

      <div className="ck-actionbar">
        <span className="ck-pl-actionbar__count"><b>{planned} of {settings.dinnersPerWeek}</b> dinners picked</span>
        <button className="ck-btn ck-btn--primary" onClick={() => navigate(href.home(ws === thisStart ? undefined : ws))}>Done</button>
      </div>
    </div>
  );
}
