import {
  pgEnum,
  pgTable,
  text,
  integer,
  timestamp,
  uuid,
  jsonb,
  boolean,
  uniqueIndex,
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import type { AttributeKey } from "../gamification";

/* ----------------------------------------------------------------------------
   Enums
---------------------------------------------------------------------------- */
export const userRole = pgEnum("user_role", ["admin", "player"]);
export const matchFormat = pgEnum("match_format", ["singles", "doubles"]);
export const matchStatus = pgEnum("match_status", [
  "scheduled",
  "pending",
  "completed",
]);
export const matchSide = pgEnum("match_side", ["A", "B"]);
export const tournamentFormat = pgEnum("tournament_format", [
  "league",
  "round_robin",
  "single_elim",
  "groups_knockout",
  "swiss",
  "americano",
]);
export const tournamentDiscipline = pgEnum("tournament_discipline", [
  "singles",
  "doubles",
  "teams",
]);
export const tournamentStatus = pgEnum("tournament_status", [
  "draft",
  "active",
  "completed",
]);
export const stageType = pgEnum("stage_type", [
  "league",
  "group",
  "knockout",
  "swiss",
]);
export const eloSubject = pgEnum("elo_subject", [
  "player_singles",
  "player_doubles",
  "team",
]);
export const preferredFoot = pgEnum("preferred_foot", [
  "left",
  "right",
  "both",
]);
export const friendshipStatus = pgEnum("friendship_status", [
  "pending",
  "accepted",
  "declined",
]);
export const tournamentVisibility = pgEnum("tournament_visibility", [
  "public",
  "private",
]);
export const tournamentInviteStatus = pgEnum("tournament_invite_status", [
  "pending",
  "accepted",
  "declined",
]);

export const STARTING_ELO = 1000;

/* ----------------------------------------------------------------------------
   Users — authentication & roles
---------------------------------------------------------------------------- */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** primary login handle (lowercase, unique) */
  username: text("username").unique(),
  /** optional — collected after first login */
  email: text("email").unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: userRole("role").notNull().default("player"),
  playerId: uuid("player_id").references(() => players.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ----------------------------------------------------------------------------
   Players — the humans; carry current Elo + denormalized peak
---------------------------------------------------------------------------- */
export const players = pgTable(
  "players",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    nickname: text("nickname"),
    slug: text("slug").notNull(),
    avatarColor: integer("avatar_color").notNull().default(0),
    /** optional uploaded profile picture, stored as a small data-URL */
    avatarUrl: text("avatar_url"),
    bio: text("bio"),
    motto: text("motto"),
    preferredFoot: preferredFoot("preferred_foot"),
    /** slug of a preset play style (see lib/gamification) */
    playStyle: text("play_style"),
    /** free-text signature move written by the player */
    specialMove: text("special_move"),
    /** when false, gamification card (level/attrs/style/move) is owner-only */
    statsPublic: boolean("stats_public").notNull().default(true),
    /**
     * Player-chosen attribute overrides for the FIFA card, e.g. {potenza: 70}.
     * Cosmetic only (never affects Elo/ranking). Each value is clamped to a
     * level-based ceiling server-side; an absent key means "auto" (derived).
     */
    customAttributes: jsonb("custom_attributes")
      .$type<Partial<Record<AttributeKey, number>>>()
      .notNull()
      .default({}),
    eloSingles: integer("elo_singles").notNull().default(STARTING_ELO),
    eloDoubles: integer("elo_doubles").notNull().default(STARTING_ELO),
    peakElo: integer("peak_elo").notNull().default(STARTING_ELO),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("players_slug_idx").on(t.slug)],
);

/* ----------------------------------------------------------------------------
   Teams — a named pair (alias) of two players with its own Elo
---------------------------------------------------------------------------- */
export const teams = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    avatarColor: integer("avatar_color").notNull().default(0),
    player1Id: uuid("player1_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    player2Id: uuid("player2_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    eloDoubles: integer("elo_doubles").notNull().default(STARTING_ELO),
    peakElo: integer("peak_elo").notNull().default(STARTING_ELO),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("teams_slug_idx").on(t.slug),
    uniqueIndex("teams_pair_idx").on(t.player1Id, t.player2Id),
  ],
);

/* ----------------------------------------------------------------------------
   Matches — 1v1 or 2v2, with exact score. May belong to a tournament.
---------------------------------------------------------------------------- */
export const matches = pgTable(
  "matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    format: matchFormat("format").notNull(),
    status: matchStatus("status").notNull().default("completed"),
    /** ranked = affects Elo; friendly = XP only */
    ranked: boolean("ranked").notNull().default(true),
    scoreA: integer("score_a"),
    scoreB: integer("score_b"),
    /** "A" | "B" | null while scheduled. */
    winner: matchSide("winner"),
    playedAt: timestamp("played_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    note: text("note"),

    // Result proposal / confirmation flow (casual matches)
    /** the user who proposed the result (null = admin-recorded / seed) */
    proposedById: uuid("proposed_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** which side the proposer is on — the OTHER side must confirm */
    proposedSide: matchSide("proposed_side"),
    /** auto-confirms after this instant (proposal + 24h) */
    confirmDeadline: timestamp("confirm_deadline", { withTimezone: true }),
    confirmedById: uuid("confirmed_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    autoConfirmed: boolean("auto_confirmed").notNull().default(false),

    // Dispute / "conteso" flow (Livello 2). A pending result the opponent
    // disagrees with: set these and the match is "conteso" — auto-confirm is
    // blocked and it lands in the admin dispute queue. Cleared when resolved.
    disputedAt: timestamp("disputed_at", { withTimezone: true }),
    disputedById: uuid("disputed_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    disputeReason: text("dispute_reason"),

    // Tournament wiring (all nullable for casual matches)
    tournamentId: uuid("tournament_id").references(() => tournaments.id, {
      onDelete: "cascade",
    }),
    stage: stageType("stage"),
    groupName: text("group_name"),
    round: integer("round"),
    slot: integer("slot"),
    entrantAId: uuid("entrant_a_id"),
    entrantBId: uuid("entrant_b_id"),
    /** Bracket progression: winner flows into this match/slot. */
    nextMatchId: uuid("next_match_id"),
    nextSlot: matchSide("next_slot"),
    /** Bracket progression: loser flows into this match/slot (3°/4° final). */
    loserNextMatchId: uuid("loser_next_match_id"),
    loserNextSlot: matchSide("loser_next_slot"),

    createdById: uuid("created_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("matches_tournament_idx").on(t.tournamentId),
    index("matches_played_idx").on(t.playedAt),
    // Hot path: nearly every read filters status='completed' (often ordered by
    // playedAt) and auto-confirm filters status='pending'. The composite keeps
    // these fast once the table fills up with thousands of matches.
    index("matches_status_played_idx").on(t.status, t.playedAt),
  ],
);

/* ----------------------------------------------------------------------------
   Match participants — one row per player per side (2 rows for doubles sides)
---------------------------------------------------------------------------- */
export const matchParticipants = pgTable(
  "match_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    side: matchSide("side").notNull(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    /** Set when this side played as a registered team. */
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
    ratingBefore: integer("rating_before"),
    ratingAfter: integer("rating_after"),
  },
  (t) => [
    index("mp_match_idx").on(t.matchId),
    index("mp_player_idx").on(t.playerId),
    index("mp_team_idx").on(t.teamId),
  ],
);

/* ----------------------------------------------------------------------------
   Elo history — one row per rating change, powers progression charts
---------------------------------------------------------------------------- */
export const eloHistory = pgTable(
  "elo_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subject: eloSubject("subject").notNull(),
    subjectId: uuid("subject_id").notNull(),
    matchId: uuid("match_id").references(() => matches.id, {
      onDelete: "cascade",
    }),
    elo: integer("elo").notNull(),
    delta: integer("delta").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("elo_subject_idx").on(t.subject, t.subjectId)],
);

/* ----------------------------------------------------------------------------
   Tournaments
---------------------------------------------------------------------------- */
export const tournaments = pgTable("tournaments", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  format: tournamentFormat("format").notNull(),
  discipline: tournamentDiscipline("discipline").notNull(),
  status: tournamentStatus("status").notNull().default("draft"),
  description: text("description"),
  /** Format-specific config: groups count, advancers, points, target score. */
  config: jsonb("config").$type<TournamentConfig>().notNull().default({}),
  currentRound: integer("current_round").notNull().default(0),
  winnerEntrantId: uuid("winner_entrant_id"),
  /** when set, anyone with this token can join as an entrant */
  inviteToken: text("invite_token").unique(),
  /** if true the tournament is joinable by anyone via inviteToken link */
  openInvite: boolean("open_invite").notNull().default(false),
  /** public = listed for everyone; private = only creator + invited users */
  visibility: tournamentVisibility("visibility").notNull().default("public"),
  createdById: uuid("created_by_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export type TournamentConfig = {
  groups?: number;
  advancePerGroup?: number;
  pointsWin?: number;
  pointsLoss?: number;
  swissRounds?: number;
  thirdPlace?: boolean;
  /** ranked = affects Elo; friendly = XP only */
  ranked?: boolean;
  /** league: play home & away (andata/ritorno) */
  doubleRound?: boolean;
  /** americano: target score that decides each game (default 15) */
  targetScore?: number;
  /** americano: number of rotation rounds to schedule */
  americanoRounds?: number;
};

/* ----------------------------------------------------------------------------
   Tournament entrants — a player or a team seeded into a tournament
---------------------------------------------------------------------------- */
export const tournamentEntrants = pgTable(
  "tournament_entrants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    seed: integer("seed").notNull().default(0),
    groupName: text("group_name"),
    playerId: uuid("player_id").references(() => players.id, {
      onDelete: "cascade",
    }),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "cascade" }),
    /** ad-hoc doubles pair (two player ids) when not a registered team */
    partnerId: uuid("partner_id").references(() => players.id, {
      onDelete: "cascade",
    }),
    eliminated: boolean("eliminated").notNull().default(false),
  },
  (t) => [index("entrant_tournament_idx").on(t.tournamentId)],
);

/* ----------------------------------------------------------------------------
   Friendships — request / accept between accounts
---------------------------------------------------------------------------- */
export const friendships = pgTable(
  "friendships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requesterId: uuid("requester_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    addresseeId: uuid("addressee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: friendshipStatus("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("friendship_pair_idx").on(t.requesterId, t.addresseeId),
    index("friendship_addressee_idx").on(t.addresseeId),
    index("friendship_requester_idx").on(t.requesterId),
  ],
);

export type Friendship = typeof friendships.$inferSelect;

/* ----------------------------------------------------------------------------
   Push subscriptions — Web Push endpoints per account (one row per device)
---------------------------------------------------------------------------- */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** unique push endpoint URL issued by the browser's push service */
    endpoint: text("endpoint").notNull(),
    /** client public key (base64url) for payload encryption */
    p256dh: text("p256dh").notNull(),
    /** client auth secret (base64url) */
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("push_endpoint_idx").on(t.endpoint),
    index("push_user_idx").on(t.userId),
  ],
);

export type PushSubscription = typeof pushSubscriptions.$inferSelect;

/* ----------------------------------------------------------------------------
   Notifications — persistent in-app inbox. One row per delivered notification;
   mirrors every Web Push so each user keeps a history with read/unread state,
   even when push is off or the device was offline. Writing here is best-effort
   and isolated from the action that triggers it (see lib/notify): a failure
   here must never break match recording, confirmation, etc.
---------------------------------------------------------------------------- */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** category slug (see lib/notifications) — drives the icon and badge rules */
    kind: text("kind").notNull().default("generic"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    /** in-app path to open on tap, e.g. "/partite/123" */
    url: text("url"),
    /** null while unread; set to the instant the user saw it */
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("notification_user_idx").on(t.userId, t.createdAt),
    index("notification_unread_idx").on(t.userId, t.readAt),
  ],
);

export type Notification = typeof notifications.$inferSelect;

/* ----------------------------------------------------------------------------
   Match reactions — one row per (match, user, emoji). Slack-style toggle: a
   user may add several distinct emojis to a match, each on/off independently.
---------------------------------------------------------------------------- */
export const matchReactions = pgTable(
  "match_reactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** The emoji char; validated against the fixed palette in lib/reactions. */
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("match_reaction_unique_idx").on(t.matchId, t.userId, t.emoji),
    index("match_reaction_match_idx").on(t.matchId),
  ],
);

export type MatchReaction = typeof matchReactions.$inferSelect;

/* ----------------------------------------------------------------------------
   Match comments — short text notes under a match, oldest-first in the thread.
   Threaded one level deep (Facebook-style): a comment may reply to a root
   comment via `parentId`; replies-to-replies are flattened onto the root.
---------------------------------------------------------------------------- */
export const matchComments = pgTable(
  "match_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /**
     * Reply target: the root comment this one answers, or null for a root
     * comment. Self-referencing FK with ON DELETE CASCADE so deleting a comment
     * also removes its replies. Threading is one level deep — the server
     * flattens any reply-to-a-reply onto the root.
     */
    parentId: uuid("parent_id").references((): AnyPgColumn => matchComments.id, {
      onDelete: "cascade",
    }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("match_comment_match_idx").on(t.matchId),
    index("match_comment_parent_idx").on(t.parentId),
  ],
);

export type MatchComment = typeof matchComments.$inferSelect;

/* ----------------------------------------------------------------------------
   Tournament comments — the conversation under a whole tournament, mirroring
   match comments (same one-level Facebook-style threading). Kept in its own
   table so the live match-comment flow is never touched.
---------------------------------------------------------------------------- */
export const tournamentComments = pgTable(
  "tournament_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Reply target — see matchComments.parentId; same one-level semantics. */
    parentId: uuid("parent_id").references(
      (): AnyPgColumn => tournamentComments.id,
      { onDelete: "cascade" },
    ),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("tournament_comment_tournament_idx").on(t.tournamentId),
    index("tournament_comment_parent_idx").on(t.parentId),
  ],
);

export type TournamentComment = typeof tournamentComments.$inferSelect;

/* ----------------------------------------------------------------------------
   Rate limits — one row per (actor, action) fixed window. Shared across all
   serverless instances so the limit is GLOBAL, not per-instance. Written via an
   atomic upsert (see lib/rate-limit.ts); rows are short-lived and pruned on
   deploy. `key` already encodes the action, so a single table covers them all.
---------------------------------------------------------------------------- */
export const rateLimits = pgTable("rate_limits", {
  /** Opaque actor+action identity, e.g. "login:1.2.3.4" or "propose:<uuid>". */
  key: text("key").primaryKey(),
  /** Hits recorded in the current window. */
  count: integer("count").notNull(),
  /** When the current window ends and the counter rolls over. */
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
});

/* ----------------------------------------------------------------------------
   Tournament invites — a private tournament invitation to a specific account
---------------------------------------------------------------------------- */
export const tournamentInvites = pgTable(
  "tournament_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    invitedUserId: uuid("invited_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    invitedById: uuid("invited_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    status: tournamentInviteStatus("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("tournament_invite_pair_idx").on(t.tournamentId, t.invitedUserId),
    index("tournament_invite_user_idx").on(t.invitedUserId),
  ],
);

export type TournamentInvite = typeof tournamentInvites.$inferSelect;

/* ----------------------------------------------------------------------------
   Relations
---------------------------------------------------------------------------- */
export const usersRelations = relations(users, ({ one }) => ({
  player: one(players, {
    fields: [users.playerId],
    references: [players.id],
  }),
}));

export const playersRelations = relations(players, ({ many, one }) => ({
  participations: many(matchParticipants),
  // Reverse of users.playerId — lets match queries surface a player's account
  // username (1:1 by app logic). Metadata only; no DB column.
  user: one(users, {
    fields: [players.id],
    references: [users.playerId],
  }),
}));

export const teamsRelations = relations(teams, ({ one }) => ({
  player1: one(players, {
    fields: [teams.player1Id],
    references: [players.id],
    relationName: "team_player1",
  }),
  player2: one(players, {
    fields: [teams.player2Id],
    references: [players.id],
    relationName: "team_player2",
  }),
}));

export const matchesRelations = relations(matches, ({ many, one }) => ({
  participants: many(matchParticipants),
  tournament: one(tournaments, {
    fields: [matches.tournamentId],
    references: [tournaments.id],
  }),
}));

export const matchParticipantsRelations = relations(
  matchParticipants,
  ({ one }) => ({
    match: one(matches, {
      fields: [matchParticipants.matchId],
      references: [matches.id],
    }),
    player: one(players, {
      fields: [matchParticipants.playerId],
      references: [players.id],
    }),
    team: one(teams, {
      fields: [matchParticipants.teamId],
      references: [teams.id],
    }),
  }),
);

export const tournamentsRelations = relations(tournaments, ({ many }) => ({
  entrants: many(tournamentEntrants),
  matches: many(matches),
  invites: many(tournamentInvites),
}));

export const tournamentInvitesRelations = relations(
  tournamentInvites,
  ({ one }) => ({
    tournament: one(tournaments, {
      fields: [tournamentInvites.tournamentId],
      references: [tournaments.id],
    }),
    invitedUser: one(users, {
      fields: [tournamentInvites.invitedUserId],
      references: [users.id],
    }),
  }),
);

export const tournamentEntrantsRelations = relations(
  tournamentEntrants,
  ({ one }) => ({
    tournament: one(tournaments, {
      fields: [tournamentEntrants.tournamentId],
      references: [tournaments.id],
    }),
    player: one(players, {
      fields: [tournamentEntrants.playerId],
      references: [players.id],
    }),
    team: one(teams, {
      fields: [tournamentEntrants.teamId],
      references: [teams.id],
    }),
  }),
);

/* ----------------------------------------------------------------------------
   Inferred types
---------------------------------------------------------------------------- */
export type User = typeof users.$inferSelect;
export type Player = typeof players.$inferSelect;
export type NewPlayer = typeof players.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type NewMatch = typeof matches.$inferInsert;
export type MatchParticipant = typeof matchParticipants.$inferSelect;
export type Tournament = typeof tournaments.$inferSelect;
export type TournamentEntrant = typeof tournamentEntrants.$inferSelect;
export type NewTournamentInvite = typeof tournamentInvites.$inferInsert;
