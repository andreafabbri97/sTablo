import type { ShapedMatch } from "./queries";

/** Whether a viewer may confirm a pending result (opponent side or admin). */
export function canConfirmMatch(
  match: ShapedMatch,
  viewer: { playerId: string | null; role: "admin" | "player" } | null,
): boolean {
  if (!viewer || match.status !== "pending") return false;
  if (viewer.role === "admin") return true;
  if (!viewer.playerId) return false;
  const opposite = match.proposedSide === "A" ? "B" : "A";
  const side = opposite === "A" ? match.sideA : match.sideB;
  return side.players.some((p) => p.id === viewer.playerId);
}

/** Whether a viewer may cancel a pending proposal (opponent, proposer, admin). */
export function canRejectMatch(
  match: ShapedMatch,
  viewer: { playerId: string | null; role: "admin" | "player"; userId: string } | null,
): boolean {
  if (!viewer || match.status !== "pending") return false;
  if (viewer.role === "admin") return true;
  if (match.proposedById === viewer.userId) return true;
  return canConfirmMatch(match, viewer);
}

/** True when the player takes part in either side of a match. */
function isParticipant(match: ShapedMatch, playerId: string | null): boolean {
  if (!playerId) return false;
  return [...match.sideA.players, ...match.sideB.players].some(
    (p) => p.id === playerId,
  );
}

/** Whether a viewer may record the result of a scheduled challenge. */
export function canRecordScheduled(
  match: ShapedMatch,
  viewer: { playerId: string | null; role: "admin" | "player" } | null,
): boolean {
  if (!viewer || match.status !== "scheduled") return false;
  if (viewer.role === "admin") return true;
  return isParticipant(match, viewer.playerId);
}

/** Whether a viewer may cancel a scheduled challenge (creator, player, admin). */
export function canCancelScheduled(
  match: ShapedMatch,
  viewer: { playerId: string | null; role: "admin" | "player"; userId: string } | null,
): boolean {
  if (!viewer || match.status !== "scheduled") return false;
  if (viewer.role === "admin") return true;
  if (match.proposedById === viewer.userId) return true;
  return isParticipant(match, viewer.playerId);
}
