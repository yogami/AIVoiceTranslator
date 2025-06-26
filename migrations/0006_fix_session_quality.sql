-- Fix session quality tracking fields - add IF NOT EXISTS to avoid errors if columns already exist
DO $$ 
BEGIN
    -- Add quality column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='sessions' AND column_name='quality') THEN
        ALTER TABLE sessions ADD COLUMN quality TEXT DEFAULT 'unknown' CHECK (quality IN ('unknown', 'real', 'no_students', 'no_activity', 'too_short'));
    END IF;

    -- Add quality_reason column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='sessions' AND column_name='quality_reason') THEN
        ALTER TABLE sessions ADD COLUMN quality_reason TEXT;
    END IF;

    -- Add last_activity_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='sessions' AND column_name='last_activity_at') THEN
        ALTER TABLE sessions ADD COLUMN last_activity_at TIMESTAMP DEFAULT NOW();
    END IF;
END $$;

-- Update existing sessions to have last_activity_at if it's NULL
UPDATE sessions SET last_activity_at = start_time WHERE last_activity_at IS NULL;
