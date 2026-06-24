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
