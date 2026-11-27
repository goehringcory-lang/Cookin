import { describe, expect, it } from "vitest";
import { canShareToKeep, copyForKeep, parseKeepNoteUrl, shareToKeep, toKeepText, unsent } from "../keep";

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

describe("linked Keep note", () => {
  it("accepts a note link from the address bar and cleans it", () => {
    expect(parseKeepNoteUrl("https://keep.google.com/#LIST/1a2B3c")).toBe("https://keep.google.com/#LIST/1a2B3c");
    expect(parseKeepNoteUrl("  keep.google.com/u/1/#NOTE/abc.def-9 ")).toBe("https://keep.google.com/u/1/#NOTE/abc.def-9");
    expect(parseKeepNoteUrl("https://keep.google.com/u/0#LIST/x?y=1")).toBe(null);
    expect(parseKeepNoteUrl("https://keep.google.com/?hl=en#LIST/x")).toBe("https://keep.google.com/#LIST/x");
  });
  it("rejects anything that isn't one Keep note", () => {
    for (const bad of ["", "https://keep.google.com/", "https://keep.google.com/#home", "https://evil.example/#LIST/x", "https://keep.google.com.evil.example/#LIST/x", "javascript:alert(1)//keep.google.com/#LIST/x"])
      expect(parseKeepNoteUrl(bad)).toBe(null);
  });
  it("sends only unchecked lines not already sent", () => {
    const keyed = [
      { key: "a", name: "Milk", checked: false },
      { key: "b", name: "Eggs", checked: false },
      { key: "c", name: "Bread", checked: true },
    ];
    expect(unsent(keyed, new Set(["a"])).map((l) => l.name)).toEqual(["Eggs"]);
    expect(unsent(keyed, new Set())).toHaveLength(2);
  });
});
