import { describe, expect, it } from "vitest";
import { parseLine } from "../parse";
import { Amount, fraction } from "../units";
import { normalizeName } from "../normalize";

describe("parseLine", () => {
  it("reads mixed numbers, unicode fractions, ranges and units", () => {
    expect(parseLine("1 1/2 cups flour")).toMatchObject({ quantity: 1.5, unit: "cups", name: "flour" });
    expect(parseLine("½ tsp. salt")).toMatchObject({ quantity: 0.5, unit: "tsp", name: "salt" });
    expect(parseLine("1½ cups milk")).toMatchObject({ quantity: 1.5, unit: "cups" });
    expect(parseLine("3/4 cup grated Parmesan")).toMatchObject({ quantity: 0.75, unit: "cup" });
    expect(parseLine("2 to 3 cloves garlic")).toMatchObject({ quantity: 3, unit: "clove", name: "garlic" });
    expect(parseLine("2 (15-ounce) cans black beans")).toMatchObject({ quantity: 2, unit: "can", name: "black beans" });
    expect(parseLine("2 lb. chicken thighs")).toMatchObject({ quantity: 2, unit: "lb", name: "chicken thighs" });
    expect(parseLine("Salt and pepper")).toMatchObject({ quantity: undefined, name: "Salt and pepper" });
  });
});

describe("Amount", () => {
  const sum = (...xs: [number | undefined, string?][]) => { const a = new Amount(); for (const [q, u] of xs) a.add(q, u); return a.format(); };
  it("adds volumes across units", () => {
    expect(sum([2, "cups"], [4, "tbsp"])).toBe("2¼ cups");
    expect(sum([1, "tsp"], [2, "teaspoons"])).toBe("1 tbsp");
    expect(sum([1, "gallon"])).toBe("1 gallon");
  });
  it("adds weights and shows pounds from 1 lb", () => {
    expect(sum([1.5, "pounds"], [1, "lb"])).toBe("2½ lb");
    expect(sum([8, "ounces"])).toBe("8 oz");
    expect(sum([12, "oz"], [8, "oz"])).toBe("1¼ lb");
  });
  it("keeps counts and other units apart", () => {
    expect(sum([1], [2])).toBe("3");
    expect(sum([2, "can"], [1, "can"])).toBe("3 cans");
    expect(sum([1, "lb"], [2])).toBe("1 lb + 2");
    expect(sum([undefined])).toBe("");
  });
  it("formats fractions", () => {
    expect(fraction(2.5)).toBe("2½");
    expect(fraction(1 / 3)).toBe("⅓");
    expect(fraction(3)).toBe("3");
  });
});

describe("normalizeName", () => {
  it("strips prep words and plurals", () => {
    expect(normalizeName("2 large Yellow Onions, diced")).toBe("yellow onion");
    expect(normalizeName("fresh tarragon")).toBe("tarragon");
    expect(normalizeName("Water")).toBe("");
  });
});
