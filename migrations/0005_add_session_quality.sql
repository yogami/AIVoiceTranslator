-- Add session quality tracking fields
ALTER TABLE sessions ADD COLUMN quality TEXT DEFAULT 'unknown' CHECK (quality IN ('unknown', 'real', 'no_students', 'no_activity', 'too_short'));
ALTER TABLE sessions ADD COLUMN quality_reason TEXT;
ALTER TABLE sessions ADD COLUMN last_activity_at TIMESTAMP DEFAULT NOW();

-- Update existing sessions to have last_activity_at
UPDATE sessions SET last_activity_at = start_time WHERE last_activity_at IS NULL;
