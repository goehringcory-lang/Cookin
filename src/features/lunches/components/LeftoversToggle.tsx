import { autoMakesLeftovers, leftoversHint } from "../leftovers";
import type { LunchSettings, PlannedDinner } from "../types";
import { DEFAULT_LUNCH_SETTINGS } from "../types";

export interface LeftoversToggleProps {
  dinner: PlannedDinner;
  settings?: LunchSettings;
  /** true / false = Cory's choice; undefined = back to automatic. */
  onChange: (value: boolean | undefined) => void;
}

/** "Save some for tomorrow's lunch" switch for a dinner or recipe screen. */
export function LeftoversToggle({ dinner, settings = DEFAULT_LUNCH_SETTINGS, onChange }: LeftoversToggleProps) {
  const auto = autoMakesLeftovers(dinner, settings);
  const on = dinner.makesLeftovers ?? auto;
  return (
    <div className="ck-lunch-toggle">
      <label className="ck-lunch-toggle__row">
        <input
          type="checkbox"
          role="switch"
          checked={on}
          onChange={(e) => {
            const v = e.target.checked;
            // Going back to what the app would guess clears the override.
            onChange(v === auto ? undefined : v);
          }}
        />
        <span>
          <span className="ck-lunch-toggle__title">Leftovers for tomorrow's lunch</span>
          <span className="ck-lunch-toggle__hint">{leftoversHint(dinner, settings)}</span>
        </span>
      </label>
    </div>
  );
}
