"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Reply, Send, Trash2 } from "lucide-react";
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
import type { ReactionSummary, CommentView, CommentThread } from "@/lib/social";

/**
 * Reactions + comments under a match. Reactions toggle optimistically (the bar
 * never waits on the round-trip); comments post through a transition and the
 * page re-fetches via router.refresh(). All reads are uncached, so a refresh is
 * the whole story — no feed-cache busting.
 *
 * Comments are threaded one level deep (Facebook-style): each root comment can
 * be replied to, and the replies stack indented underneath it.
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
  comments: CommentThread[];
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

      {/* Comment threads */}
      <div className="space-y-4">
        {comments.length === 0 ? (
          <p className="text-sm text-muted">
            Ancora nessun commento. Apri tu le danze! 🎉
          </p>
        ) : (
          comments.map((thread) => (
            <ThreadView
              key={thread.id}
              thread={thread}
              matchId={matchId}
              viewerUserId={viewerUserId}
              isAdmin={isAdmin}
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

/** A root comment plus its indented replies and an inline reply composer. */
function ThreadView({
  thread,
  matchId,
  viewerUserId,
  isAdmin,
}: {
  thread: CommentThread;
  matchId: string;
  viewerUserId: string | null;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [replying, setReplying] = useState(false);

  return (
    <div className="space-y-3">
      <CommentRow
        comment={thread}
        canDelete={isAdmin || thread.userId === viewerUserId}
        onDeleted={() => router.refresh()}
        onReply={viewerUserId ? () => setReplying((v) => !v) : undefined}
      />

      {(thread.replies.length > 0 || replying) && (
        <div className="ml-7 space-y-3 border-l-2 border-border/60 pl-3 sm:ml-9 sm:pl-4">
          {thread.replies.map((reply) => (
            <CommentRow
              key={reply.id}
              comment={reply}
              canDelete={isAdmin || reply.userId === viewerUserId}
              onDeleted={() => router.refresh()}
              size="xs"
            />
          ))}
          {replying && (
            <Composer
              matchId={matchId}
              parentId={thread.id}
              placeholder={`Rispondi a ${thread.authorName}…`}
              autoFocus
              onDone={() => setReplying(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function CommentRow({
  comment,
  canDelete,
  onDeleted,
  onReply,
  size = "sm",
}: {
  comment: CommentView;
  canDelete: boolean;
  onDeleted: () => void;
  /** When provided, shows a "Rispondi" action (root comments only). */
  onReply?: () => void;
  size?: "sm" | "xs";
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
    <div className="flex items-start gap-2.5">
      <Avatar
        name={comment.authorName}
        colorIndex={comment.avatarColor}
        imageUrl={comment.avatarUrl}
        size={size}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
          {nameNode}
          <span className="text-xs text-muted">{timeAgo(comment.createdAt)}</span>
        </div>
        <p className="whitespace-pre-wrap break-words text-sm text-foreground/90">
          {comment.body}
        </p>
        {onReply && (
          <button
            type="button"
            onClick={onReply}
            className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-muted transition hover:text-brand"
          >
            <Reply className="h-3.5 w-3.5" /> Rispondi
          </button>
        )}
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

/**
 * Comment box. Posts a root comment by default, or a reply when `parentId` is
 * set (then it also renders an "Annulla" button to close the reply box).
 */
function Composer({
  matchId,
  parentId,
  disabled,
  placeholder = "Scrivi un commento…",
  autoFocus,
  onDone,
}: {
  matchId: string;
  parentId?: string;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  /** Called after a successful post, or when the user cancels a reply. */
  onDone?: () => void;
}) {
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
      const res = await addComment(matchId, { body: trimmed }, parentId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setBody("");
      onDone?.();
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
        placeholder={placeholder}
        aria-label={parentId ? "Nuova risposta" : "Nuovo commento"}
        autoFocus={autoFocus}
      />
      <FieldError>{error}</FieldError>
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "text-xs",
            remaining <= 20 ? "text-danger" : "text-muted",
          )}
        >
          {remaining} caratteri
        </span>
        <div className="flex items-center gap-2">
          {parentId && onDone && (
            <Button type="button" variant="ghost" size="sm" onClick={onDone}>
              Annulla
            </Button>
          )}
          <Button type="submit" size="sm" disabled={busy || !body.trim()}>
            <Send className="h-4 w-4" />
            {isPending ? "Invio…" : parentId ? "Rispondi" : "Invia"}
          </Button>
        </div>
      </div>
    </form>
  );
}
