import { describe, it, expect } from "vitest";
import { replayElo, type ReplayMatch } from "./elo-replay";

const START = 1000;

const singles = (
  id: string,
  pA: string,
  pB: string,
  scoreA: number,
  scoreB: number,
): ReplayMatch => ({
  id,
  format: "singles",
  scoreA,
  scoreB,
  participants: [
    { id: `${id}-a`, side: "A", playerId: pA, teamId: null },
    { id: `${id}-b`, side: "B", playerId: pB, teamId: null },
  ],
});

describe("replayElo — singles", () => {
  it("applies a single ranked result (zero-sum, peak tracked)", () => {
    const result = replayElo({
      playerIds: ["p1", "p2"],
      teamIds: [],
      matches: [singles("m1", "p1", "p2", 15, 10)],
      startingElo: START,
    });

    // margin 5 at equal ratings → delta 29
    expect(result.players.get("p1")).toEqual({
      eloSingles: 1029,
      eloDoubles: 1000,
      peak: 1029,
    });
    expect(result.players.get("p2")).toEqual({
      eloSingles: 971,
      eloDoubles: 1000,
      peak: 1000, // loser dropped, peak stays at the start
    });

    expect(result.history).toEqual([
      { subject: "player_singles", subjectId: "p1", matchId: "m1", elo: 1029, delta: 29 },
      { subject: "player_singles", subjectId: "p2", matchId: "m1", elo: 971, delta: -29 },
    ]);
    expect(result.participantRatings).toEqual([
      { participantId: "m1-a", ratingBefore: 1000, ratingAfter: 1029 },
      { participantId: "m1-b", ratingBefore: 1000, ratingAfter: 971 },
    ]);
  });

  it("replays chronologically — match 2 uses ratings after match 1", () => {
    const result = replayElo({
      playerIds: ["p1", "p2"],
      teamIds: [],
      matches: [
        singles("m1", "p1", "p2", 15, 10), // p1: 1029, p2: 971
        singles("m2", "p2", "p1", 15, 10), // underdog p2 wins → +34
      ],
      startingElo: START,
    });

    expect(result.players.get("p1")!.eloSingles).toBe(995); // 1029 - 34
    expect(result.players.get("p2")!.eloSingles).toBe(1005); // 971 + 34
    // p1 peaked at 1029 in match 1, then fell — the peak is retained
    expect(result.players.get("p1")!.peak).toBe(1029);
    expect(result.players.get("p2")!.peak).toBe(1005);
  });

  it("leaves the doubles rating untouched for a singles match", () => {
    const result = replayElo({
      playerIds: ["p1", "p2"],
      teamIds: [],
      matches: [singles("m1", "p1", "p2", 15, 10)],
      startingElo: START,
    });
    expect(result.players.get("p1")!.eloDoubles).toBe(1000);
    expect(result.players.get("p2")!.eloDoubles).toBe(1000);
  });
});

describe("replayElo — doubles with a registered team", () => {
  const doublesMatch: ReplayMatch = {
    id: "d1",
    format: "doubles",
    scoreA: 15,
    scoreB: 8,
    participants: [
      { id: "d1-a1", side: "A", playerId: "p1", teamId: "t1" },
      { id: "d1-a2", side: "A", playerId: "p2", teamId: "t1" },
      { id: "d1-b1", side: "B", playerId: "p3", teamId: null },
      { id: "d1-b2", side: "B", playerId: "p4", teamId: null },
    ],
  };

  it("updates both players' doubles Elo and the team Elo", () => {
    const result = replayElo({
      playerIds: ["p1", "p2", "p3", "p4"],
      teamIds: ["t1"],
      matches: [doublesMatch],
      startingElo: START,
    });

    // margin 7 at equal side ratings → delta 33
    expect(result.players.get("p1")!.eloDoubles).toBe(1033);
    expect(result.players.get("p2")!.eloDoubles).toBe(1033);
    expect(result.players.get("p3")!.eloDoubles).toBe(967);
    expect(result.players.get("p4")!.eloDoubles).toBe(967);
    // singles untouched
    expect(result.players.get("p1")!.eloSingles).toBe(1000);

    // registered team on side A gains; side B had no team
    expect(result.teams.get("t1")).toEqual({ eloDoubles: 1033, peak: 1033 });

    const teamEntries = result.history.filter((h) => h.subject === "team");
    expect(teamEntries).toEqual([
      { subject: "team", subjectId: "t1", matchId: "d1", elo: 1033, delta: 33 },
    ]);
  });

  it("emits 4 player rows + 1 team row of history", () => {
    const result = replayElo({
      playerIds: ["p1", "p2", "p3", "p4"],
      teamIds: ["t1"],
      matches: [doublesMatch],
      startingElo: START,
    });
    expect(result.history).toHaveLength(5);
    expect(result.history.filter((h) => h.subject === "player_doubles")).toHaveLength(4);
    expect(result.participantRatings).toHaveLength(4);
  });

  it("ad-hoc doubles (no team) produce no team history", () => {
    const adHoc: ReplayMatch = {
      ...doublesMatch,
      participants: doublesMatch.participants.map((p) => ({ ...p, teamId: null })),
    };
    const result = replayElo({
      playerIds: ["p1", "p2", "p3", "p4"],
      teamIds: [],
      matches: [adHoc],
      startingElo: START,
    });
    expect(result.teams.size).toBe(0);
    expect(result.history.every((h) => h.subject === "player_doubles")).toBe(true);
  });
});

describe("replayElo — guards & determinism", () => {
  it("skips matches with a null score", () => {
    const result = replayElo({
      playerIds: ["p1", "p2"],
      teamIds: [],
      matches: [
        {
          id: "m1",
          format: "singles",
          scoreA: null,
          scoreB: 5,
          participants: [
            { id: "x", side: "A", playerId: "p1", teamId: null },
            { id: "y", side: "B", playerId: "p2", teamId: null },
          ],
        },
      ],
      startingElo: START,
    });
    expect(result.history).toHaveLength(0);
    expect(result.players.get("p1")!.eloSingles).toBe(1000);
  });

  it("skips matches missing a whole side", () => {
    const result = replayElo({
      playerIds: ["p1", "p2"],
      teamIds: [],
      matches: [
        {
          id: "m1",
          format: "singles",
          scoreA: 15,
          scoreB: 10,
          participants: [{ id: "x", side: "A", playerId: "p1", teamId: null }],
        },
      ],
      startingElo: START,
    });
    expect(result.history).toHaveLength(0);
    expect(result.players.get("p1")!.eloSingles).toBe(1000);
  });

  it("is deterministic — same input yields the same ratings", () => {
    const input = {
      playerIds: ["p1", "p2"],
      teamIds: [],
      matches: [singles("m1", "p1", "p2", 15, 10)],
      startingElo: START,
    };
    const a = replayElo(input);
    const b = replayElo(input);
    expect(b.players.get("p1")).toEqual(a.players.get("p1"));
    expect(input.matches).toHaveLength(1); // input not mutated
  });
});
