-- Migration: Add teacher_id column to sessions table
-- This enables Teacher ID-based session reconnection to prevent session mix-ups

-- Add teacher_id column to sessions table
ALTER TABLE sessions ADD COLUMN teacher_id TEXT;

-- Add index on teacher_id for faster lookups when finding sessions by teacher ID
CREATE INDEX IF NOT EXISTS idx_sessions_teacher_id ON sessions(teacher_id);

-- Add partial index for active sessions with teacher_id (most common lookup pattern)
CREATE INDEX IF NOT EXISTS idx_sessions_teacher_id_active ON sessions(teacher_id) WHERE is_active = true;
