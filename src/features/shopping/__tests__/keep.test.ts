import { describe, expect, it } from "vitest";
import { canShareToKeep, copyForKeep, shareToKeep, toKeepText } from "../keep";

const lines = [
  { name: "Chicken thighs", amount: "2½ lb", checked: false },
  { name: "Milk", amount: "", checked: false },
  { name: "Bananas", amount: "", checked: true },
];

describe("toKeepText", () => {
  it("writes one plain line per unchecked item, no bullets", () => {
    expect(toKeepText(lines)).toBe("Chicken thighs (2½ lb)\nMilk");
    expect(toKeepText(lines, { amounts: false, includeChecked: true })).toBe("Chicken thighs\nMilk\nBananas");
  });
});

describe("share and copy", () => {
  it("uses the share sheet when present", async () => {
    const sent: string[] = [];
    expect(await shareToKeep("a\nb", { share: async (d) => void sent.push(d.text!), canShare: () => true })).toBe("shared");
    expect(sent).toEqual(["a\nb"]);
  });
  it("reports a cancelled share without copying", async () => {
    let copied = false;
    const abort = Object.assign(new Error("x"), { name: "AbortError" });
    const res = await shareToKeep("a", { share: async () => { throw abort; }, clipboard: { writeText: async () => void (copied = true) } });
    expect(res).toBe("cancelled");
    expect(copied).toBe(false);
  });
  it("falls back to the clipboard", async () => {
    let copied = "";
    expect(await shareToKeep("a", { clipboard: { writeText: async (t) => void (copied = t) } })).toBe("copied");
    expect(copied).toBe("a");
    expect(await copyForKeep("a", {})).toBe("failed");
    expect(canShareToKeep({})).toBe(false);
  });
});
