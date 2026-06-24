import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { Swords, Trophy, QrCode, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { StandingsTable } from "@/components/tournament/standings-table";
import { Bracket } from "@/components/tournament/bracket";
import { MatchRow } from "@/components/tournament/match-row";
import { SwissControls } from "@/components/tournament/swiss-controls";
import { DeleteTournamentButton } from "@/components/admin/delete-tournament-button";
import { ProfileQr } from "@/components/friends/profile-qr";
import { ShareButton } from "@/components/share-button";
import { StartTournamentButton } from "@/components/tournament/start-tournament-button";
import {
  getTournamentDetail,
  FORMAT_META,
  DISCIPLINE_LABEL,
  type TournamentMatchView,
} from "@/lib/tournament/queries";
import { getCurrentUser } from "@/lib/auth-helpers";
import { safe } from "@/lib/safe";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const d = await safe(() => getTournamentDetail(slug), null);
  return { title: d?.tournament.name ?? "Torneo" };
}

function byRound(matches: TournamentMatchView[]): [number, TournamentMatchView[]][] {
  const map = new Map<number, TournamentMatchView[]>();
  for (const m of matches) {
    const r = m.round ?? 1;
    if (!map.has(r)) map.set(r, []);
    map.get(r)!.push(m);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]);
}

export default async function TournamentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const detail = await safe(() => getTournamentDetail(slug), null);
  if (!detail) notFound();

  const { tournament, matchesByStage, groups, standings, groupStandings, winnerName } = detail;
  const user = await getCurrentUser();
  const isAdmin = user?.role === "admin";
  const isCreator = !!user && tournament.createdById === user.id;
  const meta = FORMAT_META[tournament.format];
  const ranked = tournament.config.ranked !== false;

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "localhost:3000";
  const inviteUrl = tournament.inviteToken
    ? `${proto}://${host}/tornei/invito/${tournament.inviteToken}`
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card-surface p-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="text-3xl">{meta?.emoji}</span>
          <Badge tone={tournament.status === "draft" ? "ball" : tournament.status === "completed" ? "muted" : "win"}>
            {tournament.status === "draft" ? "⏳ In attesa" : tournament.status === "completed" ? "Concluso" : "In corso"}
          </Badge>
          <Badge tone={ranked ? "brand" : "muted"}>
            {ranked ? "🏆 Classificato" : "🤝 Amichevole"}
          </Badge>
        </div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
          {tournament.name}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {meta?.label} · {DISCIPLINE_LABEL[tournament.discipline]} · {detail.entrants.length} partecipanti
        </p>
        {tournament.description && (
          <p className="mt-2 text-sm text-muted">{tournament.description}</p>
        )}
        {winnerName && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-[color-mix(in_srgb,var(--gold)_15%,transparent)] px-4 py-3">
            <Trophy className="h-5 w-5 text-[var(--gold)]" />
            <span className="font-bold">
              Vincitore: <span className="text-[var(--gold)]">{winnerName}</span> 🎉
            </span>
          </div>
        )}
      </div>

      {/* Draft: invite panel */}
      {tournament.status === "draft" && inviteUrl && (
        <Card className="space-y-4">
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-brand" /> Invita i partecipanti
          </CardTitle>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div className="shrink-0">
              <ProfileQr url={inviteUrl} />
            </div>
            <div className="space-y-3 text-center sm:text-left">
              <p className="text-sm text-muted">
                Fai scansionare il QR o condividi il link. Ogni giocatore si
                iscrive direttamente.
              </p>
              <ShareButton
                url={inviteUrl}
                title={`Unisciti a ${tournament.name} su sTablo`}
                text={`Sei stato invitato al torneo ${tournament.name} su sTablo! Clicca per iscriverti 👇`}
                label="Condividi invito"
              />
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted" />
                <span className="text-muted">
                  {detail.entrants.length} iscritti
                </span>
              </div>
            </div>
          </div>
          {(isAdmin || isCreator) && detail.entrants.length >= 2 && (
            <StartTournamentButton tournamentId={tournament.id} />
          )}
          {(isAdmin || isCreator) && detail.entrants.length < 2 && (
            <p className="text-center text-sm text-muted">
              Servono almeno 2 partecipanti per avviare il torneo.
            </p>
          )}
        </Card>
      )}

      {/* Body by format */}
      {tournament.status !== "draft" && (tournament.format === "league" || tournament.format === "round_robin") && (
        <>
          <Section title="Classifica">
            <StandingsTable rows={standings} highlight={1} />
          </Section>
          <Section title="Calendario">
            <div className="space-y-4">
              {byRound(matchesByStage.league ?? []).map(([round, ms]) => (
                <div key={round}>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                    Giornata {round}
                  </p>
                  <div className="space-y-2">
                    {ms.map((m) => (
                      <MatchRow key={m.id} match={m} isAdmin={isAdmin} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}

      {tournament.status !== "draft" && tournament.format === "swiss" && (
        <>
          <Section title="Classifica">
            <StandingsTable rows={standings} />
          </Section>
          <Section title="Turni">
            <div className="space-y-4">
              {byRound(matchesByStage.swiss ?? []).map(([round, ms]) => (
                <div key={round}>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                    Turno {round}
                  </p>
                  <div className="space-y-2">
                    {ms.map((m) => (
                      <MatchRow key={m.id} match={m} isAdmin={isAdmin} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>
          {isAdmin && tournament.status !== "completed" && (
            <SwissControls
              tournamentId={tournament.id}
              disabled={(matchesByStage.swiss ?? []).some((m) => m.status !== "completed")}
            />
          )}
        </>
      )}

      {tournament.status !== "draft" && tournament.format === "single_elim" && (
        <Section title="Tabellone">
          <Bracket matches={matchesByStage.knockout ?? []} isAdmin={isAdmin} />
        </Section>
      )}

      {tournament.status !== "draft" && tournament.format === "groups_knockout" && (
        <>
          <Section title="Fase a gironi">
            <div className="grid gap-5 md:grid-cols-2">
              {groups.map((g) => (
                <div key={g}>
                  <p className="mb-2 font-display font-bold">Girone {g}</p>
                  <StandingsTable
                    rows={groupStandings[g]}
                    highlight={tournament.config.advancePerGroup ?? 2}
                  />
                  <div className="mt-2 space-y-2">
                    {(matchesByStage.group ?? [])
                      .filter((m) => m.groupName === g)
                      .map((m) => (
                        <MatchRow key={m.id} match={m} isAdmin={isAdmin} />
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>
          {matchesByStage.knockout && matchesByStage.knockout.length > 0 ? (
            <Section title="Fase finale">
              <Bracket matches={matchesByStage.knockout} isAdmin={isAdmin} />
            </Section>
          ) : (
            <p className="text-sm text-muted">
              🔒 La fase finale verrà generata automaticamente al termine di tutti i gironi.
            </p>
          )}
        </>
      )}

      {isAdmin && (
        <div className="border-t border-border pt-4">
          <DeleteTournamentButton tournamentId={tournament.id} />
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-extrabold">
        <Swords className="h-4 w-4 text-brand" />
        {title}
      </h2>
      {children}
    </section>
  );
}
