-- Add rest_days column to loans table
ALTER TABLE loans ADD COLUMN IF NOT EXISTS rest_days TEXT DEFAULT '';
