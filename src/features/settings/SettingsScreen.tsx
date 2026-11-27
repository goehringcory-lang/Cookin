import type { ReactNode } from "react";
import { useCollection, useDoc, useSyncStatus, type SyncStatus } from "@shared/store";
import { updateSettings, useSettings } from "@shared/domain";
import { AppBar, Button, Card, SectionTitle, Stepper } from "@shared/ui";
import { navigate } from "../../app/nav";
import { StaplesEditor } from "./StaplesEditor";
import "./settings.css";

const SYNC_TEXT: Record<SyncStatus, string> = {
  synced: "Up to date across your devices",
  syncing: "Syncing…",
  offline: "Offline. Changes will sync when you're back online.",
  local: "Saved on this device only (not connected to the server)",
  unauthorized: "Signed out. Reload the page to sign in again.",
};

export function ago(ms: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  if (d < 7) return d === 1 ? "yesterday" : `${d} days ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Row({ title, hint, children }: { title: ReactNode; hint?: ReactNode; children?: ReactNode }) {
  return (
    <div className="ck-st-row">
      <div className="ck-st-row__text">
        <div className="ck-st-row__title">{title}</div>
        {hint && <div className="ck-st-row__hint">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

export function SettingsScreen() {
  const settings = useSettings();
  const status = useSyncStatus();
  const nyt = useDoc("meta", "nyt");
  const recipeCount = Object.keys(useCollection("recipes")).length;

  return (
    <div className="ck-settings">
      <AppBar title="Settings" back={() => (history.length > 1 ? history.back() : navigate("home"))} />

      <SectionTitle>Household</SectionTitle>
      <Card>
        <Row title="Dinners a week" hint="How many dinners the planner fills">
          <Stepper label="dinners a week" value={settings.dinnersPerWeek} min={1} max={7} onChange={(n) => updateSettings({ dinnersPerWeek: n })} />
        </Row>
        <Row title="Cooking for" hint="People eating, used to scale recipes">
          <Stepper label="people" value={settings.householdSize} min={1} max={12} onChange={(n) => updateSettings({ householdSize: n })} />
        </Row>
        <Row title="Week starts on">
          <div className="ck-st-seg" role="group" aria-label="Week starts on">
            {([1, 0] as const).map((d) => (
              <button key={d} type="button" aria-pressed={settings.weekStartsOn === d} onClick={() => updateSettings({ weekStartsOn: d })}>
                {d === 1 ? "Mon" : "Sun"}
              </button>
            ))}
          </div>
        </Row>
      </Card>

      <SectionTitle>Always buy</SectionTitle>
      <p className="ck-muted ck-st-note">These go on every shopping list, whatever's in the kitchen.</p>
      <Card pad>
        <StaplesEditor />
      </Card>

      <SectionTitle>Kitchen</SectionTitle>
      <Card>
        <Row title="Walk through setup again" hint="Tap through pantry, fridge and freezer. Nothing is cleared.">
          <Button variant="secondary" size="sm" onClick={() => navigate("onboarding")}>
            Start
          </Button>
        </Row>
      </Card>

      <SectionTitle>Sync</SectionTitle>
      <Card>
        <Row title="This device" hint={SYNC_TEXT[status]}>
          <span className="ck-st-dot" data-status={status} aria-hidden />
        </Row>
        <Row
          title="NYT Recipe Box"
          hint={
            nyt
              ? `Last synced ${ago(nyt.at)} by ${nyt.via === "weekly" ? "the Sunday sync" : "the Sync button"}: ${nyt.added} new, ${nyt.updated} updated. ${recipeCount} recipes in Cookin.`
              : `Not synced yet. ${recipeCount} recipes in Cookin.`
          }
        >
          <Button variant="secondary" size="sm" onClick={() => navigate("recipes")}>
            Open
          </Button>
        </Row>
      </Card>
    </div>
  );
}
