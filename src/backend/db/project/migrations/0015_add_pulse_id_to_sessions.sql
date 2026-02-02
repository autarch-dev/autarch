-- Migration: Add pulse_id column to sessions table
-- This links execution sessions to their associated pulse for grouping messages by pulse in the UI

ALTER TABLE sessions ADD COLUMN pulse_id TEXT;
