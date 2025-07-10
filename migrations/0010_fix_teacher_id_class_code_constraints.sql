-- Migration: Make teacher_id and class_code NOT NULL
-- These fields should be required and form part of the business logic constraints

-- Make teacher_id NOT NULL
ALTER TABLE sessions ALTER COLUMN teacher_id SET NOT NULL;

-- Make class_code NOT NULL  
ALTER TABLE sessions ALTER COLUMN class_code SET NOT NULL;

-- Add composite index on teacher_id and session_id since they work together
CREATE INDEX IF NOT EXISTS idx_sessions_teacher_session ON sessions(teacher_id, session_id);
