/** Placeholder from the scaffold. The onboarding thread replaces this file. */
import { updateSettings } from "@shared/domain";
import { navigate } from "../../app/nav";

export function Onboarding() {
  return (
    <section className="ck-placeholder">
      <h2>Set up your kitchen</h2>
      <p>Onboarding is coming soon.</p>
      <button onClick={() => { updateSettings({ onboardingComplete: true }); navigate("home"); }}>Skip for now</button>
    </section>
  );
}
