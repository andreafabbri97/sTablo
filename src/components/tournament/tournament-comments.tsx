"use client";

import {
  addTournamentComment,
  deleteTournamentComment,
} from "@/lib/actions/tournament-social-actions";
import {
  CommentThreadList,
  type CommentActions,
} from "@/components/comment-thread";
import type { CommentThread } from "@/lib/social";

/**
 * The tournament-level conversation: the shared threaded-comment UI wired to the
 * tournament's server actions. Same look and behaviour as a match's comments.
 */
export function TournamentComments({
  tournamentId,
  comments,
  viewerUserId,
  isAdmin,
}: {
  tournamentId: string;
  comments: CommentThread[];
  viewerUserId: string | null;
  isAdmin: boolean;
}) {
  const actions: CommentActions = {
    add: (input, parentId) =>
      addTournamentComment(tournamentId, input, parentId),
    remove: deleteTournamentComment,
  };

  return (
    <CommentThreadList
      comments={comments}
      viewerUserId={viewerUserId}
      isAdmin={isAdmin}
      actions={actions}
      emptyText="Ancora nessun commento sul torneo. Inizia tu! 🎉"
    />
  );
}
