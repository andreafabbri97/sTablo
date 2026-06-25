CREATE TABLE IF NOT EXISTS "match_reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL REFERENCES "matches"("id") ON DELETE CASCADE,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "match_reaction_unique_idx" ON "match_reactions" ("match_id","user_id","emoji");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "match_reaction_match_idx" ON "match_reactions" ("match_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "match_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL REFERENCES "matches"("id") ON DELETE CASCADE,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "match_comment_match_idx" ON "match_comments" ("match_id");
