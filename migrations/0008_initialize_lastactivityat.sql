-- Migration: Initialize lastActivityAt for existing sessions
-- This ensures existing sessions have a proper lastActivityAt timestamp

-- Update existing sessions that don't have lastActivityAt set
UPDATE "sessions" 
SET "last_activity_at" = "start_time" 
WHERE "last_activity_at" IS NULL AND "start_time" IS NOT NULL;

-- For sessions that somehow don't have start_time either, set to current time
UPDATE "sessions" 
SET "last_activity_at" = NOW() 
WHERE "last_activity_at" IS NULL;
