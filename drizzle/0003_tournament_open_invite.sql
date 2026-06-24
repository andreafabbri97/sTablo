ALTER TABLE "tournaments" ADD COLUMN "invite_token" text UNIQUE;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "open_invite" boolean DEFAULT false NOT NULL;
