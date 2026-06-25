import { describe, it, expect } from "vitest";
import { makeSeason, seasonForDate, previousSeason } from "./seasons";

describe("makeSeason — month boundaries and label", () => {
  it("spans exactly one month, end exclusive", () => {
    const s = makeSeason(2026, 6); // giugno 2026
    expect(s.year).toBe(2026);
    expect(s.month).toBe(6);
    expect(s.label).toBe("giugno 2026");
    expect(s.start).toEqual(new Date(2026, 5, 1, 0, 0, 0, 0));
    expect(s.end).toEqual(new Date(2026, 6, 1, 0, 0, 0, 0));
  });

  it("labels every month in Italian", () => {
    expect(makeSeason(2026, 1).label).toBe("gennaio 2026");
    expect(makeSeason(2026, 12).label).toBe("dicembre 2026");
  });

  it("December's end rolls into the next year", () => {
    const s = makeSeason(2026, 12);
    expect(s.end).toEqual(new Date(2027, 0, 1, 0, 0, 0, 0));
  });
});

describe("seasonForDate — the month a date lands in", () => {
  it("maps a mid-month date to that month", () => {
    const s = seasonForDate(new Date(2026, 5, 24, 18, 30));
    expect(s.month).toBe(6);
    expect(s.year).toBe(2026);
  });

  it("includes the first instant of the month", () => {
    const s = seasonForDate(new Date(2026, 5, 1, 0, 0, 0, 0));
    expect(s.start).toEqual(new Date(2026, 5, 1, 0, 0, 0, 0));
    expect(s.month).toBe(6);
  });

  it("the last instant before the next month still belongs to this month", () => {
    const s = seasonForDate(new Date(2026, 5, 30, 23, 59, 59, 999));
    expect(s.month).toBe(6);
  });
});

describe("previousSeason — rolls back one month", () => {
  it("steps back within the same year", () => {
    const prev = previousSeason(makeSeason(2026, 6));
    expect(prev.month).toBe(5);
    expect(prev.year).toBe(2026);
    expect(prev.label).toBe("maggio 2026");
  });

  it("rolls the year over from January to December", () => {
    const prev = previousSeason(makeSeason(2026, 1));
    expect(prev.month).toBe(12);
    expect(prev.year).toBe(2025);
    expect(prev.label).toBe("dicembre 2025");
  });

  it("the previous season ends exactly where the current one starts", () => {
    const current = makeSeason(2026, 3);
    const prev = previousSeason(current);
    expect(prev.end).toEqual(current.start);
  });
});
