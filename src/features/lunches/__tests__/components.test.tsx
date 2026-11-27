import { describe, expect, it } from "vitest";
import { renderToString as rts } from "react-dom/server";
import type { ReactElement } from "react";

const renderToString = (el: ReactElement) => rts(el).replace(/<!-- -->/g, "");
import { LeftoversToggle, LunchPicker, LunchSlot } from "../index";

describe("lunch components render", () => {
  it("picker shows leftovers first, then ready lunches", () => {
    const html = renderToString(
      <LunchPicker
        date="2026-12-01"
        kitchen={new Set(["sandwich-bread", "peanut-butter", "bananas"])}
        dinners={[{ date: "2026-11-30", recipeId: "nyt-1", title: "Turkey chili", servings: 8 }]}
        onPick={() => {}}
      />,
    );
    expect(html).toContain("Lunch for Tuesday");
    expect(html).toContain("Leftovers: Turkey chili");
    expect(html).toContain("PB&amp;J");
    expect(html.indexOf("Leftovers: Turkey chili")).toBeLessThan(html.indexOf("Ready now"));
  });

  it("slot shows items to buy", () => {
    const html = renderToString(
      <LunchSlot entry={{ id: "x", date: "2026-12-01", meal: "lunch", kind: "lunch", refId: "l-turkey-cheese-sandwich", updatedAt: 0 }} kitchen={new Set()} onOpen={() => {}} />,
    );
    expect(html).toContain("Lunch: turkey and cheese sandwich");
    expect(html).toContain("3 to buy");
  });

  it("toggle explains the scale-up", () => {
    const html = renderToString(<LeftoversToggle dinner={{ date: "2026-11-30", recipeId: "r", title: "Tacos", servings: 4, makesLeftovers: true }} settings={{ householdSize: 4, leftoverPortionsForLunch: 2, includeWeekends: true }} onChange={() => {}} />);
    expect(html).toContain("Make 1½× the recipe");
  });
});
