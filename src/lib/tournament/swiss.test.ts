import { describe, it, expect } from "vitest";
import { pairSwissRound, pairKey } from "./swiss";

describe("pairKey", () => {
  it("is order-independent", () => {
    expect(pairKey("a", "b")).toBe(pairKey("b", "a"));
  });
  it("distinguishes different pairs", () => {
    expect(pairKey("a", "b")).not.toBe(pairKey("a", "c"));
  });
});

describe("pairSwissRound — even field, no history", () => {
  it("pairs adjacent in standings order", () => {
    const { pairs, byeId } = pairSwissRound({
      ranked: ["a", "b", "c", "d"],
      playedPairs: [],
    });
    expect(byeId).toBeNull();
    expect(pairs).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("pairs a six-player field top-down", () => {
    const { pairs } = pairSwissRound({
      ranked: ["a", "b", "c", "d", "e", "f"],
      playedPairs: [],
    });
    expect(pairs).toEqual([
      ["a", "b"],
      ["c", "d"],
      ["e", "f"],
    ]);
  });
});

describe("pairSwissRound — rematch avoidance", () => {
  it("skips an already-played pair for the next eligible opponent", () => {
    // a-b already met → a should get c, leaving b-d
    const { pairs } = pairSwissRound({
      ranked: ["a", "b", "c", "d"],
      playedPairs: [["a", "b"]],
    });
    expect(pairs).toEqual([
      ["a", "c"],
      ["b", "d"],
    ]);
  });

  it("re-pairs across when both adjacent pairs have met", () => {
    const { pairs } = pairSwissRound({
      ranked: ["a", "b", "c", "d"],
      playedPairs: [
        ["a", "b"],
        ["c", "d"],
      ],
    });
    expect(pairs).toEqual([
      ["a", "c"],
      ["b", "d"],
    ]);
  });

  it("honours played pairs given in reverse order", () => {
    const { pairs } = pairSwissRound({
      ranked: ["a", "b", "c", "d"],
      playedPairs: [["b", "a"]], // reversed
    });
    expect(pairs).toEqual([
      ["a", "c"],
      ["b", "d"],
    ]);
  });

  it("falls back to a rematch only when no fresh opponent remains", () => {
    // Two players who have already met must replay — better than no match.
    const { pairs, byeId } = pairSwissRound({
      ranked: ["a", "b"],
      playedPairs: [["a", "b"]],
    });
    expect(byeId).toBeNull();
    expect(pairs).toEqual([["a", "b"]]);
  });
});

describe("pairSwissRound — byes (odd field)", () => {
  it("gives the bye to the lowest-ranked entrant when nobody has had one", () => {
    const { pairs, byeId } = pairSwissRound({
      ranked: ["a", "b", "c", "d", "e"],
      playedPairs: [],
    });
    expect(byeId).toBe("e");
    expect(pairs).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("skips an entrant who already had a bye and picks the next lowest", () => {
    const { pairs, byeId } = pairSwissRound({
      ranked: ["a", "b", "c", "d", "e"],
      playedPairs: [],
      hadBye: ["e"],
    });
    expect(byeId).toBe("d");
    // d removed from the queue → a,b,c,e remain
    expect(pairs).toEqual([
      ["a", "b"],
      ["c", "e"],
    ]);
  });

  it("falls back to the last entrant when everyone already had a bye", () => {
    const { byeId, pairs } = pairSwissRound({
      ranked: ["a", "b", "c", "d", "e"],
      playedPairs: [],
      hadBye: ["a", "b", "c", "d", "e"],
    });
    expect(byeId).toBe("e");
    expect(pairs).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });
});

describe("pairSwissRound — invariants", () => {
  it("pairs every entrant exactly once (plus the bye)", () => {
    const ranked = ["a", "b", "c", "d", "e", "f", "g"];
    const { pairs, byeId } = pairSwissRound({
      ranked,
      playedPairs: [
        ["a", "b"],
        ["c", "d"],
      ],
    });
    const seen = [...pairs.flat(), ...(byeId ? [byeId] : [])].sort();
    expect(seen).toEqual([...ranked].sort());
  });

  it("does not mutate its inputs", () => {
    const ranked = ["a", "b", "c", "d", "e"];
    const playedPairs: [string, string][] = [["a", "b"]];
    pairSwissRound({ ranked, playedPairs, hadBye: ["e"] });
    expect(ranked).toEqual(["a", "b", "c", "d", "e"]);
    expect(playedPairs).toEqual([["a", "b"]]);
  });

  it("is deterministic", () => {
    const input = {
      ranked: ["a", "b", "c", "d", "e"],
      playedPairs: [["a", "b"]] as [string, string][],
      hadBye: ["d"],
    };
    expect(pairSwissRound(input)).toEqual(pairSwissRound(input));
  });
});
