-- Add type column to projects table
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT '';
