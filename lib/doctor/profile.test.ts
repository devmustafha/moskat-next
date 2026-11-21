import { describe, expect, it } from "vitest";
import { doctorProfileSchema, doctorRatesSchema, linesToText, paragraphsToText, splitLines, splitParagraphs } from "./profile";

const valid = {
  bio: "First paragraph\nwraps here.\n\n\nSecond paragraph.",
  qualifications: "MD, Example University\n\n  Board certified  ",
  languages: "English\r\nSpanish",
  interests: "",
  yearsExperience: "12",
};

describe("splitLines / splitParagraphs", () => {
  it("trims and drops blank lines", () => {
    expect(splitLines("  a \n\n b\r\n")).toEqual(["a", "b"]);
  });

  it("splits on blank lines and joins wrapped lines", () => {
    expect(splitParagraphs(valid.bio)).toEqual(["First paragraph wraps here.", "Second paragraph."]);
  });

  it("round-trips the form prefill", () => {
    expect(splitLines(linesToText(["a", "b"]))).toEqual(["a", "b"]);
    expect(splitParagraphs(paragraphsToText(["One.", "Two."]))).toEqual(["One.", "Two."]);
  });
});

describe("doctorProfileSchema", () => {
  it("parses the form into arrays", () => {
    expect(doctorProfileSchema.parse(valid)).toEqual({
      bio: ["First paragraph wraps here.", "Second paragraph."],
      qualifications: ["MD, Example University", "Board certified"],
      languages: ["English", "Spanish"],
      interests: [],
      yearsExperience: 12,
    });
  });

  it.each([
    [{ bio: "  " }, "Please write a short biography."],
    [{ languages: "\n" }, "List at least one language."],
    [{ qualifications: "x".repeat(121) }, "Each line in Qualifications can be at most 120 characters."],
    [{ interests: Array.from({ length: 13 }, (_, i) => `Interest ${i}`).join("\n") }, "Clinical interests can have at most 12 lines."],
    [{ yearsExperience: "-1" }, "Years of experience can’t be negative."],
    [{ yearsExperience: "2.5" }, "Years of experience must be a whole number."],
    [{ yearsExperience: "71" }, "Years of experience can be at most 70."],
  ])("rejects %o", (override, message) => {
    const result = doctorProfileSchema.safeParse({ ...valid, ...override });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(message);
  });
});

describe("doctorRatesSchema", () => {
  it("converts the fee to cents", () => {
    expect(doctorRatesSchema.parse({ fee: "45.5" })).toEqual({ fee: 4550 });
  });

  it.each([
    [{ fee: "0" }, "Enter a fee like 45 or 45.50."],
    [{ fee: "45.555" }, "Enter a fee like 45 or 45.50."],
  ])("rejects %o", (input, message) => {
    const result = doctorRatesSchema.safeParse(input);
    expect(result.error?.issues[0]?.message).toBe(message);
  });
});
