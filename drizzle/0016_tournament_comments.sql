CREATE TABLE IF NOT EXISTS "tournament_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL REFERENCES "tournaments"("id") ON DELETE CASCADE,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"parent_id" uuid REFERENCES "tournament_comments"("id") ON DELETE CASCADE,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tournament_comment_tournament_idx" ON "tournament_comments" ("tournament_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tournament_comment_parent_idx" ON "tournament_comments" ("parent_id");
