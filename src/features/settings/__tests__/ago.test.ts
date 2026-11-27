import { describe, expect, it } from "vitest";
import { ago } from "../SettingsScreen";

describe("ago", () => {
  const now = 1_800_000_000_000;
  it("formats recent times", () => {
    expect(ago(now - 10_000, now)).toBe("just now");
    expect(ago(now - 5 * 60_000, now)).toBe("5 min ago");
    expect(ago(now - 3 * 3_600_000, now)).toBe("3 hr ago");
    expect(ago(now - 24 * 3_600_000, now)).toBe("yesterday");
    expect(ago(now - 3 * 86_400_000, now)).toBe("3 days ago");
  });
});
