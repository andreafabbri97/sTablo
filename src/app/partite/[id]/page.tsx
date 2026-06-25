import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { ArrowLeft, QrCode, Clock, CalendarClock, MessageCircle } from "lucide-react";
import { MatchCard } from "@/components/match-card";
import { MatchConfirmActions } from "@/components/match-confirm-actions";
import { ScheduledMatchPanel } from "@/components/scheduled-match-panel";
import { MatchSocial } from "@/components/match-social";
import { ProfileQr } from "@/components/friends/profile-qr";
import { ShareButton } from "@/components/share-button";
import { Card, CardTitle } from "@/components/ui/card";
import { getMatchById } from "@/lib/queries";
import { getMatchSocial } from "@/lib/social";
import {
  canConfirmMatch,
  canRecordScheduled,
  canCancelScheduled,
} from "@/lib/match-perms";
import { getCurrentUser } from "@/lib/auth-helpers";
import { safe } from "@/lib/safe";
import { timeAgo, formatDateTime, timeUntil } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const match = await safe(() => getMatchById(id), null);
  if (!match) return { title: "Partita" };
  const a = match.sideA.label || "Squadra A";
  const b = match.sideB.label || "Squadra B";
  const hasScore = match.scoreA !== null && match.scoreB !== null;
  const title = hasScore
    ? `${a} ${match.scoreA}–${match.scoreB} ${b}`
    : `${a} vs ${b}`;
  const desc = "Partita di tavolino su sTablo.";
  return {
    title,
    description: desc,
    openGraph: { title: `${title} · sTablo`, description: desc },
    twitter: { title: `${title} · sTablo`, description: desc },
  };
}

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await safe(() => getMatchById(id), null);
  if (!match) notFound();

  const user = await getCurrentUser();
  const viewer = user ? { playerId: user.playerId, role: user.role } : null;
  const viewerFull = user
    ? { playerId: user.playerId, role: user.role, userId: user.id }
    : null;
  const isPending = match.status === "pending";
  const isScheduled = match.status === "scheduled";
  const canConfirm = canConfirmMatch(match, viewer);
  const isProposer = !!user && match.proposedById === user.id;
  const canRecord = canRecordScheduled(match, viewer);
  const canCancel = canCancelScheduled(match, viewerFull);

  const social = await safe(() => getMatchSocial(match.id, user?.id), {
    reactions: [],
    comments: [],
  });

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "localhost:3000";
  const url = `${proto}://${host}/partite/${match.id}`;

  return (
    <div className="mx-auto max-w-md space-y-5">
      <Link
        href="/partite"
        className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-brand"
      >
        <ArrowLeft className="h-4 w-4" /> Partite
      </Link>

      <MatchCard match={match} />

      {isScheduled && (
        <Card className="space-y-4">
          <div className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <CalendarClock className="h-5 w-5 text-brand" /> Sfida in programma
            </CardTitle>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {formatDateTime(match.playedAt)}
            </p>
            <p className="text-xs text-muted">{timeUntil(match.playedAt)}</p>
          </div>

          {canRecord || canCancel ? (
            <ScheduledMatchPanel
              matchId={match.id}
              labelA={match.sideA.label || "Squadra A"}
              labelB={match.sideB.label || "Squadra B"}
              canRecord={canRecord}
              canCancel={canCancel}
              isAdmin={user?.role === "admin"}
            />
          ) : (
            <p className="text-center text-sm text-muted">
              Solo chi gioca la sfida può registrare il risultato.
            </p>
          )}
        </Card>
      )}

      {isPending && (
        <Card className="space-y-4 text-center">
          <div>
            <CardTitle className="flex items-center justify-center gap-2">
              <Clock className="h-5 w-5 text-brand" /> In attesa di conferma
            </CardTitle>
            {match.confirmDeadline && (
              <p className="mt-1 text-xs text-muted">
                Si conferma da solo {timeAgo(match.confirmDeadline)} se nessuno
                risponde.
              </p>
            )}
          </div>

          {canConfirm ? (
            <MatchConfirmActions matchId={match.id} />
          ) : isProposer ? (
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm text-muted">
                Fai scansionare questo QR all&apos;avversario per confermare:
              </p>
              <ProfileQr url={url} />
              <p className="flex items-center gap-1 text-xs text-muted">
                <QrCode className="h-3.5 w-3.5" /> oppure condividi il link:
              </p>
              <ShareButton
                url={url}
                title="Conferma risultato — sTablo"
                text="Conferma il risultato della nostra partita di tavolino 👇"
              />
            </div>
          ) : (
            <p className="text-sm text-muted">
              Solo l&apos;avversario può confermare questo risultato.
            </p>
          )}
        </Card>
      )}

      <Card className="space-y-4">
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-brand" /> Reazioni e commenti
        </CardTitle>
        <MatchSocial
          matchId={match.id}
          reactions={social.reactions}
          comments={social.comments}
          viewerUserId={user?.id ?? null}
          isAdmin={user?.role === "admin"}
        />
      </Card>
    </div>
  );
}
