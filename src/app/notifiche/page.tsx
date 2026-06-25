import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  Check,
  Clock,
  Swords,
  MessageCircle,
  Trophy,
  CalendarClock,
  UserPlus,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { getCurrentUser } from "@/lib/auth-helpers";
import {
  fetchNotificationFeed,
  type FeedItem,
} from "@/lib/actions/notification-actions";
import { timeAgo } from "@/lib/utils";
import { MarkReadOnView } from "@/components/notifications/mark-read-on-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Notifiche" };

/** Icon + accent colour per notification kind. Keep in sync with NotifyKind. */
const VISUAL: Record<string, { icon: LucideIcon; tone: string }> = {
  confirm_needed: { icon: Clock, tone: "text-brand" },
  challenge: { icon: Swords, tone: "text-brand" },
  match_confirmed: { icon: Check, tone: "text-win" },
  result_disputed: { icon: AlertTriangle, tone: "text-loss" },
  comment: { icon: MessageCircle, tone: "text-brand" },
  friend_request: { icon: UserPlus, tone: "text-brand" },
  tournament_invite: { icon: Trophy, tone: "text-brand" },
  season_recap: { icon: Trophy, tone: "text-win" },
  match_reminder: { icon: CalendarClock, tone: "text-brand" },
  generic: { icon: Bell, tone: "text-muted" },
};

function visualFor(kind: string) {
  return VISUAL[kind] ?? VISUAL.generic;
}

export default async function NotifichePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/notifiche");

  const feed = await fetchNotificationFeed();

  return (
    <div className="space-y-6">
      <MarkReadOnView />
      <PageHeader
        icon={<Bell className="h-6 w-6" />}
        title="Notifiche"
        subtitle="Tutto quello che è successo: conferme, sfide, commenti e altro"
        help="notifiche"
      />

      {feed.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-6 w-6" />}
          title="Nessuna notifica"
          description="Quando qualcuno ti sfida, propone un risultato o commenta una partita, lo trovi qui."
        />
      ) : (
        <ul className="space-y-2">
          {feed.map((item) => (
            <FeedRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}

function FeedRow({ item }: { item: FeedItem }) {
  const { icon: Icon, tone } = visualFor(item.kind);

  const inner = (
    <div
      className={`card-surface flex items-start gap-3 p-3 ${
        item.read ? "" : "ring-1 ring-brand/40"
      }`}
    >
      <span
        className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 ${tone}`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-sm font-bold">{item.title}</p>
          {!item.read && (
            <span className="h-2 w-2 shrink-0 rounded-full bg-brand" aria-label="Non letta" />
          )}
        </div>
        <p className="mt-0.5 text-sm text-muted">{item.body}</p>
        <p className="mt-1 text-xs text-muted">{timeAgo(item.createdAt)}</p>
      </div>
    </div>
  );

  if (item.url) {
    return (
      <li>
        <Link href={item.url} className="block transition hover:opacity-90">
          {inner}
        </Link>
      </li>
    );
  }
  return <li>{inner}</li>;
}
