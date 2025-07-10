-- Migration: Revert class_code NOT NULL constraint temporarily
-- This allows the application to handle NULL values gracefully while we fix the code

-- Remove the NOT NULL constraint for class_code
ALTER TABLE sessions ALTER COLUMN class_code DROP NOT NULL;
