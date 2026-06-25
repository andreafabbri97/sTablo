import { describe, it, expect } from "vitest";
import { matchInvolvesAnySlug } from "./match-filter";
import type { ShapedMatch } from "./queries";

/** Minimal match carrying only the fields the predicate reads. */
function match(slugsA: string[], slugsB: string[]): ShapedMatch {
  const side = (slugs: string[]) => ({
    label: "",
    teamName: null,
    players: slugs.map((s) => ({
      id: s,
      name: s,
      slug: s,
      username: null,
      colorIndex: 0,
      imageUrl: null,
    })),
  });
  return { sideA: side(slugsA), sideB: side(slugsB) } as unknown as ShapedMatch;
}

describe("matchInvolvesAnySlug", () => {
  it("is false for an empty circle", () => {
    expect(matchInvolvesAnySlug(match(["ann"], ["bob"]), new Set())).toBe(false);
  });

  it("matches a friend on side A", () => {
    expect(matchInvolvesAnySlug(match(["ann"], ["bob"]), new Set(["ann"]))).toBe(
      true,
    );
  });

  it("matches a friend on side B", () => {
    expect(matchInvolvesAnySlug(match(["ann"], ["bob"]), new Set(["bob"]))).toBe(
      true,
    );
  });

  it("is false when no participant is in the circle", () => {
    expect(
      matchInvolvesAnySlug(match(["ann"], ["bob"]), new Set(["carl", "dan"])),
    ).toBe(false);
  });

  it("matches the viewer's own slug (self is part of the circle)", () => {
    expect(matchInvolvesAnySlug(match(["me"], ["x"]), new Set(["me"]))).toBe(
      true,
    );
  });

  it("matches a doubles match where only one of four players is a friend", () => {
    expect(
      matchInvolvesAnySlug(
        match(["ann", "stranger1"], ["stranger2", "stranger3"]),
        new Set(["ann"]),
      ),
    ).toBe(true);
  });
});
