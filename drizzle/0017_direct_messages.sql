CREATE TABLE IF NOT EXISTS "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_a_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"user_b_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_message_body" text,
	"last_message_sender_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
	"a_last_read_at" timestamp with time zone,
	"b_last_read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "conversation_pair_idx" ON "conversations" ("user_a_id","user_b_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversation_user_a_idx" ON "conversations" ("user_a_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversation_user_b_idx" ON "conversations" ("user_b_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "direct_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
	"sender_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dm_conversation_idx" ON "direct_messages" ("conversation_id","created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blocker_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"blocked_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_block_pair_idx" ON "user_blocks" ("blocker_id","blocked_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_block_blocked_idx" ON "user_blocks" ("blocked_id");
