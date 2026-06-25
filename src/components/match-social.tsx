"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  toggleReaction,
  addComment,
  deleteComment,
} from "@/lib/actions/social-actions";
import {
  CommentThreadList,
  type CommentActions,
} from "@/components/comment-thread";
import type { ReactionSummary, CommentThread } from "@/lib/social";

/**
 * Reactions + comments under a match. The reaction bar toggles optimistically
 * (it never waits on the round-trip); the threaded comments live in the shared
 * CommentThreadList, wired to the match's server actions. All reads are
 * uncached, so a router.refresh() after a mutation is the whole story.
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
  const [, startTransition] = useTransition();

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

  const actions: CommentActions = {
    add: (input, parentId) => addComment(matchId, input, parentId),
    remove: deleteComment,
  };

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

      <CommentThreadList
        comments={comments}
        viewerUserId={viewerUserId}
        isAdmin={isAdmin}
        actions={actions}
      />
    </div>
  );
}
