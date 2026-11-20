import { describe, expect, it } from "vitest";
import { centsToAmount, parseAmountToCents } from "./money";

describe("parseAmountToCents", () => {
  it("parses whole and decimal amounts exactly", () => {
    expect(parseAmountToCents("45")).toBe(4500);
    expect(parseAmountToCents("45.5")).toBe(4550);
    expect(parseAmountToCents(" 45.50 ")).toBe(4550);
    // 0.29 * 100 is 28.999999999999996 in floating point; string parsing avoids that.
    expect(parseAmountToCents("0.29")).toBe(29);
  });

  it("rejects anything that isn't a plain amount", () => {
    for (const input of ["", "-5", "45.505", "1e3", "45,50", "$45", "abc", "1234567", ".5"]) {
      expect(parseAmountToCents(input), input).toBeNull();
    }
  });
});

describe("centsToAmount", () => {
  it("round-trips", () => {
    expect(centsToAmount(4500)).toBe("45");
    expect(centsToAmount(4550)).toBe("45.50");
    expect(centsToAmount(4505)).toBe("45.05");
    for (const cents of [1, 29, 4505, 99999]) expect(parseAmountToCents(centsToAmount(cents))).toBe(cents);
  });
});
