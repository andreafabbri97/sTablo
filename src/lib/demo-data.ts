/**
 * Demo match fixtures — pure data, no IO.
 *
 * Kept separate from demo.ts (which talks to the DB) so the scores can be unit-
 * tested in isolation against the tavolino rule. Both the seed and the admin
 * "Rigenera demo" control insert exactly this set, via demo.ts.
 *
 * Tavolino: si vince a 15; sul 14-14 si va ai vantaggi (scarto 2); killer point
 * sul 19-19 → 20-19 è il massimo. OGNI punteggio qui DEVE superare
 * validateTavolinoScore — demo-data.test.ts lo dimostra, e insertDemoMatches lo
 * verifica a runtime prima di scrivere sul DB.
 */
export type DemoSingle = [string, string, number, number, boolean];
export type DemoDouble = [[string, string], [string, string], number, number, boolean];

export const DEMO_SINGLES: DemoSingle[] = [
  ["mesh", "bernu", 15, 11, true],
  ["edo", "toro", 15, 13, true],
  ["dadda", "pau", 13, 15, true],
  ["jaco", "mesh", 17, 15, true], // ai vantaggi
  ["bernu", "edo", 15, 9, true],
  ["toro", "dadda", 13, 15, false],
  ["pau", "jaco", 15, 12, false],
  ["mesh", "edo", 15, 10, false],
  ["bernu", "pau", 11, 15, false],
  ["dadda", "jaco", 20, 19, false], // killer point
];

export const DEMO_DOUBLES: DemoDouble[] = [
  [["mesh", "bernu"], ["edo", "toro"], 15, 13, true],
  [["dadda", "pau"], ["jaco", "mesh"], 15, 17, true], // ai vantaggi
  [["bernu", "edo"], ["toro", "dadda"], 15, 9, true],
  [["pau", "jaco"], ["mesh", "edo"], 15, 11, true],
  [["toro", "bernu"], ["dadda", "jaco"], 13, 15, true],
  [["mesh", "toro"], ["edo", "pau"], 15, 11, false],
  [["bernu", "jaco"], ["dadda", "mesh"], 16, 14, false], // ai vantaggi
  [["edo", "dadda"], ["pau", "toro"], 13, 15, false],
  [["jaco", "bernu"], ["mesh", "pau"], 15, 7, false],
  [["toro", "edo"], ["dadda", "bernu"], 20, 19, false], // killer point
];

export const DEMO_TOTAL = DEMO_SINGLES.length + DEMO_DOUBLES.length;
