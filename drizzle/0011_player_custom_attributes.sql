ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "custom_attributes" jsonb DEFAULT '{}'::jsonb NOT NULL;
