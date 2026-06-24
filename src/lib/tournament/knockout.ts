/**
 * Pure knockout-completion core (no IO).
 *
 * `maybeCompleteTournament` (tournament-actions.ts) uses this to decide whether
 * a knockout bracket has produced a champion. Keeping the "find the final and
 * read its winner" logic here makes it the single source of truth and unit-
 * testable — a wrong answer here would crown the wrong tournament winner.
 *
 * The grand final is the knockout match with the highest round that feeds into
 * no further match (`nextMatchId == null`). The 3rd/4th place play-off shares the
 * top round but is explicitly excluded so it can never be mistaken for the final.
 */

export const THIRD_PLACE_NOTE = "Finale 3°/4°";

export type KnockoutMatch = {
  entrantAId: string | null;
  entrantBId: string | null;
  winner: "A" | "B" | null;
  status: string;
  stage: string | null;
  round: number | null;
  nextMatchId: string | null;
  note: string | null;
};

export type KnockoutOutcome = {
  /** true once the grand final is played and a winner is known. */
  decided: boolean;
  /** Entrant id of the champion, or null when undecided. */
  winnerEntrantId: string | null;
};

const UNDECIDED: KnockoutOutcome = { decided: false, winnerEntrantId: null };

/**
 * Decide whether a groups+knockout tournament is ready to spawn its knockout
 * bracket: every group match must be completed and the bracket must not already
 * exist. (The caller still bails later if fewer than 2 entrants qualify.)
 */
export function shouldGenerateKnockout(
  matches: Pick<KnockoutMatch, "stage" | "status">[],
): boolean {
  const groupMatches = matches.filter((m) => m.stage === "group");
  const knockoutExists = matches.some((m) => m.stage === "knockout");
  if (knockoutExists) return false;
  if (groupMatches.some((m) => m.status !== "completed")) return false;
  return true;
}

export function knockoutFinalWinner(matches: KnockoutMatch[]): KnockoutOutcome {
  // The 3rd/4th place play-off shares the final round but is not the final.
  const knockout = matches.filter(
    (m) => m.stage === "knockout" && m.note !== THIRD_PLACE_NOTE,
  );
  if (knockout.length === 0) return UNDECIDED;

  const maxRound = Math.max(...knockout.map((m) => m.round ?? 0));
  const final = knockout.find((m) => m.round === maxRound && !m.nextMatchId);
  if (!final || final.status !== "completed") return UNDECIDED;

  const winnerEntrantId =
    final.winner === "A" ? final.entrantAId : final.entrantBId;
  return { decided: true, winnerEntrantId };
}
