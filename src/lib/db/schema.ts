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
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

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
    bio: text("bio"),
    motto: text("motto"),
    preferredFoot: preferredFoot("preferred_foot"),
    /** slug of a preset play style (see lib/gamification) */
    playStyle: text("play_style"),
    /** free-text signature move written by the player */
    specialMove: text("special_move"),
    /** when false, gamification card (level/attrs/style/move) is owner-only */
    statsPublic: boolean("stats_public").notNull().default(true),
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

export const playersRelations = relations(players, ({ many }) => ({
  participations: many(matchParticipants),
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
