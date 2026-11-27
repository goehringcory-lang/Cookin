/**
 * "Add a recipe" sheet: paste (or share) an NYT Cooking gift link or any recipe link. The server
 * reads the page's recipe data; if it can't, Cory pastes the ingredient list instead.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Recipe } from "@shared/types";
import { useOwned } from "@shared/domain";
import { analyzeRecipe } from "@shared/catalog";
import { RecipeImage, Sheet, formatMinutes } from "@shared/ui";
import { navigate } from "../../app/nav";
import { findUrl, recipeFromText } from "../nyt-sync/core/link";
import { fetchRecipe, saveRecipe, type FetchResult } from "./add";

type Step =
  | { s: "link"; error?: string }
  | { s: "loading"; url: string }
  | { s: "done"; recipe: Recipe; existed: boolean }
  | { s: "manual"; url?: string; why?: string; title?: string; imageUrl?: string };

const WHY: Record<string, string> = {
  blocked: "NYT didn't let Cookin read that page.",
  no_recipe: "Cookin couldn't find a recipe on that page.",
  unreachable: "Cookin couldn't reach that page.",
  offline: "You look offline right now.",
  signed_out: "You're signed out of Cookin. Reload the app to sign in, then try again.",
  bad_url: "That doesn't look like a recipe link.",
};

export function AddRecipeSheet({ onClose, initial }: { onClose: () => void; initial?: string }) {
  const [step, setStep] = useState<Step>({ s: "link" });
  const [text, setText] = useState(initial ?? "");
  const close = useCallback(() => onClose(), [onClose]);

  const read = useCallback(async (input: string) => {
    const url = findUrl(input);
    if (!url) { setStep({ s: "link", error: "Paste a link that starts with https://" }); return; }
    setStep({ s: "loading", url });
    const r: FetchResult = await fetchRecipe(url);
    if (r.ok) {
      const existed = !!(await import("@shared/store")).store.all("recipes")[r.recipe.id];
      setStep({ s: "done", recipe: saveRecipe(r.recipe, r.source), existed });
    } else if (r.reason === "signed_out" || r.reason === "bad_url") {
      setStep({ s: "link", error: WHY[r.reason] });
    } else {
      setStep({ s: "manual", url, why: WHY[r.reason], title: r.title, imageUrl: r.imageUrl });
    }
  }, []);

  // A shared link (phone Share sheet) starts reading right away.
  const started = useRef(false);
  useEffect(() => { if (initial && findUrl(initial) && !started.current) { started.current = true; void read(initial); } }, [initial, read]);

  const pasteFromClipboard = async () => {
    try { const t = await navigator.clipboard.readText(); if (t) { setText(t); if (findUrl(t)) void read(t); } } catch { /* permission denied: Cory types or long-presses instead */ }
  };

  return (
    <Sheet open onClose={close} title={step.s === "manual" ? "Add the ingredients" : "Add a recipe"}>
      <div className="ck-add-sheet ck-stack">
        {(step.s === "link" || step.s === "loading") && (
          <form className="ck-stack" onSubmit={e => { e.preventDefault(); void read(text); }}>
            <p className="ck-muted ck-small">Paste an NYT Cooking gift link (or any recipe link). Cookin reads the ingredients, time, photo and steps.</p>
            <input className="ck-input" type="url" inputMode="url" autoComplete="off" autoCapitalize="off" spellCheck={false}
              aria-label="Recipe link" placeholder="https://cooking.nytimes.com/recipes/…" value={text}
              onChange={e => setText(e.target.value)} disabled={step.s === "loading"} autoFocus={!initial} />
            {step.s === "link" && step.error && <p className="ck-add-sheet__error" role="alert">{step.error}</p>}
            {step.s === "loading" && <p className="ck-muted ck-small" role="status" aria-live="polite">Reading the recipe…</p>}
            <div className="ck-row">
              <button type="submit" className="ck-btn ck-btn--primary" disabled={step.s === "loading" || !text.trim()}>{step.s === "loading" ? "Adding…" : "Add recipe"}</button>
              {step.s === "link" && "clipboard" in navigator && typeof navigator.clipboard?.readText === "function" && (
                <button type="button" className="ck-btn ck-btn--secondary" onClick={pasteFromClipboard}>Paste link</button>
              )}
            </div>
            {step.s === "link" && (
              <button type="button" className="ck-btn ck-btn--ghost ck-btn--sm ck-add-sheet__manual" onClick={() => setStep({ s: "manual", url: findUrl(text) })}>
                No link? Type or paste the ingredients
              </button>
            )}
          </form>
        )}
        {step.s === "done" && <Added recipe={step.recipe} existed={step.existed} onAnother={() => { setText(""); setStep({ s: "link" }); }} onClose={close} />}
        {step.s === "manual" && <ManualForm step={step} onSaved={(recipe, existed) => setStep({ s: "done", recipe, existed })} onBack={() => setStep({ s: "link" })} />}
      </div>
    </Sheet>
  );
}

function Added({ recipe, existed, onAnother, onClose }: { recipe: Recipe; existed: boolean; onAnother: () => void; onClose: () => void }) {
  const owned = useOwned();
  const a = analyzeRecipe(recipe, owned);
  const n = recipe.ingredients.length;
  return (
    <div className="ck-stack" role="status" aria-live="polite">
      <p className="ck-add-sheet__ok">{existed ? "Already in your library. Updated it." : "Added to your library."}</p>
      <div className="ck-card ck-add-sheet__preview">
        <RecipeImage src={recipe.imageUrl} title={recipe.title} />
        <div className="ck-recipe-card__body">
          <h3 className="ck-recipe-card__title">{recipe.title}</h3>
          <div className="ck-recipe-card__meta">
            {recipe.totalMinutes ? <span>{formatMinutes(recipe.totalMinutes)}</span> : null}
            <span>{n} ingredient{n === 1 ? "" : "s"}</span>
            <span>{a.missing.length ? `Need ${a.missing.length}` : "You have everything"}</span>
          </div>
        </div>
      </div>
      <div className="ck-row">
        <button className="ck-btn ck-btn--primary" onClick={() => { onClose(); navigate(`recipe/${encodeURIComponent(recipe.id)}`); }}>See recipe</button>
        <button className="ck-btn ck-btn--secondary" onClick={onAnother}>Add another</button>
      </div>
    </div>
  );
}

function ManualForm({ step, onSaved, onBack }: { step: Extract<Step, { s: "manual" }>; onSaved: (r: Recipe, existed: boolean) => void; onBack: () => void }) {
  const [title, setTitle] = useState(step.title ?? "");
  const [ingredients, setIngredients] = useState("");
  const [minutes, setMinutes] = useState("");
  const [servings, setServings] = useState("");
  const [steps, setSteps] = useState("");
  const [error, setError] = useState("");
  const save = async () => {
    const r = recipeFromText({ title, ingredients, minutes, servings, steps, url: step.url, imageUrl: step.imageUrl });
    if (!r) { setError(!title.trim() ? "Give it a name." : "Paste at least one ingredient, one per line."); return; }
    const existed = !!(await import("@shared/store")).store.all("recipes")[r.id];
    onSaved(saveRecipe(r, r.id.startsWith("nyt-") ? "nyt" : "manual"), existed);
  };
  return (
    <form className="ck-stack" onSubmit={e => { e.preventDefault(); void save(); }}>
      {step.why && <p className="ck-muted ck-small">{step.why} Copy the ingredient list from the recipe page and paste it below, one per line.</p>}
      <input className="ck-input" aria-label="Recipe name" placeholder="Recipe name" value={title} onChange={e => setTitle(e.target.value)} />
      <textarea className="ck-input ck-add-sheet__area" aria-label="Ingredients, one per line" placeholder={"Ingredients, one per line\n2 pounds ripe tomatoes\n6 ounces fresh mozzarella"} rows={7} value={ingredients} onChange={e => setIngredients(e.target.value)} />
      <div className="ck-row">
        <input className="ck-input" inputMode="numeric" aria-label="Total minutes (optional)" placeholder="Minutes" value={minutes} onChange={e => setMinutes(e.target.value)} />
        <input className="ck-input" inputMode="numeric" aria-label="Servings (optional)" placeholder="Servings" value={servings} onChange={e => setServings(e.target.value)} />
      </div>
      <textarea className="ck-input ck-add-sheet__area" aria-label="Steps (optional)" placeholder="Steps (optional), one per line" rows={3} value={steps} onChange={e => setSteps(e.target.value)} />
      {error && <p className="ck-add-sheet__error" role="alert">{error}</p>}
      <div className="ck-row">
        <button type="submit" className="ck-btn ck-btn--primary">Save recipe</button>
        <button type="button" className="ck-btn ck-btn--ghost" onClick={onBack}>Back</button>
      </div>
    </form>
  );
}
