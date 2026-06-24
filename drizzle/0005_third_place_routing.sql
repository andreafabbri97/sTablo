ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "loser_next_match_id" uuid;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "loser_next_slot" "match_side";
