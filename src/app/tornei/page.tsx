import type { Metadata } from "next";
import { Swords } from "lucide-react";
import { cacheLife, cacheTag } from "next/cache";
import { PageHeader } from "@/components/ui/page";
import {
  TournamentsExplorer,
  type TournamentCardData,
} from "@/components/tournaments-explorer";
import { TorneiActions } from "@/components/tornei-actions";
import { getTournaments } from "@/lib/tournament/queries";
import { toTournamentCard } from "@/lib/tournament/cards";
import { DATA_TAG } from "@/lib/cache";
import { safe } from "@/lib/safe";

export const metadata: Metadata = { title: "Tornei" };

export default function TorneiPage() {
  return <TorneiContent />;
}

/**
 * Cached shell of PUBLIC tournaments (global) so the grid paints instantly. The
 * viewer's private tournaments and «Amici» flags are merged client-side inside
 * <TournamentsExplorer> (see viewerTournaments) — private ones must never be in
 * the shared cache. Invalidated by bustDataCache (revalidateTag on DATA_TAG).
 */
async function TorneiContent() {
  "use cache";
  cacheTag(DATA_TAG);
  cacheLife("hours");

  const all = await safe(() => getTournaments(), []);
  const publicCards: TournamentCardData[] = all
    .filter((t) => t.visibility !== "private")
    .map((t) => toTournamentCard(t));

  return (
    <div>
      <PageHeader
        icon={<Swords className="h-6 w-6" />}
        title="Tornei"
        subtitle="Campionati, gironi e tabelloni"
        action={<TorneiActions />}
        help="tornei"
      />
      <TournamentsExplorer tournaments={publicCards} />
    </div>
  );
}
