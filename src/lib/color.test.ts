import { describe, expect, it } from "vitest";

import { nodeAccentDark, nodeAccentLight, nodeSwatch } from "./color";

const VOLT = "var(--volt)";
const MUTED = "var(--muted-foreground)";

describe("nodeAccentDark", () => {
  it("falls back to voltage for missing/blank/invalid colors", () => {
    expect(nodeAccentDark(undefined)).toBe(VOLT);
    expect(nodeAccentDark("")).toBe(VOLT);
    expect(nodeAccentDark("not-a-color")).toBe(VOLT);
    expect(nodeAccentDark("#12")).toBe(VOLT);
    expect(nodeAccentDark("#12345g")).toBe(VOLT);
  });

  it("falls back for colors too dark to read on the night background", () => {
    expect(nodeAccentDark("#000000")).toBe(VOLT);
    expect(nodeAccentDark("000000")).toBe(VOLT); // accepts a missing '#'
    expect(nodeAccentDark("#0a0a0a")).toBe(VOLT);
  });

  it("returns bright-enough colors, normalising the '#' prefix", () => {
    expect(nodeAccentDark("#3399ff")).toBe("#3399ff");
    expect(nodeAccentDark("3399ff")).toBe("#3399ff");
    expect(nodeAccentDark("#ffffff")).toBe("#ffffff");
  });
});

describe("nodeAccentLight", () => {
  it("falls back to voltage for missing/blank/invalid colors", () => {
    expect(nodeAccentLight(undefined)).toBe(VOLT);
    expect(nodeAccentLight("")).toBe(VOLT);
    expect(nodeAccentLight("not-a-color")).toBe(VOLT);
  });

  it("falls back for colors too light to read on the daylight background", () => {
    expect(nodeAccentLight("#ffffff")).toBe(VOLT);
    expect(nodeAccentLight("ffffff")).toBe(VOLT); // accepts a missing '#'
    expect(nodeAccentLight("#ffff00")).toBe(VOLT); // pure yellow
  });

  it("returns dark-enough colors (even black), normalising the '#' prefix", () => {
    expect(nodeAccentLight("#3399ff")).toBe("#3399ff");
    expect(nodeAccentLight("3399ff")).toBe("#3399ff");
    expect(nodeAccentLight("#000000")).toBe("#000000");
  });
});

describe("nodeSwatch", () => {
  it("returns the literal broadcast color when valid (even black)", () => {
    expect(nodeSwatch("#000000")).toBe("#000000");
    expect(nodeSwatch("abcdef")).toBe("#abcdef");
  });

  it("returns a muted placeholder for missing/invalid colors", () => {
    expect(nodeSwatch(undefined)).toBe(MUTED);
    expect(nodeSwatch("nope")).toBe(MUTED);
  });
});
