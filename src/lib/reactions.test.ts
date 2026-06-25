import { describe, it, expect } from "vitest";
import {
  MATCH_REACTIONS,
  isValidReaction,
  MAX_COMMENT_LENGTH,
} from "./reactions";

describe("MATCH_REACTIONS palette", () => {
  it("is a non-empty, duplicate-free allow-list", () => {
    expect(MATCH_REACTIONS.length).toBeGreaterThan(0);
    expect(new Set(MATCH_REACTIONS).size).toBe(MATCH_REACTIONS.length);
  });
});

describe("isValidReaction", () => {
  it("accepts every emoji in the palette", () => {
    for (const emoji of MATCH_REACTIONS) {
      expect(isValidReaction(emoji)).toBe(true);
    }
  });

  it("rejects anything outside the palette", () => {
    expect(isValidReaction("🍕")).toBe(false);
    expect(isValidReaction("")).toBe(false);
    expect(isValidReaction("not-an-emoji")).toBe(false);
  });
});

describe("MAX_COMMENT_LENGTH", () => {
  it("keeps comments short", () => {
    expect(MAX_COMMENT_LENGTH).toBe(280);
  });
});
