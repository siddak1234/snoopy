-- Projects table + RLS (Supabase)
-- Use this in Supabase SQL editor if you use Supabase Auth and want RLS.
-- This repo uses NextAuth + Prisma; the table is created by Prisma (userId -> users.id).
-- With NextAuth, isolation is enforced in the app layer; this file is for reference or migration to Supabase Auth.

-- Table (only run if NOT using Prisma migrations for this table)
-- CREATE TABLE IF NOT EXISTS projects (
--   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
--   name text NOT NULL,
--   description text,
--   status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','draft','archived')),
--   created_at timestamptz NOT NULL DEFAULT now(),
--   updated_at timestamptz NOT NULL DEFAULT now()
-- );

-- Index for list-by-user
-- CREATE INDEX IF NOT EXISTS projects_user_id_created_at_idx ON projects (user_id, created_at DESC);

-- Trigger to auto-update updated_at
-- CREATE OR REPLACE FUNCTION set_updated_at()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   NEW.updated_at = now();
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;
-- CREATE TRIGGER projects_updated_at
--   BEFORE UPDATE ON projects
--   FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
-- ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Policies (require Supabase Auth so auth.uid() is set)
-- CREATE POLICY "Users can read own projects" ON projects
--   FOR SELECT USING (auth.uid() = user_id);
-- CREATE POLICY "Users can insert own projects" ON projects
--   FOR INSERT WITH CHECK (auth.uid() = user_id);
-- CREATE POLICY "Users can update own projects" ON projects
--   FOR UPDATE USING (auth.uid() = user_id);
-- CREATE POLICY "Users can delete own projects" ON projects
--   FOR DELETE USING (auth.uid() = user_id);
