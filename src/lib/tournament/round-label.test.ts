import { describe, it, expect } from "vitest";
import { tournamentRoundLabel } from "./round-label";

type Args = Parameters<typeof tournamentRoundLabel>[0];
const m = (over: Partial<Args>): Args => ({
  stage: null,
  groupName: null,
  round: null,
  note: null,
  ...over,
});

describe("tournamentRoundLabel", () => {
  it("returns null for a casual (non-tournament) match", () => {
    expect(tournamentRoundLabel(m({ stage: null, note: "che partita!" }))).toBeNull();
  });

  it("names a group by its letter", () => {
    expect(tournamentRoundLabel(m({ stage: "group", groupName: "A" }))).toBe("Girone A");
    expect(tournamentRoundLabel(m({ stage: "group", groupName: null }))).toBe("Gironi");
  });

  it("names a league day and a swiss round", () => {
    expect(tournamentRoundLabel(m({ stage: "league", round: 3 }))).toBe("Giornata 3");
    expect(tournamentRoundLabel(m({ stage: "swiss", round: 2 }))).toBe("Turno 2");
  });

  it("uses the stored note as the knockout round name", () => {
    expect(tournamentRoundLabel(m({ stage: "knockout", note: "Quarti", round: 2 }))).toBe("Quarti");
    expect(tournamentRoundLabel(m({ stage: "knockout", note: "Finale 3°/4°", round: 3 }))).toBe(
      "Finale 3°/4°",
    );
  });

  it("falls back to a generic knockout label when the note is missing", () => {
    expect(tournamentRoundLabel(m({ stage: "knockout", note: null }))).toBe("Fase finale");
    expect(tournamentRoundLabel(m({ stage: "knockout", note: "  " }))).toBe("Fase finale");
  });
});
