"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Reply, Send, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea, FieldError } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { cn, timeAgo } from "@/lib/utils";
import { MAX_COMMENT_LENGTH } from "@/lib/reactions";
import type { ActionResult } from "@/lib/actions/auth-actions";
import type { CommentView, CommentThread } from "@/lib/social";

/**
 * The actions a thread needs, already bound to their subject (a match or a
 * tournament). Keeping them as props lets one threaded-comment UI serve both
 * without the component knowing which subject it's attached to.
 */
export type CommentActions = {
  add: (input: { body: string }, parentId?: string) => Promise<ActionResult>;
  remove: (commentId: string) => Promise<ActionResult>;
};

/**
 * A one-level (Facebook-style) threaded comment list with an inline composer.
 * Subject-agnostic: pass the bound `actions` and it works for matches or
 * tournaments alike. Reads are uncached, so every mutation just calls
 * router.refresh() to reconcile.
 */
export function CommentThreadList({
  comments,
  viewerUserId,
  isAdmin,
  actions,
  emptyText = "Ancora nessun commento. Apri tu le danze! 🎉",
}: {
  comments: CommentThread[];
  viewerUserId: string | null;
  isAdmin: boolean;
  actions: CommentActions;
  emptyText?: string;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-4">
        {comments.length === 0 ? (
          <p className="text-sm text-muted">{emptyText}</p>
        ) : (
          comments.map((thread) => (
            <ThreadView
              key={thread.id}
              thread={thread}
              viewerUserId={viewerUserId}
              isAdmin={isAdmin}
              actions={actions}
            />
          ))
        )}
      </div>

      {viewerUserId ? (
        <Composer actions={actions} />
      ) : (
        <p className="text-sm text-muted">
          <Link href="/login" className="font-semibold text-brand hover:underline">
            Accedi
          </Link>{" "}
          per commentare.
        </p>
      )}
    </div>
  );
}

/** A root comment plus its indented replies and an inline reply composer. */
function ThreadView({
  thread,
  viewerUserId,
  isAdmin,
  actions,
}: {
  thread: CommentThread;
  viewerUserId: string | null;
  isAdmin: boolean;
  actions: CommentActions;
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
        actions={actions}
      />

      {(thread.replies.length > 0 || replying) && (
        <div className="ml-7 space-y-3 border-l-2 border-border/60 pl-3 sm:ml-9 sm:pl-4">
          {thread.replies.map((reply) => (
            <CommentRow
              key={reply.id}
              comment={reply}
              canDelete={isAdmin || reply.userId === viewerUserId}
              onDeleted={() => router.refresh()}
              actions={actions}
              size="xs"
            />
          ))}
          {replying && (
            <Composer
              actions={actions}
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
  actions,
  size = "sm",
}: {
  comment: CommentView;
  canDelete: boolean;
  onDeleted: () => void;
  /** When provided, shows a "Rispondi" action (root comments only). */
  onReply?: () => void;
  actions: CommentActions;
  size?: "sm" | "xs";
}) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  function onDelete() {
    startTransition(async () => {
      const res = await actions.remove(comment.id);
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
  actions,
  parentId,
  placeholder = "Scrivi un commento…",
  autoFocus,
  onDone,
}: {
  actions: CommentActions;
  parentId?: string;
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
      const res = await actions.add({ body: trimmed }, parentId);
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
          className={cn("text-xs", remaining <= 20 ? "text-danger" : "text-muted")}
        >
          {remaining} caratteri
        </span>
        <div className="flex items-center gap-2">
          {parentId && onDone && (
            <Button type="button" variant="ghost" size="sm" onClick={onDone}>
              Annulla
            </Button>
          )}
          <Button type="submit" size="sm" disabled={isPending || !body.trim()}>
            <Send className="h-4 w-4" />
            {isPending ? "Invio…" : parentId ? "Rispondi" : "Invia"}
          </Button>
        </div>
      </div>
    </form>
  );
}
