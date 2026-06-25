import type { ShapedMatch } from "@/lib/queries";

/**
 * Human label for where a match sits inside its tournament — e.g. "Girone A",
 * "Giornata 3", "Turno 2", "Quarti", "Finale". Returns null for casual
 * (non-tournament) matches.
 *
 * Pure on purpose: the knockout round name is already persisted in the match's
 * `note` (the generator writes "Quarti"/"Semifinali"/"Finale"/"Finale 3°/4°"
 * there), so no extra query or bracket math is needed.
 */
export function tournamentRoundLabel(
  match: Pick<ShapedMatch, "stage" | "groupName" | "round" | "note">,
): string | null {
  switch (match.stage) {
    case "group":
      return match.groupName ? `Girone ${match.groupName}` : "Gironi";
    case "league":
      return match.round ? `Giornata ${match.round}` : null;
    case "swiss":
      return match.round ? `Turno ${match.round}` : null;
    case "knockout":
      return match.note?.trim() || "Fase finale";
    default:
      return null;
  }
}
