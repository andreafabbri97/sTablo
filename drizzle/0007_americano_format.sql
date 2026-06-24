-- Add the Americano (rotating-partner, individual-scoring) tournament format.
-- ADD VALUE IF NOT EXISTS is idempotent and must run as a top-level statement
-- (it cannot be used inside the same transaction it is added in — we only add
-- it here; it is first used by application code in a later request).
ALTER TYPE "public"."tournament_format" ADD VALUE IF NOT EXISTS 'americano';
