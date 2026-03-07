-- Add supabaseUserId for Supabase Auth OAuth user linking
ALTER TABLE "users" ADD COLUMN "supabaseUserId" TEXT;
CREATE UNIQUE INDEX "users_supabaseUserId_key" ON "users"("supabaseUserId");
