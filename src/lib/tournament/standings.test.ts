import { describe, it, expect } from "vitest";
import {
  computeStandings,
  computeAmericanoStandings,
  qualifiersFromGroups,
  type StandingEntrant,
  type StandingMatch,
} from "./standings";

const entrant = (
  id: string,
  seed: number,
  groupName: string | null = null,
): StandingEntrant => ({ id, name: id.toUpperCase(), groupName, seed });

/** A completed match; winner is derived from the score. */
const completed = (
  entrantAId: string | null,
  entrantBId: string | null,
  scoreA: number,
  scoreB: number,
  extra: Partial<StandingMatch> = {},
): StandingMatch => ({
  entrantAId,
  entrantBId,
  scoreA,
  scoreB,
  winner: scoreA > scoreB ? "A" : "B",
  status: "completed",
  stage: null,
  groupName: null,
  ...extra,
});

describe("computeStandings", () => {
  it("ranks a round-robin by points (3 per win)", () => {
    const entrants = [entrant("a", 1), entrant("b", 2), entrant("c", 3)];
    const matches = [
      completed("a", "b", 15, 10),
      completed("a", "c", 15, 8),
      completed("b", "c", 15, 12),
    ];
    const table = computeStandings(entrants, matches);
    expect(table.map((r) => r.entrant.id)).toEqual(["a", "b", "c"]);
    expect(table[0]).toMatchObject({
      played: 2,
      won: 2,
      lost: 0,
      points: 6,
      pointsFor: 30,
      pointsAgainst: 18,
      diff: 12,
    });
    expect(table[1]).toMatchObject({ won: 1, lost: 1, points: 3 });
    expect(table[2]).toMatchObject({ won: 0, lost: 2, points: 0 });
  });

  it("ignores matches that are not completed", () => {
    const entrants = [entrant("a", 1), entrant("b", 2)];
    const matches: StandingMatch[] = [
      { ...completed("a", "b", 15, 9), status: "scheduled", winner: null },
    ];
    const table = computeStandings(entrants, matches);
    expect(table.every((r) => r.played === 0)).toBe(true);
  });

  it("breaks ties on point difference when points are equal", () => {
    // a beats b, b beats c, c beats a → all 1-1 (3 pts); difference decides
    const entrants = [entrant("a", 1), entrant("b", 2), entrant("c", 3)];
    const matches = [
      completed("a", "b", 15, 5),
      completed("b", "c", 15, 13),
      completed("c", "a", 15, 14),
    ];
    const table = computeStandings(entrants, matches);
    expect(table.every((r) => r.points === 3)).toBe(true);
    expect(table.map((r) => r.entrant.id)).toEqual(["a", "c", "b"]); // diff +9, -1, -8
  });

  it("counts a bye (solo entrant, winner A) as a free win", () => {
    const entrants = [entrant("a", 1)];
    const matches: StandingMatch[] = [
      {
        entrantAId: "a",
        entrantBId: null,
        scoreA: 0,
        scoreB: 0,
        winner: "A",
        status: "completed",
        stage: null,
        groupName: null,
      },
    ];
    const table = computeStandings(entrants, matches);
    expect(table[0]).toMatchObject({ played: 1, won: 1, points: 3 });
  });

  it("filters by stage and group name", () => {
    const entrants = [entrant("a", 1, "A"), entrant("b", 2, "A"), entrant("c", 3, "B")];
    const matches = [
      completed("a", "b", 15, 10, { stage: "group", groupName: "A" }),
      completed("a", "c", 15, 9, { stage: "knockout" }),
    ];
    const table = computeStandings(entrants, matches, {
      groupName: "A",
      stages: ["group"],
    });
    expect([...table.map((r) => r.entrant.id)].sort()).toEqual(["a", "b"]); // c is group B
    expect(table.find((r) => r.entrant.id === "a")!.played).toBe(1); // knockout match excluded
  });
});

describe("computeAmericanoStandings", () => {
  const four = [
    { playerId: "p1", name: "P1" },
    { playerId: "p2", name: "P2" },
    { playerId: "p3", name: "P3" },
    { playerId: "p4", name: "P4" },
  ];

  it("accrues each player's own points from a single court", () => {
    const matches = [
      { id: "m1", scoreA: 15, scoreB: 11, winner: "A" as const, status: "completed" as const },
    ];
    const participants = [
      { matchId: "m1", side: "A" as const, playerId: "p1" },
      { matchId: "m1", side: "A" as const, playerId: "p2" },
      { matchId: "m1", side: "B" as const, playerId: "p3" },
      { matchId: "m1", side: "B" as const, playerId: "p4" },
    ];
    const table = computeAmericanoStandings(four, matches, participants);
    expect(table[0]).toMatchObject({
      played: 1,
      won: 1,
      pointsFor: 15,
      pointsAgainst: 11,
      diff: 4,
    });
    expect(table[3]).toMatchObject({ played: 1, lost: 1, pointsFor: 11, diff: -4 });
  });

  it("ranks by total points scored, summed across rotating games", () => {
    const matches = [
      { id: "m1", scoreA: 15, scoreB: 5, winner: "A" as const, status: "completed" as const },
      { id: "m2", scoreA: 10, scoreB: 15, winner: "B" as const, status: "completed" as const },
    ];
    const participants = [
      { matchId: "m1", side: "A" as const, playerId: "p1" },
      { matchId: "m1", side: "A" as const, playerId: "p2" },
      { matchId: "m1", side: "B" as const, playerId: "p3" },
      { matchId: "m1", side: "B" as const, playerId: "p4" },
      { matchId: "m2", side: "A" as const, playerId: "p1" },
      { matchId: "m2", side: "A" as const, playerId: "p3" },
      { matchId: "m2", side: "B" as const, playerId: "p2" },
      { matchId: "m2", side: "B" as const, playerId: "p4" },
    ];
    const table = computeAmericanoStandings(four, matches, participants);
    // pointsFor: p2=30, p1=25, p4=20, p3=15
    expect(table.map((r) => r.playerId)).toEqual(["p2", "p1", "p4", "p3"]);
    expect(table.find((r) => r.playerId === "p2")).toMatchObject({
      played: 2,
      won: 2,
      pointsFor: 30,
    });
  });

  it("skips matches that are not completed", () => {
    const matches = [
      { id: "m1", scoreA: null, scoreB: null, winner: null, status: "scheduled" as const },
    ];
    const participants = [
      { matchId: "m1", side: "A" as const, playerId: "p1" },
      { matchId: "m1", side: "B" as const, playerId: "p2" },
    ];
    const table = computeAmericanoStandings(four.slice(0, 2), matches, participants);
    expect(table.every((r) => r.played === 0)).toBe(true);
  });
});

describe("qualifiersFromGroups", () => {
  it("cross-seeds the top finishers from each group", () => {
    const entrants = [
      entrant("a1", 1, "A"),
      entrant("a2", 2, "A"),
      entrant("a3", 3, "A"),
      entrant("b1", 4, "B"),
      entrant("b2", 5, "B"),
      entrant("b3", 6, "B"),
    ];
    const g = (x: string, y: string, group: string) =>
      completed(x, y, 15, 8, { stage: "group", groupName: group });
    const matches = [
      g("a1", "a2", "A"),
      g("a1", "a3", "A"),
      g("a2", "a3", "A"),
      g("b1", "b2", "B"),
      g("b1", "b3", "B"),
      g("b2", "b3", "B"),
    ];
    const qualifiers = qualifiersFromGroups(entrants, matches, ["A", "B"], 2);
    expect(qualifiers).toEqual(["a1", "b1", "a2", "b2"]); // 1°A, 1°B, 2°A, 2°B
  });
});
