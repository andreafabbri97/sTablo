DO $$ BEGIN
 CREATE TYPE "public"."tournament_visibility" AS ENUM('public', 'private');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."tournament_invite_status" AS ENUM('pending', 'accepted', 'declined');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "visibility" "tournament_visibility" DEFAULT 'public' NOT NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tournament_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL REFERENCES "tournaments"("id") ON DELETE CASCADE,
	"invited_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"invited_by_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
	"status" "tournament_invite_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tournament_invite_pair_idx" ON "tournament_invites" ("tournament_id","invited_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tournament_invite_user_idx" ON "tournament_invites" ("invited_user_id");
