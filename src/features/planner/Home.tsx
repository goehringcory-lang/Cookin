/**
 * Home ("This week"): tonight's dinner with Cook this / Swap, the swap bar, a day strip, and
 * one row per day with dinner and lunch. Chevrons step to next week to plan ahead.
 */
import { useMemo } from "react";
import type { PlanEntry, Recipe } from "@shared/types";
import { navigate } from "../../app/nav";
import { addDays, planId, todayYmd, weekDates, weekStart } from "@shared/domain";
import { dayName, match, relDay, shortDate, weekRange, type StatusMap } from "./logic";
import { usePlan, useRecipes, useSettings, useStatusMap } from "./data";
import { SwapBar } from "./SwapBar";
import { CartIcon, ChevronL, ChevronR, HaveBadge, MoreIcon, PlusIcon, RecipeImg, Time } from "./ui";
import { href } from "./routes";

export function Home({ start }: { start?: string }) {
  const today = todayYmd();
  const thisStart = weekStart(today);
  const ws = start ?? thisStart;
  const dates = weekDates(ws);
  const isThisWeek = ws === thisStart;
  const isPastWeek = ws < thisStart;
  const plan = usePlan();
  const { list: recipes, byId } = useRecipes();
  const status = useStatusMap();
  const settings = useSettings();

  const tonight = isThisWeek ? plan[planId(today, "dinner")] : undefined;
  const tonightRecipe = tonight?.kind === "recipe" && tonight.refId ? byId[tonight.refId] : undefined;

  const rows = isThisWeek ? dates.filter((d) => d >= today) : dates;
  const earlier = isThisWeek ? dates.filter((d) => d < today) : [];
  const planned = dates.filter((d) => plan[planId(d, "dinner")]).length;
  const open = rows.filter((d) => !plan[planId(d, "dinner")]).length;

  // Ingredients the rest of this week's planned recipes still need (the List shows the full picture).
  const toBuy = useMemo(() => {
    const ids = new Set<string>();
    for (const d of rows) for (const meal of ["dinner", "lunch"] as const) {
      const e = plan[planId(d, meal)];
      if (e?.kind === "recipe" && e.refId && byId[e.refId] && !e.cooked) match(byId[e.refId], status).a.missing.forEach((id) => ids.add(id));
    }
    return ids.size;
  }, [rows.join(), plan, byId, status]);

  const title = isThisWeek ? "This week" : ws === addDays(thisStart, 7) ? "Next week" : ws === addDays(thisStart, -7) ? "Last week" : `Week of ${shortDate(ws)}`;

  return (
    <div className="ck-pl ck-pl-home">
      <header className="ck-appbar ck-pl-appbar">
        <button className="ck-icon-btn" aria-label="Previous week" onClick={() => navigate(href.home(addDays(ws, -7) === thisStart ? undefined : addDays(ws, -7)))}><ChevronL /></button>
        <div className="ck-pl-appbar__title">
          <h1 className="ck-h1">{title}</h1>
          <div className="ck-appbar__sub ck-muted">{weekRange(dates)}{settings.dinnersPerWeek ? ` · ${planned} of ${settings.dinnersPerWeek} dinners` : ""}</div>
        </div>
        <button className="ck-icon-btn" aria-label="Next week" onClick={() => navigate(href.home(addDays(ws, 7) === thisStart ? undefined : addDays(ws, 7)))}><ChevronR /></button>
      </header>

      {isThisWeek && (
        <>
          {tonightRecipe && tonight ? (
            <article className="ck-card ck-recipe-card ck-recipe-card--hero ck-pl-hero">
              <button className="ck-recipe-card__img ck-pl-hero__img" onClick={() => navigate(href.recipe(tonightRecipe.id, { plan: tonight.id }))} aria-label={`Open ${tonightRecipe.title}`}>
                <RecipeImg recipe={tonightRecipe} eager />
              </button>
              <div className="ck-recipe-card__body">
                <span className="ck-overline">Tonight · {dayName(today, true)}</span>
                <h2 className="ck-recipe-card__title">{tonightRecipe.title}</h2>
                <div className="ck-recipe-card__meta">
                  <Time minutes={tonightRecipe.totalMinutes} />
                  <span>serves {tonight.servings ?? settings.householdSize}</span>
                  {tonight.cooked ? <span className="ck-badge">Cooked</span> : <HaveBadge missing={match(tonightRecipe, status).a.missing.length} />}
                </div>
                <div className="ck-recipe-card__actions">
                  <button className="ck-btn ck-btn--primary" onClick={() => navigate(href.recipe(tonightRecipe.id, { plan: tonight.id }))}>Cook this</button>
                  <button className="ck-btn ck-btn--secondary" onClick={() => navigate(href.home(undefined, tonight.id))}>Swap</button>
                </div>
              </div>
            </article>
          ) : tonight ? (
            <article className="ck-card ck-card--pad ck-pl-hero ck-pl-hero--note">
              <span className="ck-overline">Tonight · {dayName(today, true)}</span>
              <h2 className="ck-h2">{entryLabel(tonight, byId)}</h2>
              <button className="ck-btn ck-btn--secondary ck-btn--sm" onClick={() => navigate(href.plan(ws, tonight.id))}>Change</button>
            </article>
          ) : (
            <article className="ck-card ck-card--pad ck-pl-hero ck-pl-hero--empty">
              <span className="ck-overline">Tonight · {dayName(today, true)}</span>
              <h2 className="ck-h2">Nothing planned yet</h2>
              <p className="ck-muted ck-small">Pick something below you can make right now, or browse your Recipe Box.</p>
              <button className="ck-btn ck-btn--primary" onClick={() => navigate(href.plan(ws, planId(today, "dinner")))}>Pick tonight's dinner</button>
            </article>
          )}

          {!tonight?.cooked && (!tonight || tonightRecipe) && (
            <SwapBar
              planned={tonightRecipe}
              recipes={recipes}
              status={status}
              title={tonightRecipe ? "Or make instead, with what you have" : "Ready to make tonight"}
              onPick={(r) => navigate(href.recipe(r.id, tonightRecipe ? { swap: planId(today, "dinner") } : { add: planId(today, "dinner") }))}
            />
          )}
        </>
      )}

      <nav className="ck-daystrip" aria-label="Days">
        {dates.map((d) => (
          <button
            key={d}
            className="ck-day"
            aria-current={d === today ? "date" : undefined}
            data-planned={plan[planId(d, "dinner")] ? "true" : undefined}
            onClick={() => document.getElementById(`ck-day-${d}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
          >
            <span className="ck-day__dow">{dayName(d)}</span>
            <span className="ck-day__num">{Number(d.slice(8))}</span>
          </button>
        ))}
      </nav>

      <ol className="ck-week ck-pl-week">
        {rows.map((d) => <DayRow key={d} date={d} today={today} ws={ws} plan={plan} byId={byId} status={status} readOnly={isPastWeek} />)}
      </ol>

      {earlier.length > 0 && (
        <details className="ck-pl-earlier">
          <summary>Earlier this week</summary>
          <ol className="ck-week ck-pl-week ck-pl-week--past">
            {earlier.map((d) => <DayRow key={d} date={d} today={today} ws={ws} plan={plan} byId={byId} status={status} readOnly />)}
          </ol>
        </details>
      )}

      {!isPastWeek && (
        <div className="ck-pl-footer">
          {open > 0 && (
            <button className="ck-btn ck-btn--primary ck-btn--block" onClick={() => navigate(href.plan(ws))}>
              {planned === 0 ? (isThisWeek ? "Plan this week" : "Plan next week") : `Plan ${open} more ${open === 1 ? "night" : "nights"}`}
            </button>
          )}
          {toBuy > 0 && (
            <button className="ck-card ck-card--pad ck-pl-nudge" onClick={() => navigate("list")}>
              <CartIcon />
              <span><b>{toBuy} {toBuy === 1 ? "ingredient" : "ingredients"} to buy</b> for {isThisWeek ? "this week" : "that week"}’s meals</span>
              <span className="ck-pl-nudge__go">List</span>
            </button>
          )}
          {isThisWeek && planned >= 1 && (
            <button className="ck-btn ck-btn--ghost ck-btn--block" onClick={() => navigate(href.home(addDays(ws, 7)))}>Look ahead to next week</button>
          )}
        </div>
      )}
    </div>
  );
}

export function entryLabel(e: PlanEntry, byId: Record<string, Recipe>): string {
  if (e.kind === "recipe") return (e.refId && byId[e.refId]?.title) || "A recipe";
  if (e.kind === "leftovers") {
    const t = e.refId && byId[e.refId]?.title;
    return t ? `Leftover ${t}${e.fromDate ? ` from ${dayName(e.fromDate, true)}` : ""}` : "Leftovers";
  }
  if (e.kind === "lunch") return e.note || lunchName(e.refId);
  return e.note || "No cooking";
}

/** Lunch idea ids look like "l-grilled-cheese"; the lunches thread owns the library. */
export const lunchName = (id?: string) => (id ? id.replace(/^l-/, "").replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()) : "Lunch");

interface DayRowProps { date: string; today: string; ws: string; plan: Record<string, PlanEntry>; byId: Record<string, Recipe>; status: StatusMap; readOnly?: boolean }

function DayRow({ date, today, ws, plan, byId, status, readOnly }: DayRowProps) {
  const dinner = plan[planId(date, "dinner")];
  const lunch = plan[planId(date, "lunch")];
  const recipe = dinner?.kind === "recipe" && dinner.refId ? byId[dinner.refId] : undefined;
  const label = relDay(date, today);

  return (
    <li className="ck-week-row" id={`ck-day-${date}`} data-today={date === today || undefined}>
      <div className="ck-week-row__day">
        <span className="ck-day__dow">{dayName(date)}</span>
        <span className="ck-day__num">{Number(date.slice(8))}</span>
      </div>
      {dinner ? (
        <div className={`ck-meal ck-pl-meal${dinner.cooked ? " is-cooked" : ""}`}>
          <button className="ck-pl-meal__hit" onClick={() => navigate(href.home(ws === weekStart(today) ? undefined : ws, dinner.id))} aria-label={`${label} dinner: ${entryLabel(dinner, byId)}`} />
          <div className="ck-meal__img">{recipe ? <RecipeImg recipe={recipe} /> : <div className="ck-pl-noimg" />}</div>
          <div className="ck-pl-meal__body">
            <span className="ck-pl-meal__when">{label === "Today" ? "Tonight" : label}</span>
            <p className="ck-meal__title">{entryLabel(dinner, byId)}</p>
            {recipe && (
              <div className="ck-recipe-card__meta">
                <Time minutes={recipe.totalMinutes} />
                {dinner.cooked ? <span className="ck-badge">Cooked</span> : !readOnly && <HaveBadge missing={match(recipe, status).a.missing.length} />}
              </div>
            )}
          </div>
          {!readOnly && (
            <button className="ck-icon-btn ck-pl-meal__more" aria-label="Meal options" onClick={() => navigate(href.home(ws === weekStart(today) ? undefined : ws, dinner.id, "menu"))}><MoreIcon /></button>
          )}
          <LunchLine date={date} lunch={lunch} byId={byId} ws={ws} readOnly={readOnly} />
        </div>
      ) : readOnly ? (
        <div className="ck-add-slot ck-pl-slot-empty">{lunch ? entryLabel(lunch, byId) : "Nothing planned"}</div>
      ) : (
        <div className="ck-pl-emptyday">
          <button className="ck-add-slot" onClick={() => navigate(href.plan(ws, planId(date, "dinner")))}><PlusIcon /> Add dinner</button>
          {lunch && <LunchLine date={date} lunch={lunch} byId={byId} ws={ws} />}
        </div>
      )}
    </li>
  );
}

function LunchLine({ date, lunch, byId, ws, readOnly }: { date: string; lunch?: PlanEntry; byId: Record<string, Recipe>; ws: string; readOnly?: boolean }) {
  if (!lunch && readOnly) return null;
  return (
    <button className="ck-meal__lunch ck-pl-lunch" disabled={readOnly} onClick={() => navigate(href.plan(ws, planId(date, "lunch")))}>
      <b>Lunch:</b>
      <span>{lunch ? entryLabel(lunch, byId) : <span className="ck-pl-lunch__add">add lunch</span>}</span>
    </button>
  );
}
