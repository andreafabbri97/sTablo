ALTER TYPE "public"."match_status" ADD VALUE 'pending' BEFORE 'completed';--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "proposed_by_id" uuid;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "proposed_side" "match_side";--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "confirm_deadline" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "confirmed_by_id" uuid;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "auto_confirmed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_proposed_by_id_users_id_fk" FOREIGN KEY ("proposed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_confirmed_by_id_users_id_fk" FOREIGN KEY ("confirmed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;