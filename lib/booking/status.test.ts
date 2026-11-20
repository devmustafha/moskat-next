import { describe, expect, it } from "vitest";
import { canTransition } from "./status";

describe("canTransition", () => {
  it("allows the documented changes", () => {
    expect(canTransition("confirmed", "cancelled")).toBe(true);
    expect(canTransition("confirmed", "completed")).toBe(true);
    expect(canTransition("confirmed", "no_show")).toBe(true);
    expect(canTransition("completed", "no_show")).toBe(true);
  });

  it("treats cancelled and no-show as final", () => {
    expect(canTransition("cancelled", "confirmed")).toBe(false);
    expect(canTransition("no_show", "completed")).toBe(false);
    expect(canTransition("completed", "cancelled")).toBe(false);
  });
});
