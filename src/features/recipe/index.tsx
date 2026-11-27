/**
 * Recipe detail (#recipe/<id>): photo, time, servings, and every ingredient marked
 * ✓ have, ◐ running low or ○ need from the kitchen inventory. The URL can carry context:
 *   /plan=<slot>  a planned meal (servings saved to the plan, Mark as cooked)
 *   /swap=<slot>  previewed from the swap bar ("Make this tonight")
 *   /add=<slot>   previewed from the planner picker ("Add to Thursday")
 */
import { useMemo, useState, type ReactElement } from "react";
import type { Recipe } from "@shared/types";
import { navigate } from "../../app/nav";
import { addDays, addManualItem, planId, setStatus, todayYmd, weekStart } from "@shared/domain";
import { dayName, itemName, lineStatuses, match, relDay, scaleLine, servingFactor, shortDate } from "../planner/logic";
import { assign, restore, snapshot, swapDinner, usePlan, useRecipes, useSettings, useStatusMap } from "../planner/data";
import { entryLabel } from "../planner/Home";
import { href, parseParams, parseSlot } from "../planner/routes";
import { BackIcon, CheckIcon, ExternalIcon, HaveBadge, RecipeImg, Sheet, SwapIcon, Time, ToastHost, toast } from "../planner/ui";
import "../planner/planner.css";

export function RecipeScreen({ id: param }: { id: string }) {
  const { head, params } = parseParams(param);
  const id = head ?? "";
  const { byId } = useRecipes();
  const recipe = byId[id];
  if (!recipe) {
    return (
      <div className="ck-pl ck-empty">
        <h2 className="ck-h2">Recipe not found</h2>
        <p>It may have been removed from your Recipe Box.</p>
        <button className="ck-btn ck-btn--secondary" onClick={() => navigate("recipes")}>Back to Recipes</button>
      </div>
    );
  }
  return <><RecipeDetail recipe={recipe} ctx={params} /><ToastHost /></>;
}

const STATUS_TEXT = { have: "In stock", low: "Running low", missing: "Need", unknown: "", ignored: "" } as const;

function RecipeDetail({ recipe, ctx }: { recipe: Recipe; ctx: Record<string, string> }) {
  const today = todayYmd();
  const plan = usePlan();
  const status = useStatusMap();
  const settings = useSettings();
  const { byId } = useRecipes();
  const [planSheet, setPlanSheet] = useState(false);

  const planSlot = parseSlot(ctx.plan);
  const swapSlot = parseSlot(ctx.swap);
  const addSlot = parseSlot(ctx.add);
  const entry = ctx.plan ? plan[ctx.plan] : undefined;
  const isPlannedHere = entry?.kind === "recipe" && entry.refId === recipe.id;

  const [localServings, setLocalServings] = useState<number>(settings.householdSize);
  const servings = isPlannedHere ? entry!.servings ?? settings.householdSize : localServings;
  const setServings = (n: number) => {
    const v = Math.max(1, Math.min(20, n));
    if (isPlannedHere && planSlot) { const { id: _i, updatedAt: _u, date: _d, meal: _m, ...rest } = entry!; void _i; void _u; void _d; void _m; assign(planSlot.date, planSlot.meal, { ...rest, servings: v }); }
    else setLocalServings(v);
  };
  const factor = servingFactor(recipe, servings);

  const m = useMemo(() => match(recipe, status), [recipe, status]);
  const lines = useMemo(() => lineStatuses(m, status), [m, status]);
  const total = m.a.have.length + m.a.missing.length;

  // Is this recipe on the plan in the next two weeks? Then its missing items are already on the List.
  const upcoming = Object.values(plan).find((e) => e.kind === "recipe" && e.refId === recipe.id && e.date >= today && e.date < addDays(today, 14) && !e.cooked);

  const when = (d: string, meal: "dinner" | "lunch") => {
    const r = relDay(d, today);
    return r === "Today" ? (meal === "dinner" ? "tonight" : "today") : r === "Tomorrow" ? "tomorrow" : dayName(d, true);
  };

  const overline = planSlot ? `${when(planSlot.date, planSlot.meal).replace(/^./, (c) => c.toUpperCase())} · ${planSlot.meal === "dinner" ? "Dinner" : "Lunch"}`
    : swapSlot ? `Swap for ${when(swapSlot.date, swapSlot.meal)}`
    : addSlot ? `Pick for ${when(addSlot.date, addSlot.meal)}`
    : undefined;

  const back = () => (history.length > 1 ? history.back() : navigate("recipes"));

  const addMissing = () => {
    const wk = weekStart(today);
    m.a.missing.forEach((mid) => addManualItem(itemName(mid).replace(/^./, (c) => c.toUpperCase()), wk));
    toast(`Added ${m.a.missing.length} ${m.a.missing.length === 1 ? "item" : "items"} to your List.`);
  };

  let action: ReactElement;
  if (swapSlot) {
    action = (
      <button className="ck-btn ck-btn--primary ck-btn--block" onClick={() => {
        const r = swapDinner(swapSlot.date, recipe.id, (rid) => (rid ? byId[rid]?.title : undefined));
        toast(r.text, { label: "Undo", run: () => restore(r.undo) });
        navigate(href.home(weekStart(swapSlot.date) === weekStart(today) ? undefined : weekStart(swapSlot.date)));
      }}><SwapIcon />Make this {when(swapSlot.date, "dinner")}</button>
    );
  } else if (addSlot) {
    const there = plan[planId(addSlot.date, addSlot.meal)];
    action = (
      <button className="ck-btn ck-btn--primary ck-btn--block" onClick={() => {
        const undo = snapshot([addSlot]);
        assign(addSlot.date, addSlot.meal, { kind: "recipe", refId: recipe.id, servings: there?.servings });
        toast(`Added to ${when(addSlot.date, addSlot.meal)}.`, { label: "Undo", run: () => restore(undo) });
        back();
      }}>{there ? `Use for ${when(addSlot.date, addSlot.meal)} instead` : `Add to ${when(addSlot.date, addSlot.meal)}${addSlot.meal === "lunch" ? " lunch" : ""}`}</button>
    );
  } else if (isPlannedHere && planSlot) {
    action = (
      <button className={`ck-btn ${entry!.cooked ? "ck-btn--secondary" : "ck-btn--primary"} ck-btn--block`} onClick={() => {
        const { id: _i, updatedAt: _u, date: _d, meal: _m, ...rest } = entry!; void _i; void _u; void _d; void _m;
        assign(planSlot.date, planSlot.meal, { ...rest, cooked: !entry!.cooked });
        if (!entry!.cooked) toast("Marked as cooked. Nice work.");
      }}><CheckIcon />{entry!.cooked ? "Cooked" : "Mark as cooked"}</button>
    );
  } else {
    action = <button className="ck-btn ck-btn--primary ck-btn--block" onClick={() => setPlanSheet(true)}>Add to plan</button>;
  }

  return (
    <div className="ck-pl ck-pl-recipe">
      <div className="ck-pl-recipe__hero">
        <RecipeImg recipe={recipe} eager />
        <button className="ck-icon-btn ck-icon-btn--float ck-pl-recipe__back" aria-label="Back" onClick={back}><BackIcon /></button>
      </div>

      <div className="ck-pl-recipe__body">
        {overline && <span className="ck-overline">{overline}</span>}
        <h1 className="ck-display ck-pl-recipe__title">{recipe.title}</h1>
        {recipe.source === "nyt" && <div className="ck-muted ck-small">NYT Cooking</div>}
        <div className="ck-pl-recipe__meta">
          <Time minutes={recipe.totalMinutes} />
          <HaveBadge missing={m.a.missing.length} />
        </div>
        <div className="ck-pl-row">
          <span>Servings{factor !== 1 && <span className="ck-muted ck-small"> · amounts scaled</span>}</span>
          <div className="ck-stepper" role="group" aria-label="Servings">
            <button aria-label="Fewer servings" disabled={servings <= 1} onClick={() => setServings(servings - 1)}>−</button>
            <output aria-live="polite">{servings}</output>
            <button aria-label="More servings" onClick={() => setServings(servings + 1)}>+</button>
          </div>
        </div>

        <section className="ck-pl-section">
          <div className="ck-pl-section__head">
            <h2 className="ck-h2">Ingredients</h2>
            {total > 0 && <span className="ck-muted ck-small">You have {m.a.have.length} of {total}</span>}
          </div>
          {m.a.missing.length > 0 && (upcoming ? (
            <p className="ck-pl-note">Missing items are on your List for {when(upcoming.date, upcoming.meal)}.</p>
          ) : (
            <button className="ck-btn ck-btn--secondary ck-btn--sm ck-pl-addmissing" onClick={addMissing}>Add {m.a.missing.length} missing to List</button>
          ))}
          <ul className="ck-ingredients">
            {lines.map((l, k) => {
              const ds = l.status === "have" ? "have" : l.status === "low" ? "low" : l.status === "missing" ? "need" : undefined;
              return (
                <li key={k} className="ck-ingredient ck-pl-ing" data-status={ds}>
                  <span className="ck-ingredient__dot" aria-hidden="true" />
                  <span className="ck-pl-ing__text">
                    {scaleLine(l.line, factor)}
                    {STATUS_TEXT[l.status] && <span className={`ck-pl-ing__status is-${ds}`}>{STATUS_TEXT[l.status]}</span>}
                  </span>
                  {l.status === "missing" ? (
                    <button className="ck-btn ck-btn--secondary ck-btn--sm" onClick={() => {
                      const ids = l.ids.filter((i) => m.a.missing.includes(i));
                      setStatus(ids, "have");
                      toast(`Marked ${ids.map(itemName).join(" and ")} as in stock.`, { label: "Undo", run: () => setStatus(ids, "out") });
                    }}>Have it</button>
                  ) : <span />}
                </li>
              );
            })}
          </ul>
        </section>

        {recipe.steps && recipe.steps.length > 0 && (
          <section className="ck-pl-section">
            <h2 className="ck-h2">Steps</h2>
            <ol className="ck-pl-steps">
              {recipe.steps.map((s, k) => <li key={k} className="ck-card ck-card--pad"><span className="ck-pl-steps__n">{k + 1}</span><p>{s}</p></li>)}
            </ol>
          </section>
        )}

        {recipe.url && (
          <a className="ck-btn ck-btn--ghost ck-pl-nyt" href={recipe.url} target="_blank" rel="noreferrer">
            {recipe.source === "nyt" ? "Open on NYT Cooking" : "Open original recipe"} <ExternalIcon />
          </a>
        )}
      </div>

      <div className="ck-actionbar ck-pl-recipe__bar">{action}</div>

      <AddToPlanSheet open={planSheet} onClose={() => setPlanSheet(false)} recipe={recipe} servings={localServings} plan={plan} byId={byId} />
    </div>
  );
}

function AddToPlanSheet({ open, onClose, recipe, servings, plan, byId }: {
  open: boolean; onClose: () => void; recipe: Recipe; servings: number;
  plan: Record<string, import("@shared/types").PlanEntry>; byId: Record<string, Recipe>;
}) {
  const today = todayYmd();
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  const settings = useSettings();
  return (
    <Sheet open={open} onClose={onClose} label="Add to plan">
      <h2 className="ck-h2 ck-pl-sheet__h">Add to plan</h2>
      <p className="ck-muted ck-small">Pick a night. If something's planned, this takes its place.</p>
      <div className="ck-pl-options" role="menu">
        {days.map((d) => {
          const there = plan[planId(d, "dinner")];
          return (
            <button key={d} role="menuitem" onClick={() => {
              const undo = snapshot([{ date: d, meal: "dinner" }]);
              assign(d, "dinner", { kind: "recipe", refId: recipe.id, servings: servings === settings.householdSize ? undefined : servings });
              toast(`Added to ${relDay(d, today) === "Today" ? "tonight" : dayName(d, true)}.`, { label: "Undo", run: () => restore(undo) });
              onClose();
            }}>
              <span>{relDay(d, today) === "Today" ? "Tonight" : relDay(d, today)} <span className="ck-muted">{shortDate(d)}</span></span>
              <small>{there ? entryLabel(there, byId) : "Open"}</small>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
