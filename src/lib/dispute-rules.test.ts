import { describe, it, expect } from "vitest";
import {
  canAutoConfirm,
  normalizeDisputeReason,
  MAX_DISPUTE_REASON,
  DISPUTE_REASON_FALLBACK,
} from "./dispute-rules";

describe("canAutoConfirm", () => {
  it("never auto-confirms a contested result, ranked or not", () => {
    expect(
      canAutoConfirm({ ranked: true, disputed: true, hasPriorMeeting: true }),
    ).toBe(false);
    expect(
      canAutoConfirm({ ranked: false, disputed: true, hasPriorMeeting: true }),
    ).toBe(false);
  });

  it("auto-confirms friendly (non-ranked) matches even with no prior meeting", () => {
    expect(
      canAutoConfirm({ ranked: false, disputed: false, hasPriorMeeting: false }),
    ).toBe(true);
  });

  it("auto-confirms a ranked match between sides that have played before", () => {
    expect(
      canAutoConfirm({ ranked: true, disputed: false, hasPriorMeeting: true }),
    ).toBe(true);
  });

  it("blocks auto-confirm for a fabricated ranked FIRST encounter", () => {
    expect(
      canAutoConfirm({ ranked: true, disputed: false, hasPriorMeeting: false }),
    ).toBe(false);
  });
});

describe("normalizeDisputeReason", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeDisputeReason("  punteggio sbagliato  ")).toBe(
      "punteggio sbagliato",
    );
  });

  it("falls back when empty / whitespace / nullish", () => {
    expect(normalizeDisputeReason("")).toBe(DISPUTE_REASON_FALLBACK);
    expect(normalizeDisputeReason("   ")).toBe(DISPUTE_REASON_FALLBACK);
    expect(normalizeDisputeReason(null)).toBe(DISPUTE_REASON_FALLBACK);
    expect(normalizeDisputeReason(undefined)).toBe(DISPUTE_REASON_FALLBACK);
  });

  it("clamps to the max length", () => {
    const long = "x".repeat(MAX_DISPUTE_REASON + 50);
    expect(normalizeDisputeReason(long)).toHaveLength(MAX_DISPUTE_REASON);
  });
});
