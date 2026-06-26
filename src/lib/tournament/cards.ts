import {
  FORMAT_META,
  DISCIPLINE_LABEL,
  getTournaments,
} from "@/lib/tournament/queries";
import type { TournamentCardData } from "@/components/tournaments-explorer";

/** One row as returned by getTournaments (tournament + entrantCount). */
export type TournamentListItem = Awaited<
  ReturnType<typeof getTournaments>
>[number];

const STATUS: Record<
  string,
  { label: string; tone: "win" | "brand" | "muted" | "ball" }
> = {
  active: { label: "In corso", tone: "win" },
  completed: { label: "Concluso", tone: "muted" },
  draft: { label: "⏳ In attesa", tone: "ball" },
};

/**
 * Shape a tournament row into the serializable card the client grid renders.
 * Shared by the cached public list (page) and the per-viewer overlay action so
 * the two never drift. `hasFriend` is viewer-specific and defaults to false.
 */
export function toTournamentCard(
  t: TournamentListItem,
  hasFriend = false,
): TournamentCardData {
  const meta = FORMAT_META[t.format];
  const status = STATUS[t.status] ?? STATUS.draft;
  return {
    id: t.id,
    slug: t.slug,
    name: t.name,
    formatEmoji: meta?.emoji ?? "🎯",
    formatLabel: meta?.label ?? t.format,
    disciplineLabel: DISCIPLINE_LABEL[t.discipline] ?? t.discipline,
    entrantCount: t.entrantCount,
    statusLabel: status.label,
    statusTone: status.tone,
    isPrivate: t.visibility === "private",
    showWinner: t.status === "completed" && !!t.winnerEntrantId,
    hasFriend,
  };
}
