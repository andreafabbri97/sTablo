import { describe, it, expect } from "vitest";
import { csvCell, toCsv } from "./export";

describe("csvCell", () => {
  it("renders empty for null/undefined", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("passes through plain strings and numbers untouched", () => {
    expect(csvCell("ciao")).toBe("ciao");
    expect(csvCell(42)).toBe("42");
    expect(csvCell(0)).toBe("0");
  });

  it("renders booleans as true/false", () => {
    expect(csvCell(true)).toBe("true");
    expect(csvCell(false)).toBe("false");
  });

  it("quotes fields containing a comma", () => {
    expect(csvCell("Rossi, Mario")).toBe('"Rossi, Mario"');
  });

  it("quotes and doubles embedded quotes", () => {
    expect(csvCell('lui ha detto "ciao"')).toBe('"lui ha detto ""ciao"""');
  });

  it("quotes fields with newlines or carriage returns", () => {
    expect(csvCell("riga1\nriga2")).toBe('"riga1\nriga2"');
    expect(csvCell("a\r\nb")).toBe('"a\r\nb"');
  });

  it("serializes Date as ISO and objects as JSON", () => {
    expect(csvCell(new Date("2026-06-25T10:00:00.000Z"))).toBe(
      "2026-06-25T10:00:00.000Z",
    );
    // JSON has quotes/commas, so it gets wrapped.
    expect(csvCell({ a: 1, b: 2 })).toBe('"{""a"":1,""b"":2}"');
  });
});

describe("toCsv", () => {
  type Row = { name: string; elo: number };
  const cols = [
    { header: "Nome", get: (r: Row) => r.name },
    { header: "Elo", get: (r: Row) => r.elo },
  ];

  it("emits a header row even with no data", () => {
    expect(toCsv([], cols)).toBe("Nome,Elo");
  });

  it("joins rows with CRLF and escapes per cell", () => {
    const out = toCsv(
      [
        { name: "Mario", elo: 1200 },
        { name: "Rossi, L.", elo: 1100 },
      ],
      cols,
    );
    expect(out).toBe('Nome,Elo\r\nMario,1200\r\n"Rossi, L.",1100');
  });
});
