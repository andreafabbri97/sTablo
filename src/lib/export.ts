/**
 * Tiny, dependency-free CSV writer (RFC 4180). Pure and string-only so it can be
 * unit-tested without a database and reused by any export path. The caller maps
 * each row to columns; we handle quoting, escaping and the header line.
 */

export type CsvColumn<T> = {
  header: string;
  get: (row: T) => unknown;
};

/** Render one value as a CSV field, quoting/escaping only when required. */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";

  let s: string;
  if (value instanceof Date) s = value.toISOString();
  else if (typeof value === "object") s = JSON.stringify(value);
  else if (typeof value === "boolean") s = value ? "true" : "false";
  else s = String(value);

  // Quote when the field contains a delimiter, quote, or line break; escape
  // embedded quotes by doubling them.
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Build a full CSV document (header + rows) joined with CRLF per RFC 4180. */
export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const header = columns.map((c) => csvCell(c.header)).join(",");
  const lines = rows.map((row) =>
    columns.map((c) => csvCell(c.get(row))).join(","),
  );
  return [header, ...lines].join("\r\n");
}
