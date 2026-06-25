ALTER TABLE "matches" ADD COLUMN "disputed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "disputed_by_id" uuid;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "dispute_reason" text;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_disputed_by_id_users_id_fk" FOREIGN KEY ("disputed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;