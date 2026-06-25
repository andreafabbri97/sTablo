import { describe, it, expect } from "vitest";
import {
  canConfirmMatch,
  canRejectMatch,
  canRecordScheduled,
  canCancelScheduled,
} from "./match-perms";
import type { ShapedMatch, ShapedSide } from "./queries";

function side(playerIds: string[]): ShapedSide {
  return {
    label: playerIds.join(" & "),
    teamName: null,
    players: playerIds.map((id) => ({
      id,
      name: id,
      slug: id,
      colorIndex: 0,
      imageUrl: null,
    })),
  };
}

function makeMatch(over: Partial<ShapedMatch> = {}): ShapedMatch {
  return {
    id: "m1",
    format: "singles",
    ranked: true,
    status: "pending",
    scoreA: null,
    scoreB: null,
    winner: null,
    playedAt: new Date("2024-01-01T00:00:00Z"),
    note: null,
    tournamentId: null,
    proposedById: "user-proposer",
    proposedSide: "A",
    confirmDeadline: new Date("2024-01-02T00:00:00Z"),
    sideA: side(["pA"]),
    sideB: side(["pB"]),
    ...over,
  };
}

const admin = { playerId: "pX", role: "admin" as const, userId: "user-admin" };
const opponent = { playerId: "pB", role: "player" as const, userId: "user-b" };
const proposerPlayer = {
  playerId: "pA",
  role: "player" as const,
  userId: "user-proposer",
};
const stranger = {
  playerId: "pZ",
  role: "player" as const,
  userId: "user-z",
};

describe("canConfirmMatch", () => {
  it("is false with no viewer", () => {
    expect(canConfirmMatch(makeMatch(), null)).toBe(false);
  });

  it("is false unless the match is pending", () => {
    expect(canConfirmMatch(makeMatch({ status: "scheduled" }), opponent)).toBe(
      false,
    );
    expect(canConfirmMatch(makeMatch({ status: "completed" }), opponent)).toBe(
      false,
    );
  });

  it("lets an admin confirm", () => {
    expect(canConfirmMatch(makeMatch(), admin)).toBe(true);
  });

  it("lets the opponent (the non-proposing side) confirm", () => {
    expect(canConfirmMatch(makeMatch({ proposedSide: "A" }), opponent)).toBe(
      true,
    );
  });

  it("does NOT let the proposer confirm their own result", () => {
    expect(
      canConfirmMatch(makeMatch({ proposedSide: "A" }), proposerPlayer),
    ).toBe(false);
  });

  it("is false for an unrelated player", () => {
    expect(canConfirmMatch(makeMatch(), stranger)).toBe(false);
  });

  it("is false for a player viewer with no linked player id", () => {
    expect(
      canConfirmMatch(makeMatch(), {
        playerId: null,
        role: "player",
      }),
    ).toBe(false);
  });
});

describe("canRejectMatch", () => {
  it("lets the proposer cancel their own proposal", () => {
    expect(canRejectMatch(makeMatch(), proposerPlayer)).toBe(true);
  });

  it("lets the opponent reject", () => {
    expect(canRejectMatch(makeMatch(), opponent)).toBe(true);
  });

  it("lets an admin reject", () => {
    expect(canRejectMatch(makeMatch(), admin)).toBe(true);
  });

  it("is false for an unrelated player", () => {
    expect(canRejectMatch(makeMatch(), stranger)).toBe(false);
  });

  it("is false when not pending", () => {
    expect(canRejectMatch(makeMatch({ status: "completed" }), opponent)).toBe(
      false,
    );
  });
});

describe("canRecordScheduled", () => {
  const scheduled = makeMatch({ status: "scheduled" });

  it("requires a scheduled match", () => {
    expect(canRecordScheduled(makeMatch({ status: "pending" }), opponent)).toBe(
      false,
    );
  });

  it("lets either participant record", () => {
    expect(canRecordScheduled(scheduled, proposerPlayer)).toBe(true);
    expect(canRecordScheduled(scheduled, opponent)).toBe(true);
  });

  it("lets an admin record", () => {
    expect(canRecordScheduled(scheduled, admin)).toBe(true);
  });

  it("is false for a non-participant", () => {
    expect(canRecordScheduled(scheduled, stranger)).toBe(false);
  });
});

describe("canCancelScheduled", () => {
  const scheduled = makeMatch({ status: "scheduled" });

  it("lets the creator cancel", () => {
    expect(canCancelScheduled(scheduled, proposerPlayer)).toBe(true);
  });

  it("lets a participant cancel", () => {
    expect(canCancelScheduled(scheduled, opponent)).toBe(true);
  });

  it("lets an admin cancel", () => {
    expect(canCancelScheduled(scheduled, admin)).toBe(true);
  });

  it("is false for an unrelated player", () => {
    expect(canCancelScheduled(scheduled, stranger)).toBe(false);
  });

  it("is false when not scheduled", () => {
    expect(
      canCancelScheduled(makeMatch({ status: "pending" }), proposerPlayer),
    ).toBe(false);
  });
});
