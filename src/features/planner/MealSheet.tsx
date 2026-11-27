/**
 * Meal sheet: opens when Cory taps a planned meal. The swap bar is pinned at the top
 * (dinners he can make right now, including quicker ones), then the recipe summary with
 * servings, what's in stock, and actions. Also the "⋯" options menu and the move-day picker.
 */
import { useMemo } from "react";
import type { PlanEntry, Recipe } from "@shared/types";
import { navigate } from "../../app/nav";
import { addDays, planId, todayYmd, weekDates, weekStart } from "@shared/domain";
import { defaultServings, dayName, itemName, makesLeftovers, match, relDay, shortDate } from "./logic";
import { assign, clear, restore, snapshot, swapSlots, usePlan, useRecipes, useSettings, useStatusMap } from "./data";
import { SwapBar } from "./SwapBar";
import { entryLabel } from "./Home";
import { href, parseSlot } from "./routes";
import { CheckIcon, HaveBadge, RecipeImg, Sheet, Time, toast } from "./ui";

interface Props { slot: string; mode?: string; week?: string }

const close = () => history.back();

export function MealSheet({ slot, mode, week }: Props) {
  const plan = usePlan();
  const { list: recipes, byId } = useRecipes();
  const status = useStatusMap();
  const settings = useSettings();
  const s = parseSlot(slot);
  const entry = s ? plan[slot] : undefined;
  if (!s || !entry) return null;

  const today = todayYmd();
  const recipe = entry.kind === "recipe" && entry.refId ? byId[entry.refId] : undefined;
  const label = `${relDay(s.date, today) === "Today" ? (s.meal === "dinner" ? "Tonight" : "Today") : dayName(s.date, true)} · ${s.meal === "dinner" ? "Dinner" : "Lunch"}`;

  if (mode === "move") return <MoveSheet entry={entry} byId={byId} plan={plan} />;
  if (mode === "menu" || !recipe) return <OptionsSheet entry={entry} recipe={recipe} label={label} week={week} byId={byId} plan={plan} />;

  const m = match(recipe, status);
  const servings = entry.servings ?? defaultServings(recipe, settings.householdSize);
  const canSwap = s.date >= today && !entry.cooked && s.meal === "dinner";

  return (
    <Sheet open onClose={close} label={`${label}: ${recipe.title}`} tall>
      {canSwap && (
        <div className="ck-pl-sheet__pinned">
          <SwapBar planned={recipe} recipes={recipes} status={status} title={s.date === today ? "Want something else tonight?" : `Want something else ${dayName(s.date, true)}?`}
            onPick={(r) => navigate(href.recipe(r.id, { swap: slot }))} />
        </div>
      )}
      <div className="ck-pl-summary">
        <button className="ck-pl-summary__img" onClick={() => navigate(href.recipe(recipe.id, { plan: slot }))} aria-label="Open recipe"><RecipeImg recipe={recipe} eager /></button>
        <div className="ck-pl-summary__body">
          <span className="ck-overline">{label}</span>
          <h2 className="ck-h2 ck-pl-summary__title">{recipe.title}</h2>
          <div className="ck-recipe-card__meta"><Time minutes={recipe.totalMinutes} />{entry.cooked ? <span className="ck-badge">Cooked</span> : <HaveBadge missing={m.a.missing.length} />}</div>
        </div>
      </div>

      <div className="ck-pl-stock">
        <span>You have <b>{m.a.have.length}</b> of {m.a.have.length + m.a.missing.length} ingredients{m.low.length ? `, ${m.low.length} running low` : ""}.</span>
        {m.a.missing.length > 0 && <span className="ck-pl-stock__need">Need: {m.a.missing.map(itemName).join(", ")}</span>}
      </div>

      <div className="ck-pl-row">
        <span>Servings</span>
        <div className="ck-stepper">
          <button aria-label="Fewer servings" onClick={() => assign(s.date, s.meal, { ...strip(entry), servings: Math.max(1, servings - 1) })}>−</button>
          <output aria-live="polite">{servings}</output>
          <button aria-label="More servings" onClick={() => assign(s.date, s.meal, { ...strip(entry), servings: Math.min(20, servings + 1) })}>+</button>
        </div>
      </div>

      <div className="ck-pl-actions">
        <button className="ck-btn ck-btn--primary ck-btn--block" onClick={() => navigate(href.recipe(recipe.id, { plan: slot }))}>Open recipe</button>
        <button className="ck-btn ck-btn--secondary ck-btn--block" onClick={() => {
          assign(s.date, s.meal, { ...strip(entry), cooked: !entry.cooked });
          if (!entry.cooked) toast("Marked as cooked. Nice work.");
        }}><CheckIcon />{entry.cooked ? "Cooked" : "Mark as cooked"}</button>
      </div>

      <Options entry={entry} recipe={recipe} week={week} byId={byId} plan={plan} />
    </Sheet>
  );
}

const strip = (e: PlanEntry) => { const { id: _i, updatedAt: _u, date: _d, meal: _m, ...rest } = e; void _i; void _u; void _d; void _m; return rest; };

function OptionsSheet(props: { entry: PlanEntry; recipe?: Recipe; label: string; week?: string; byId: Record<string, Recipe>; plan: Record<string, PlanEntry>}) {
  return (
    <Sheet open onClose={close} label={`${props.label} options`}>
      <span className="ck-overline">{props.label}</span>
      <h2 className="ck-h2 ck-pl-sheet__h">{entryLabel(props.entry, props.byId)}</h2>
      <Options {...props} />
    </Sheet>
  );
}

function Options({ entry, recipe, week, plan }: { entry: PlanEntry; recipe?: Recipe; week?: string; byId: Record<string, Recipe>; plan: Record<string, PlanEntry>}) {
  const settings = useSettings();
  const today = todayYmd();
  const tomorrow = addDays(entry.date, 1);
  const tomorrowLunch = plan[planId(tomorrow, "lunch")];
  const leftoversSet = tomorrowLunch?.kind === "leftovers" && tomorrowLunch.refId === entry.refId;
  const ws = week ?? weekStart(entry.date);

  const replaceWith = (to: string) => { history.back(); setTimeout(() => navigate(to), 0); };

  return (
    <div className="ck-pl-options" role="menu">
      {entry.meal === "dinner" && recipe && entry.date >= today && (
        <button role="menuitem" onClick={() => {
          const undo = snapshot([{ date: tomorrow, meal: "lunch" }]);
          if (leftoversSet) clear(tomorrow, "lunch");
          else assign(tomorrow, "lunch", { kind: "leftovers", refId: recipe.id, fromDate: entry.date });
          toast(leftoversSet ? "Leftover lunch removed." : `Leftovers set for ${dayName(tomorrow, true)} lunch.`, { label: "Undo", run: () => restore(undo) });
        }}>
          {leftoversSet ? `Don't save leftovers for ${dayName(tomorrow, true)} lunch` : `Leftovers for ${dayName(tomorrow, true)} lunch`}
          {!leftoversSet && makesLeftovers(recipe, settings.householdSize) && <small>Makes extra</small>}
        </button>
      )}
      {entry.date >= today && <button role="menuitem" onClick={() => replaceWith(href.home(ws === weekStart(today) ? undefined : ws, entry.id, "move"))}>Move to another day</button>}
      {entry.date >= today && <button role="menuitem" onClick={() => replaceWith(href.plan(ws, entry.id))}>Pick something else</button>}
      {entry.kind !== "none" && entry.date >= today && (
        <button role="menuitem" onClick={() => {
          const undo = snapshot([{ date: entry.date, meal: entry.meal }]);
          assign(entry.date, entry.meal, { kind: "none", note: entry.meal === "dinner" ? "Eating out" : "On our own" });
          toast("Marked as eating out.", { label: "Undo", run: () => restore(undo) });
          close();
        }}>{entry.meal === "dinner" ? "Eating out instead" : "No lunch to plan"}</button>
      )}
      <button role="menuitem" className="is-danger" onClick={() => {
        const undo = snapshot([{ date: entry.date, meal: entry.meal }]);
        clear(entry.date, entry.meal);
        toast("Removed from the plan.", { label: "Undo", run: () => restore(undo) });
        close();
      }}>Remove from plan</button>
    </div>
  );
}

function MoveSheet({ entry, byId, plan }: { entry: PlanEntry; byId: Record<string, Recipe>; plan: Record<string, PlanEntry> }) {
  const today = todayYmd();
  const days = useMemo(() => {
    const a = weekDates(weekStart(entry.date)), b = weekDates(weekStart(addDays(entry.date, 7)));
    return [...a, ...b].filter((d) => d >= today && d !== entry.date);
  }, [entry.date, today]);
  return (
    <Sheet open onClose={close} label="Move to another day">
      <h2 className="ck-h2 ck-pl-sheet__h">Move {entryLabel(entry, byId)}</h2>
      <p className="ck-muted ck-small">If another meal is planned that day, the two trade places.</p>
      <div className="ck-pl-options" role="menu">
        {days.map((d) => {
          const there = plan[planId(d, entry.meal)];
          return (
            <button key={d} role="menuitem" onClick={() => {
              const undo = snapshot([{ date: entry.date, meal: entry.meal }, { date: d, meal: entry.meal }]);
              swapSlots({ date: entry.date, meal: entry.meal }, { date: d, meal: entry.meal });
              toast(`Moved to ${dayName(d, true)}.`, { label: "Undo", run: () => restore(undo) });
              close();
            }}>
              <span>{relDay(d, today)} <span className="ck-muted">{shortDate(d)}</span></span>
              <small>{there ? `Trade with ${entryLabel(there, byId)}` : "Open"}</small>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
