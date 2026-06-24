import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { Users, Inbox, Send, QrCode as QrIcon, UserPlus } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Card, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { AddFriendButton } from "@/components/friends/add-friend-button";
import { RequestActions } from "@/components/friends/request-actions";
import { CopyLink } from "@/components/friends/copy-link";
import { ProfileQr } from "@/components/friends/profile-qr";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { players } from "@/lib/db/schema";
import {
  getFriends,
  getIncomingRequests,
  getOutgoingRequests,
  getAccountUsers,
  getFriendMap,
  type FriendProfile,
} from "@/lib/friends";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Amici" };

export default async function AmiciPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/amici");

  const [friends, incoming, outgoing, accounts, friendMap, h] = await Promise.all([
    getFriends(user.id),
    getIncomingRequests(user.id),
    getOutgoingRequests(user.id),
    getAccountUsers(),
    getFriendMap(user.id),
    headers(),
  ]);

  const myPlayer = user.playerId
    ? await db.query.players.findFirst({ where: eq(players.id, user.playerId) })
    : null;

  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "localhost:3000";
  const profileUrl = myPlayer
    ? `${proto}://${host}/giocatori/${myPlayer.slug}`
    : `${proto}://${host}`;

  const addable = accounts.filter(
    (a) => a.userId !== user.id && !friendMap.has(a.userId),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Users className="h-6 w-6" />}
        title="Amici"
        subtitle="Trova i tuoi amici e sfidali"
      />

      {/* Share / QR */}
      <Card className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
        <ProfileQr url={profileUrl} />
        <div className="flex-1 text-center sm:text-left">
          <CardTitle className="flex items-center justify-center gap-2 sm:justify-start">
            <QrIcon className="h-5 w-5 text-brand" /> Condividi il tuo profilo
          </CardTitle>
          <p className="mt-1 text-sm text-muted">
            Fai scansionare il QR (o invia il link) per farti trovare e aggiungere
            al volo, anche in spiaggia.
          </p>
          <div className="mt-3 flex justify-center sm:justify-start">
            <CopyLink url={profileUrl} />
          </div>
        </div>
      </Card>

      {/* Incoming requests */}
      {incoming.length > 0 && (
        <section>
          <SectionTitle icon={<Inbox className="h-4 w-4" />} title={`Richieste ricevute (${incoming.length})`} />
          <div className="space-y-2">
            {incoming.map((r) => (
              <FriendRow key={r.friendshipId} friend={r}>
                <RequestActions friendshipId={r.friendshipId} />
              </FriendRow>
            ))}
          </div>
        </section>
      )}

      {/* Friends */}
      <section>
        <SectionTitle icon={<Users className="h-4 w-4" />} title={`I miei amici (${friends.length})`} />
        {friends.length === 0 ? (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="Ancora nessun amico"
            description="Aggiungi i tuoi compagni di tavolino qui sotto."
          />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {friends.map((f) => (
              <FriendRow key={f.friendshipId} friend={f} />
            ))}
          </div>
        )}
      </section>

      {/* Outgoing */}
      {outgoing.length > 0 && (
        <section>
          <SectionTitle icon={<Send className="h-4 w-4" />} title={`Richieste inviate (${outgoing.length})`} />
          <div className="space-y-2">
            {outgoing.map((r) => (
              <FriendRow key={r.friendshipId} friend={r}>
                <span className="text-xs text-muted">In attesa…</span>
              </FriendRow>
            ))}
          </div>
        </section>
      )}

      {/* Find players */}
      {addable.length > 0 && (
        <section>
          <SectionTitle icon={<UserPlus className="h-4 w-4" />} title="Trova giocatori" />
          <div className="grid gap-2 sm:grid-cols-2">
            {addable.map((a) => (
              <div key={a.userId} className="card-surface flex items-center gap-3 p-3">
                <Avatar name={a.name} colorIndex={a.avatarColor} size="sm" />
                <span className="flex-1 truncate text-sm font-semibold">{a.name}</span>
                <AddFriendButton targetUserId={a.userId} state="none" />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function FriendRow({
  friend,
  children,
}: {
  friend: FriendProfile;
  children?: React.ReactNode;
}) {
  const inner = (
    <div className="card-surface flex items-center gap-3 p-3">
      <Avatar name={friend.name} colorIndex={friend.avatarColor} size="sm" />
      <span className="flex-1 truncate text-sm font-semibold">{friend.name}</span>
      {children}
    </div>
  );
  if (friend.slug && !children) {
    return <Link href={`/giocatori/${friend.slug}`}>{inner}</Link>;
  }
  return inner;
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-extrabold">
      <span className="text-brand">{icon}</span>
      {title}
    </h2>
  );
}
