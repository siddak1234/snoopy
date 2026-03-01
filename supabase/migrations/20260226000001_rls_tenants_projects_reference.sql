-- RLS reference for tenants, tenant_memberships, projects, project_memberships.
-- This app uses NextAuth + Prisma; tenant_id and user_id are derived server-side only.
-- Run this only if you switch to Supabase Auth (auth.uid() then set). Until then, isolation is enforced in application code.

-- Tenants: org owner can read own tenant
-- ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "tenant_owner_read" ON tenants FOR SELECT USING (auth.uid() = "ownerUserId");

-- Tenant memberships: user can read own membership
-- ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "user_own_membership" ON tenant_memberships FOR SELECT USING (auth.uid() = "userId");

-- Projects: SELECT if same tenant and (owner OR in project_memberships OR org_owner)
-- (Requires helper or multiple policies; simplified: tenant members can read projects in their tenant.)
-- INSERT/UPDATE/DELETE: project owner or org_owner only (enforced in app for now).

-- Project memberships: SELECT for same tenant; INSERT via app only after code verification.
-- (Join-by-code is implemented in Next.js server action with bcrypt verify, then insert; RLS would allow if tenant matches.)
