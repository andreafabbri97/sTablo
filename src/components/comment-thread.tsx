"use client";

import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Reply, Send, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea, FieldError } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { cn, timeAgo } from "@/lib/utils";
import { MAX_COMMENT_LENGTH } from "@/lib/reactions";
import { tokenizeMentions } from "@/lib/mentions";
import {
  getMentionables,
  type Mentionable,
} from "@/lib/actions/social-actions";
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

/** username → player slug, for linkifying @mentions to their profile. */
type SlugByHandle = Map<string, string>;

/**
 * A one-level (Facebook-style) threaded comment list with an inline composer.
 * Subject-agnostic: pass the bound `actions` and it works for matches or
 * tournaments alike. Reads are uncached, so every mutation just calls
 * router.refresh() to reconcile.
 *
 * The list loads the @mention directory once (players with an account) to power
 * the composer's autocomplete and to linkify mentions in rendered comments.
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
  const [mentionables, setMentionables] = useState<Mentionable[]>([]);

  useEffect(() => {
    let active = true;
    getMentionables()
      .then((list) => active && setMentionables(list))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const slugByHandle = useMemo<SlugByHandle>(
    () => new Map(mentionables.map((m) => [m.username, m.slug])),
    [mentionables],
  );

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
              mentionables={mentionables}
              slugByHandle={slugByHandle}
            />
          ))
        )}
      </div>

      {viewerUserId ? (
        <Composer actions={actions} mentionables={mentionables} />
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
  mentionables,
  slugByHandle,
}: {
  thread: CommentThread;
  viewerUserId: string | null;
  isAdmin: boolean;
  actions: CommentActions;
  mentionables: Mentionable[];
  slugByHandle: SlugByHandle;
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
        slugByHandle={slugByHandle}
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
              slugByHandle={slugByHandle}
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
              mentionables={mentionables}
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
  slugByHandle,
  size = "sm",
}: {
  comment: CommentView;
  canDelete: boolean;
  onDeleted: () => void;
  /** When provided, shows a "Rispondi" action (root comments only). */
  onReply?: () => void;
  actions: CommentActions;
  slugByHandle: SlugByHandle;
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
          {comment.authorUsername && (
            <span className="text-xs font-medium text-muted">
              @{comment.authorUsername}
            </span>
          )}
          <span className="text-xs text-muted">{timeAgo(comment.createdAt)}</span>
        </div>
        <CommentBody text={comment.body} slugByHandle={slugByHandle} />
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

/** Comment text with @mentions linkified to the mentioned player's profile. */
function CommentBody({
  text,
  slugByHandle,
}: {
  text: string;
  slugByHandle: SlugByHandle;
}) {
  const segments = useMemo(() => tokenizeMentions(text), [text]);
  return (
    <p className="whitespace-pre-wrap break-words text-sm text-foreground/90">
      {segments.map((seg, i) => {
        if (seg.type === "text") return <Fragment key={i}>{seg.value}</Fragment>;
        const slug = slugByHandle.get(seg.handle);
        return slug ? (
          <Link
            key={i}
            href={`/giocatori/${slug}`}
            className="font-semibold text-brand hover:underline"
          >
            {seg.raw}
          </Link>
        ) : (
          <span key={i} className="font-semibold text-brand">
            {seg.raw}
          </span>
        );
      })}
    </p>
  );
}

/**
 * Comment box with @mention autocomplete. Posts a root comment by default, or a
 * reply when `parentId` is set (then it also renders an "Annulla" button). While
 * typing `@handle`, a dropdown suggests matching players; pick one to insert
 * `@username`. Mentioned players get notified server-side (see addComment).
 */
function Composer({
  actions,
  parentId,
  placeholder = "Scrivi un commento… usa @ per menzionare",
  autoFocus,
  onDone,
  mentionables,
  defaultBody = "",
}: {
  actions: CommentActions;
  parentId?: string;
  placeholder?: string;
  autoFocus?: boolean;
  /** Called after a successful post, or when the user cancels a reply. */
  onDone?: () => void;
  mentionables: Mentionable[];
  /** Seed text (e.g. a reply pre-filled with `@author `). */
  defaultBody?: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState(defaultBody);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const taRef = useRef<HTMLTextAreaElement>(null);

  // The active @token being typed (query after '@' and the '@' index), or null.
  const [mention, setMention] = useState<{ query: string; start: number } | null>(
    null,
  );
  const [activeIdx, setActiveIdx] = useState(0);

  // Detect an in-progress @mention at the caret: an '@' that starts a word,
  // followed by 0-20 handle chars, ending exactly at the caret.
  function syncMention(value: string, caret: number) {
    const upto = value.slice(0, caret);
    const m = /(?:^|[^a-z0-9_@])@([a-z0-9_]{0,20})$/i.exec(upto);
    if (m) {
      setMention({ query: m[1].toLowerCase(), start: caret - m[1].length - 1 });
      setActiveIdx(0);
    } else {
      setMention(null);
    }
  }

  const suggestions = useMemo(() => {
    if (!mention) return [];
    const q = mention.query;
    return mentionables
      .filter(
        (m) =>
          m.username.includes(q) || m.name.toLowerCase().includes(q),
      )
      // username-prefix matches first, then the rest — both alphabetical
      .sort((a, b) => {
        const ap = a.username.startsWith(q) ? 0 : 1;
        const bp = b.username.startsWith(q) ? 0 : 1;
        return ap - bp || a.name.localeCompare(b.name);
      })
      .slice(0, 6);
  }, [mention, mentionables]);

  const showMenu = mention != null && suggestions.length > 0;

  function applyMention(m: Mentionable) {
    if (!mention) return;
    const before = body.slice(0, mention.start);
    const after = body.slice(mention.start + 1 + mention.query.length);
    const insert = `@${m.username} `;
    const next = before + insert + after;
    const caret = (before + insert).length;
    setBody(next);
    setMention(null);
    requestAnimationFrame(() => {
      const ta = taRef.current;
      if (ta) {
        ta.focus();
        ta.setSelectionRange(caret, caret);
      }
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!showMenu) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      applyMention(suggestions[activeIdx] ?? suggestions[0]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setMention(null);
    }
  }

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
      setMention(null);
      onDone?.();
      router.refresh();
    });
  }

  const remaining = MAX_COMMENT_LENGTH - body.length;

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <div className="relative">
        {showMenu && (
          <ul className="absolute bottom-full left-0 z-20 mb-1 max-h-60 w-full max-w-xs overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-[var(--shadow-lg)]">
            {suggestions.map((m, i) => (
              <li key={m.username}>
                <button
                  type="button"
                  // mousedown (not click) so the textarea doesn't blur first
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applyMention(m);
                  }}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition",
                    i === activeIdx ? "bg-surface-2" : "hover:bg-surface-2",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {m.name}
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    @{m.username}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <Textarea
          ref={taRef}
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            syncMention(e.target.value, e.target.selectionStart ?? e.target.value.length);
          }}
          onKeyDown={onKeyDown}
          onClick={(e) => {
            const t = e.currentTarget;
            syncMention(t.value, t.selectionStart ?? t.value.length);
          }}
          onKeyUp={(e) => {
            // arrows/home/end move the caret without changing the value
            if (e.key.startsWith("Arrow") || e.key === "Home" || e.key === "End") {
              const t = e.currentTarget;
              syncMention(t.value, t.selectionStart ?? t.value.length);
            }
          }}
          maxLength={MAX_COMMENT_LENGTH}
          rows={2}
          placeholder={placeholder}
          aria-label={parentId ? "Nuova risposta" : "Nuovo commento"}
          autoFocus={autoFocus}
        />
      </div>
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
