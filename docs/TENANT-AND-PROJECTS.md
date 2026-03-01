# Tenant and projects permission model

## Tenant derivation (never from client)

- **tenant_id** and **owner_user_id** are **never** accepted from the client. They are always derived server-side from the authenticated session.
- **getTenantForUser(userId)** returns the user’s single tenant from `tenant_memberships` where `userId = session.user.id` (from `getServerSession(getAuthOptions())`).
- **ensureTenantForUser(userId)** creates a default tenant and `tenant_memberships` row (org_owner) if the user has none; used when loading the Projects page or creating a project.
- **createProject**: `tenantId` = result of `ensureTenantForUser(session.user.id)`; `ownerUserId` and `ownerName` = session user. No client input for tenant or owner.
- **joinProjectByCode**: Lookup by access code only; tenant is derived via `getTenantForUser(session.user.id)`. Projects are filtered by `tenantId = user's tenant` before verifying the code. Cross-tenant join is impossible.

## Access codes

- Stored as **hash only** (bcrypt) in `projects.accessCodeHash` and a short **prefix** in `projects.accessCodePrefix` for lookup. Plaintext access codes are never stored.
- Shown once to the project owner after create; join flow verifies the code server-side with bcrypt.compare then inserts into `project_memberships`.

## RLS

- This app uses **NextAuth + Prisma**. Supabase RLS with `auth.uid()` is not in use unless you switch to Supabase Auth. Isolation is enforced in application code: all project and tenant queries filter by `session.user.id` and server-derived `tenantId`.
