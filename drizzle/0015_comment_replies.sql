ALTER TABLE "match_comments" ADD COLUMN IF NOT EXISTS "parent_id" uuid REFERENCES "match_comments"("id") ON DELETE CASCADE;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "match_comment_parent_idx" ON "match_comments" ("parent_id");
