import { asc, desc } from "drizzle-orm";
import { db } from "./db";
import {
  players,
  teams,
  matches,
  matchParticipants,
  tournaments,
  tournamentEntrants,
  users,
} from "./db/schema";
import { shapeMatch, matchWith } from "./queries";
import { toCsv, type CsvColumn } from "./export";

/**
 * Admin data export. Pulls the competitive dataset and renders it as CSV (one
 * flat sheet per entity) or a single JSON backup. Admin-gated at the route.
 *
 * SECURITY: never emit secrets. The users table is exported WITHOUT
 * `passwordHash`, and push-subscription keys are excluded entirely.
 */

export const EXPORT_DATASETS = ["players", "matches", "tournaments", "all"] as const;
export type ExportDataset = (typeof EXPORT_DATASETS)[number];

export const EXPORT_FORMATS = ["csv", "json"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export type ExportFile = {
  filename: string;
  contentType: string;
  body: string;
};

export function isExportDataset(v: string): v is ExportDataset {
  return (EXPORT_DATASETS as readonly string[]).includes(v);
}

export function isExportFormat(v: string): v is ExportFormat {
  return (EXPORT_FORMATS as readonly string[]).includes(v);
}

function stamp(date: Date): string {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

/* ----------------------------------------------------------------------------
   CSV builders — one flat sheet per entity.
---------------------------------------------------------------------------- */

async function playersCsv(): Promise<string> {
  const rows = await db.select().from(players).orderBy(asc(players.name));
  const cols: CsvColumn<(typeof rows)[number]>[] = [
    { header: "id", get: (p) => p.id },
    { header: "nome", get: (p) => p.name },
    { header: "soprannome", get: (p) => p.nickname },
    { header: "slug", get: (p) => p.slug },
    { header: "elo_singolo", get: (p) => p.eloSingles },
    { header: "elo_doppio", get: (p) => p.eloDoubles },
    { header: "picco_elo", get: (p) => p.peakElo },
    { header: "attivo", get: (p) => p.active },
    { header: "stats_pubbliche", get: (p) => p.statsPublic },
    { header: "creato_il", get: (p) => p.createdAt },
  ];
  return toCsv(rows, cols);
}

async function matchesCsv(): Promise<string> {
  const rows = await db.query.matches.findMany({
    orderBy: [desc(matches.playedAt)],
    with: matchWith,
  });
  const shaped = rows.map(shapeMatch);
  const cols: CsvColumn<(typeof shaped)[number]>[] = [
    { header: "id", get: (m) => m.id },
    { header: "giocata_il", get: (m) => m.playedAt },
    { header: "formato", get: (m) => m.format },
    { header: "stato", get: (m) => m.status },
    { header: "classificata", get: (m) => m.ranked },
    { header: "lato_a", get: (m) => m.sideA.label },
    { header: "lato_b", get: (m) => m.sideB.label },
    { header: "punti_a", get: (m) => m.scoreA },
    { header: "punti_b", get: (m) => m.scoreB },
    {
      header: "vincitore",
      get: (m) =>
        m.winner === "A" ? m.sideA.label : m.winner === "B" ? m.sideB.label : "",
    },
    { header: "torneo_id", get: (m) => m.tournamentId },
    { header: "nota", get: (m) => m.note },
  ];
  return toCsv(shaped, cols);
}

async function tournamentsCsv(): Promise<string> {
  const rows = await db
    .select()
    .from(tournaments)
    .orderBy(desc(tournaments.createdAt));
  const cols: CsvColumn<(typeof rows)[number]>[] = [
    { header: "id", get: (t) => t.id },
    { header: "nome", get: (t) => t.name },
    { header: "slug", get: (t) => t.slug },
    { header: "formato", get: (t) => t.format },
    { header: "disciplina", get: (t) => t.discipline },
    { header: "stato", get: (t) => t.status },
    { header: "round_corrente", get: (t) => t.currentRound },
    { header: "creato_il", get: (t) => t.createdAt },
    { header: "iniziato_il", get: (t) => t.startedAt },
    { header: "completato_il", get: (t) => t.completedAt },
  ];
  return toCsv(rows, cols);
}

/* ----------------------------------------------------------------------------
   Full JSON backup — raw rows of the competitive dataset, secrets stripped.
---------------------------------------------------------------------------- */

async function fullBackup(now: Date): Promise<string> {
  const [pl, tm, mt, mp, tr, te, us] = await Promise.all([
    db.select().from(players),
    db.select().from(teams),
    db.select().from(matches),
    db.select().from(matchParticipants),
    db.select().from(tournaments),
    db.select().from(tournamentEntrants),
    // Accounts WITHOUT the password hash — never export credentials.
    db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        name: users.name,
        role: users.role,
        playerId: users.playerId,
        createdAt: users.createdAt,
      })
      .from(users),
  ]);

  const backup = {
    app: "sTablo",
    exportedAt: now.toISOString(),
    counts: {
      players: pl.length,
      teams: tm.length,
      matches: mt.length,
      matchParticipants: mp.length,
      tournaments: tr.length,
      tournamentEntrants: te.length,
      users: us.length,
    },
    players: pl,
    teams: tm,
    matches: mt,
    matchParticipants: mp,
    tournaments: tr,
    tournamentEntrants: te,
    users: us,
  };
  return JSON.stringify(backup, null, 2);
}

/* ----------------------------------------------------------------------------
   Dispatcher.
---------------------------------------------------------------------------- */

/** Valid format(s) per dataset — `all` is a JSON-only backup. */
export function formatsFor(dataset: ExportDataset): ExportFormat[] {
  return dataset === "all" ? ["json"] : ["csv"];
}

export async function buildExport(
  dataset: ExportDataset,
  format: ExportFormat,
  now: Date,
): Promise<ExportFile> {
  const date = stamp(now);

  if (format === "csv") {
    const body =
      dataset === "players"
        ? await playersCsv()
        : dataset === "matches"
          ? await matchesCsv()
          : dataset === "tournaments"
            ? await tournamentsCsv()
            : // `all` has no CSV form.
              await playersCsv();
    return {
      filename: `stablo-${dataset}-${date}.csv`,
      contentType: "text/csv; charset=utf-8",
      body,
    };
  }

  // JSON: `all` is the full backup; single datasets aren't exposed as JSON yet
  // but we keep the path total by falling back to the full backup.
  const body = await fullBackup(now);
  return {
    filename: `stablo-backup-${date}.json`,
    contentType: "application/json; charset=utf-8",
    body,
  };
}
