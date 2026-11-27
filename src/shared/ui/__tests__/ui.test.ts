import { describe, expect, it } from "vitest";
import { formatMinutes } from "../index";
import { haveBadge } from "@styles/tokens";

describe("ui helpers", () => {
  it("formats minutes", () => {
    expect(formatMinutes(20)).toBe("20 min");
    expect(formatMinutes(60)).toBe("1 hr");
    expect(formatMinutes(95)).toBe("1 hr 35 min");
  });
  it("words the have badge consistently", () => {
    expect(haveBadge(0)).toEqual({ tone: "have", text: "Have everything" });
    expect(haveBadge(2)).toEqual({ tone: "low", text: "Need 2" });
    expect(haveBadge(5)).toEqual({ tone: "need", text: "Need 5" });
  });
});
