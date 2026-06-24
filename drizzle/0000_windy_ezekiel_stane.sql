CREATE TYPE "public"."elo_subject" AS ENUM('player_singles', 'player_doubles', 'team');--> statement-breakpoint
CREATE TYPE "public"."friendship_status" AS ENUM('pending', 'accepted', 'declined');--> statement-breakpoint
CREATE TYPE "public"."match_format" AS ENUM('singles', 'doubles');--> statement-breakpoint
CREATE TYPE "public"."match_side" AS ENUM('A', 'B');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('scheduled', 'completed');--> statement-breakpoint
CREATE TYPE "public"."preferred_foot" AS ENUM('left', 'right', 'both');--> statement-breakpoint
CREATE TYPE "public"."stage_type" AS ENUM('league', 'group', 'knockout', 'swiss');--> statement-breakpoint
CREATE TYPE "public"."tournament_discipline" AS ENUM('singles', 'doubles', 'teams');--> statement-breakpoint
CREATE TYPE "public"."tournament_format" AS ENUM('league', 'round_robin', 'single_elim', 'groups_knockout', 'swiss');--> statement-breakpoint
CREATE TYPE "public"."tournament_status" AS ENUM('draft', 'active', 'completed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'player');--> statement-breakpoint
CREATE TABLE "elo_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject" "elo_subject" NOT NULL,
	"subject_id" uuid NOT NULL,
	"match_id" uuid,
	"elo" integer NOT NULL,
	"delta" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "friendships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_id" uuid NOT NULL,
	"addressee_id" uuid NOT NULL,
	"status" "friendship_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "match_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"side" "match_side" NOT NULL,
	"player_id" uuid NOT NULL,
	"team_id" uuid,
	"rating_before" integer,
	"rating_after" integer
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"format" "match_format" NOT NULL,
	"status" "match_status" DEFAULT 'completed' NOT NULL,
	"ranked" boolean DEFAULT true NOT NULL,
	"score_a" integer,
	"score_b" integer,
	"winner" "match_side",
	"played_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text,
	"tournament_id" uuid,
	"stage" "stage_type",
	"group_name" text,
	"round" integer,
	"slot" integer,
	"entrant_a_id" uuid,
	"entrant_b_id" uuid,
	"next_match_id" uuid,
	"next_slot" "match_side",
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"nickname" text,
	"slug" text NOT NULL,
	"avatar_color" integer DEFAULT 0 NOT NULL,
	"bio" text,
	"motto" text,
	"preferred_foot" "preferred_foot",
	"play_style" text,
	"special_move" text,
	"stats_public" boolean DEFAULT true NOT NULL,
	"elo_singles" integer DEFAULT 1000 NOT NULL,
	"elo_doubles" integer DEFAULT 1000 NOT NULL,
	"peak_elo" integer DEFAULT 1000 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"avatar_color" integer DEFAULT 0 NOT NULL,
	"player1_id" uuid NOT NULL,
	"player2_id" uuid NOT NULL,
	"elo_doubles" integer DEFAULT 1000 NOT NULL,
	"peak_elo" integer DEFAULT 1000 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournament_entrants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"name" text NOT NULL,
	"seed" integer DEFAULT 0 NOT NULL,
	"group_name" text,
	"player_id" uuid,
	"team_id" uuid,
	"partner_id" uuid,
	"eliminated" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"format" "tournament_format" NOT NULL,
	"discipline" "tournament_discipline" NOT NULL,
	"status" "tournament_status" DEFAULT 'draft' NOT NULL,
	"description" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"current_round" integer DEFAULT 0 NOT NULL,
	"winner_entrant_id" uuid,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'player' NOT NULL,
	"player_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "elo_history" ADD CONSTRAINT "elo_history_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_addressee_id_users_id_fk" FOREIGN KEY ("addressee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_player1_id_players_id_fk" FOREIGN KEY ("player1_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_player2_id_players_id_fk" FOREIGN KEY ("player2_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_entrants" ADD CONSTRAINT "tournament_entrants_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_entrants" ADD CONSTRAINT "tournament_entrants_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_entrants" ADD CONSTRAINT "tournament_entrants_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_entrants" ADD CONSTRAINT "tournament_entrants_partner_id_players_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "elo_subject_idx" ON "elo_history" USING btree ("subject","subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "friendship_pair_idx" ON "friendships" USING btree ("requester_id","addressee_id");--> statement-breakpoint
CREATE INDEX "friendship_addressee_idx" ON "friendships" USING btree ("addressee_id");--> statement-breakpoint
CREATE INDEX "friendship_requester_idx" ON "friendships" USING btree ("requester_id");--> statement-breakpoint
CREATE INDEX "mp_match_idx" ON "match_participants" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "mp_player_idx" ON "match_participants" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "mp_team_idx" ON "match_participants" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "matches_tournament_idx" ON "matches" USING btree ("tournament_id");--> statement-breakpoint
CREATE INDEX "matches_played_idx" ON "matches" USING btree ("played_at");--> statement-breakpoint
CREATE UNIQUE INDEX "players_slug_idx" ON "players" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "teams_slug_idx" ON "teams" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "teams_pair_idx" ON "teams" USING btree ("player1_id","player2_id");--> statement-breakpoint
CREATE INDEX "entrant_tournament_idx" ON "tournament_entrants" USING btree ("tournament_id");