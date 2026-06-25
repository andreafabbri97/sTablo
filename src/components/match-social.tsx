"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Send, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea, FieldError } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { cn, timeAgo } from "@/lib/utils";
import { MAX_COMMENT_LENGTH } from "@/lib/reactions";
import {
  toggleReaction,
  addComment,
  deleteComment,
} from "@/lib/actions/social-actions";
import type { ReactionSummary, CommentView } from "@/lib/social";

/**
 * Reactions + comments under a match. Reactions toggle optimistically (the bar
 * never waits on the round-trip); comments post through a transition and the
 * page re-fetches via router.refresh(). All reads are uncached, so a refresh is
 * the whole story — no feed-cache busting.
 */
export function MatchSocial({
  matchId,
  reactions,
  comments,
  viewerUserId,
  isAdmin,
}: {
  matchId: string;
  reactions: ReactionSummary[];
  comments: CommentView[];
  viewerUserId: string | null;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  // Optimistic reaction bar: flip mine + nudge the count instantly, reconcile to
  // the server state once router.refresh() lands.
  const [optimisticReactions, applyReaction] = useOptimistic(
    reactions,
    (state, emoji: string) =>
      state.map((r) =>
        r.emoji === emoji
          ? { ...r, mine: !r.mine, count: r.count + (r.mine ? -1 : 1) }
          : r,
      ),
  );

  function onToggle(emoji: string) {
    if (!viewerUserId) {
      toast.info("Accedi per reagire");
      return;
    }
    startTransition(async () => {
      applyReaction(emoji);
      const res = await toggleReaction(matchId, emoji);
      if (!res.ok) toast.info(res.error);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {/* Reaction bar */}
      <div className="flex flex-wrap gap-2">
        {optimisticReactions.map((r) => (
          <button
            key={r.emoji}
            type="button"
            onClick={() => onToggle(r.emoji)}
            aria-pressed={r.mine}
            aria-label={`Reagisci ${r.emoji}`}
            className={cn(
              "flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm transition active:scale-90",
              r.mine
                ? "border-brand bg-brand/10 text-brand"
                : "border-border bg-surface-2 text-muted hover:text-foreground",
            )}
          >
            <span className="text-base leading-none">{r.emoji}</span>
            {r.count > 0 && (
              <span className="font-mono text-xs font-bold tabular-nums">
                {r.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Comment thread */}
      <div className="space-y-3">
        {comments.length === 0 ? (
          <p className="text-sm text-muted">
            Ancora nessun commento. Apri tu le danze! 🎉
          </p>
        ) : (
          comments.map((c) => (
            <CommentRow
              key={c.id}
              comment={c}
              canDelete={isAdmin || c.userId === viewerUserId}
              onDeleted={() => router.refresh()}
            />
          ))
        )}
      </div>

      {/* Composer */}
      {viewerUserId ? (
        <Composer matchId={matchId} disabled={isPending} />
      ) : (
        <p className="text-sm text-muted">
          <Link href="/login" className="font-semibold text-brand hover:underline">
            Accedi
          </Link>{" "}
          per commentare e reagire.
        </p>
      )}
    </div>
  );
}

function CommentRow({
  comment,
  canDelete,
  onDeleted,
}: {
  comment: CommentView;
  canDelete: boolean;
  onDeleted: () => void;
}) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  function onDelete() {
    startTransition(async () => {
      const res = await deleteComment(comment.id);
      if (!res.ok) {
        toast.info(res.error);
        return;
      }
      onDeleted();
    });
  }

  const nameNode = comment.authorSlug ? (
    <Link
      href={`/giocatori/${comment.authorSlug}`}
      className="font-semibold hover:text-brand hover:underline"
    >
      {comment.authorName}
    </Link>
  ) : (
    <span className="font-semibold">{comment.authorName}</span>
  );

  return (
    <div className="flex items-start gap-3">
      <Avatar
        name={comment.authorName}
        colorIndex={comment.avatarColor}
        imageUrl={comment.avatarUrl}
        size="sm"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm">
          {nameNode}
          <span className="text-xs text-muted">{timeAgo(comment.createdAt)}</span>
        </div>
        <p className="whitespace-pre-wrap break-words text-sm text-foreground/90">
          {comment.body}
        </p>
      </div>
      {canDelete && (
        <button
          type="button"
          onClick={onDelete}
          disabled={isPending}
          aria-label="Elimina commento"
          className="shrink-0 rounded-md p-1 text-muted transition hover:text-danger disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function Composer({ matchId, disabled }: { matchId: string; disabled: boolean }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      const res = await addComment(matchId, { body: trimmed });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setBody("");
      router.refresh();
    });
  }

  const remaining = MAX_COMMENT_LENGTH - body.length;
  const busy = disabled || isPending;

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={MAX_COMMENT_LENGTH}
        rows={2}
        placeholder="Scrivi un commento…"
        aria-label="Nuovo commento"
      />
      <FieldError>{error}</FieldError>
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "text-xs",
            remaining <= 20 ? "text-danger" : "text-muted",
          )}
        >
          {remaining} caratteri
        </span>
        <Button type="submit" size="sm" disabled={busy || !body.trim()}>
          <Send className="h-4 w-4" />
          {isPending ? "Invio…" : "Invia"}
        </Button>
      </div>
    </form>
  );
}
