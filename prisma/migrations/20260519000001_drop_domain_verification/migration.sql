-- Drop the domain-verification subsystem entirely. Supabase OAuth verifies
-- the user's email at sign-in, which is the same trust level the
-- email-link verification provided.
DROP TABLE IF EXISTS "domain_verification_tokens";

ALTER TABLE "workspaces"
  DROP COLUMN IF EXISTS "domainVerified",
  DROP COLUMN IF EXISTS "domainVerifiedAt";
