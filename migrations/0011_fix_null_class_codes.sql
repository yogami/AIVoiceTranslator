-- Migration: Fix NULL class_code values before enforcing NOT NULL constraint
-- This migration ensures all existing sessions have a class_code

-- Update any sessions that have NULL class_code with a generated code
UPDATE sessions 
SET class_code = 'LEGACY' || UPPER(LEFT(session_id, 5))
WHERE class_code IS NULL;

-- Now ensure the NOT NULL constraint is in place
ALTER TABLE sessions ALTER COLUMN class_code SET NOT NULL;
