/**
 * "Or make instead, with what you have": a horizontal row of dinners Cory can cook from
 * what's in the kitchen right now, with filters for quicker options. Shown under tonight's
 * hero on home and pinned at the top of the meal sheet.
 */
import { useMemo, useState } from "react";
import type { Recipe } from "@shared/types";
import { swapOptions, type StatusMap, type SwapFilter, QUICK_MINUTES } from "./logic";
import { HaveBadge, RecipeImg, Time } from "./ui";

export interface SwapBarProps {
  planned?: Recipe;
  recipes: Recipe[];
  status: StatusMap;
  onPick: (recipe: Recipe) => void;
  title?: string;
}

export function SwapBar({ planned, recipes, status, onPick, title = "Or make instead, with what you have" }: SwapBarProps) {
  const [filter, setFilter] = useState<SwapFilter>("all");
  const opts = useMemo(() => swapOptions(planned, recipes, status, filter), [planned, recipes, status, filter]);
  const canQuicker = planned?.totalMinutes != null && planned.totalMinutes > 20;
  const chips: [SwapFilter, string][] = [["all", "All"], ...(canQuicker ? [["quicker", "Quicker"] as [SwapFilter, string]] : []), ["under30", `Under ${QUICK_MINUTES} min`]];

  return (
    <section className="ck-swap-bar" aria-label="Swap options">
      <div className="ck-swap-bar__head">
        <h3 className="ck-swap-bar__title">{title}</h3>
      </div>
      <div className="ck-chips ck-chips--scroll" role="group" aria-label="Filter swaps">
        {chips.map(([k, label]) => (
          <button key={k} type="button" className="ck-chip ck-chip--filter" aria-pressed={filter === k} onClick={() => setFilter(k)}>{label}</button>
        ))}
      </div>
      <div className="ck-swap-bar__track">
        {opts.length === 0 ? (
          <p className="ck-muted ck-small ck-pl-swap-empty">
            {filter === "all" ? "Nothing else is in stock yet. Mark what you have in Kitchen to see swaps here." : "No faster dinners in stock right now."}
          </p>
        ) : opts.map((m) => {
          const saves = planned?.totalMinutes && m.recipe.totalMinutes && planned.totalMinutes - m.recipe.totalMinutes >= 10 ? planned.totalMinutes - m.recipe.totalMinutes : 0;
          return (
            <button key={m.recipe.id} type="button" className="ck-card ck-recipe-card ck-recipe-card--compact ck-pl-cardbtn" onClick={() => onPick(m.recipe)}>
              <div className="ck-recipe-card__img"><RecipeImg recipe={m.recipe} /></div>
              <div className="ck-recipe-card__body">
                <h4 className="ck-recipe-card__title">{m.recipe.title}</h4>
                <div className="ck-recipe-card__meta">
                  <Time minutes={m.recipe.totalMinutes} />
                  {saves > 0 && <span className="ck-pl-saves">{saves} min faster</span>}
                </div>
                <HaveBadge missing={m.a.missing.length} />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
