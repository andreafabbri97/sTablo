import { describe, it, expect } from "vitest";
import { tallyHeadToHead, type H2HPlayer } from "./h2h";
import type { ShapedMatch, ShapedSide } from "./queries";

const A: H2HPlayer = {
  id: "a",
  name: "Andrea",
  slug: "andrea",
  avatarColor: 0,
  avatarUrl: null,
};
const B: H2HPlayer = {
  id: "b",
  name: "Bruno",
  slug: "bruno",
  avatarColor: 1,
  avatarUrl: null,
};
function side(...ids: string[]): ShapedSide {
  return {
    label: ids.join(" & "),
    teamName: null,
    players: ids.map((id) => ({
      id,
      name: id,
      slug: id,
      colorIndex: 0,
      imageUrl: null,
    })),
  };
}

function match(opts: {
  id?: string;
  format?: "singles" | "doubles";
  status?: ShapedMatch["status"];
  sideA: string[];
  sideB: string[];
  scoreA: number;
  scoreB: number;
}): ShapedMatch {
  const { scoreA, scoreB } = opts;
  return {
    id: opts.id ?? Math.random().toString(36).slice(2),
    format: opts.format ?? "singles",
    ranked: true,
    status: opts.status ?? "completed",
    scoreA,
    scoreB,
    winner: scoreA > scoreB ? "A" : "B",
    playedAt: new Date(0),
    note: null,
    tournamentId: null,
    proposedById: null,
    proposedSide: null,
    confirmDeadline: null,
    sideA: side(...opts.sideA),
    sideB: side(...opts.sideB),
  };
}

describe("tallyHeadToHead", () => {
  it("counts a singles win for A regardless of which side A sat on", () => {
    const r = tallyHeadToHead(A, B, [
      match({ sideA: ["a"], sideB: ["b"], scoreA: 15, scoreB: 10 }),
      // A on side B this time, still wins
      match({ sideA: ["b"], sideB: ["a"], scoreA: 9, scoreB: 15 }),
    ]);
    expect(r.total).toBe(2);
    expect(r.aWins).toBe(2);
    expect(r.bWins).toBe(0);
    expect(r.aPoints).toBe(30); // 15 + 15
    expect(r.bPoints).toBe(19); // 10 + 9
    expect(r.singles).toEqual({ total: 2, aWins: 2, bWins: 0 });
    expect(r.doubles).toEqual({ total: 0, aWins: 0, bWins: 0 });
  });

  it("splits records per format and tracks B wins", () => {
    const r = tallyHeadToHead(A, B, [
      match({ sideA: ["a"], sideB: ["b"], scoreA: 15, scoreB: 8 }), // A wins singles
      match({
        format: "doubles",
        sideA: ["a", "c"],
        sideB: ["b", "d"],
        scoreA: 12,
        scoreB: 15,
      }), // B wins doubles (opponents)
    ]);
    expect(r.total).toBe(2);
    expect(r.aWins).toBe(1);
    expect(r.bWins).toBe(1);
    expect(r.singles).toEqual({ total: 1, aWins: 1, bWins: 0 });
    expect(r.doubles).toEqual({ total: 1, aWins: 0, bWins: 1 });
  });

  it("counts 2v2 encounters whenever A and B faced off, regardless of partners", () => {
    const r = tallyHeadToHead(A, B, [
      // Same opponents, different partners each time — all are direct meetings.
      match({
        format: "doubles",
        sideA: ["a", "c"],
        sideB: ["b", "d"],
        scoreA: 15,
        scoreB: 9,
      }),
      match({
        format: "doubles",
        sideA: ["a", "e"],
        sideB: ["b", "f"],
        scoreA: 11,
        scoreB: 15,
      }),
      // A on the other side, partnered with someone else again — still counts.
      match({
        format: "doubles",
        sideA: ["b", "g"],
        sideB: ["a", "h"],
        scoreA: 8,
        scoreB: 15,
      }),
    ]);
    expect(r.total).toBe(3);
    expect(r.doubles).toEqual({ total: 3, aWins: 2, bWins: 1 });
    expect(r.singles).toEqual({ total: 0, aWins: 0, bWins: 0 });
    expect(r.aWins).toBe(2);
    expect(r.bWins).toBe(1);
  });

  it("excludes matches where A and B were partners (same side)", () => {
    const r = tallyHeadToHead(A, B, [
      match({
        format: "doubles",
        sideA: ["a", "b"],
        sideB: ["c", "d"],
        scoreA: 15,
        scoreB: 11,
      }),
    ]);
    expect(r.total).toBe(0);
  });

  it("excludes non-completed and non-mutual matches", () => {
    const r = tallyHeadToHead(A, B, [
      match({
        status: "pending",
        sideA: ["a"],
        sideB: ["b"],
        scoreA: 15,
        scoreB: 0,
      }),
      // B not present
      match({ sideA: ["a"], sideB: ["c"], scoreA: 15, scoreB: 3 }),
    ]);
    expect(r.total).toBe(0);
  });

  it("returns an empty record when there are no matches", () => {
    const r = tallyHeadToHead(A, B, []);
    expect(r).toMatchObject({
      total: 0,
      aWins: 0,
      bWins: 0,
      aPoints: 0,
      bPoints: 0,
    });
    expect(r.matches).toEqual([]);
  });
});
