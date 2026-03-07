# Production Readiness Audit: Supabase Auth Migration

**Date:** Post-migration audit  
**Scope:** Validation that the NextAuth → Supabase Auth migration is complete and correct.

---

## 1. Remaining legacy references

### Code (application)

| Search term | Result |
|-------------|--------|
| `next-auth` | **None** in `.ts`/`.tsx`/`.js` |
| `NextAuth` | **None** |
| `SessionProvider` | **None** |
| `signIn("google")` | **None** |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | **None** |
| `NEXTAUTH_URL` / `NEXTAUTH_SECRET` | **None** |
| `authOptions` | **None** |
| `callbacks.signIn` | **None** |
| `proxy.ts` | **File deleted**; no references |

**Verdict:** No legacy auth code remains in the application. Auth is fully Supabase-based.

### Documentation (updated in this audit)

| File | Change |
|------|--------|
| `docs/AUTH-MIGRATION-PLAN.md` | Header added: "Status: Historical" so it’s clear the doc describes the plan, not current state. |
| `docs/SYSTEM-ARCHITECTURE.md` | "NextAuth" → "Supabase"; env list updated to Supabase vars. |
| `docs/ARCHITECTURE.md` | "NextAuth" → "Supabase Auth" in assessment table. |
| `docs/REPO-STRUCTURE.md` | Env validation note updated (no "auth config" reference). |

### Intentional `/api/auth` usage

- **`/api/auth/signup`** — **Keep.** Used for email/password signup only. No NextAuth; calls Supabase `signUp` from `lib/supabase.ts` server client.

---

## 2. Files safe to delete

**None.** No deprecated auth files remain. `proxy.ts`, `app/api/auth/[...nextauth]/route.ts`, `components/providers/SessionProvider.tsx`, and `types/next-auth.d.ts` were already removed in the migration.

---

## 3. Files modified in this audit

| File | Modification |
|------|---------------|
| `docs/AUTH-MIGRATION-PLAN.md` | Added historical status note. |
| `docs/SYSTEM-ARCHITECTURE.md` | NextAuth → Supabase; env list updated. |
| `docs/ARCHITECTURE.md` | NextAuth → Supabase Auth in table. |
| `docs/REPO-STRUCTURE.md` | Env validation description updated. |
| `docs/AUTH-AUDIT-REPORT.md` | New; this report. |

---

## 4. Confirmed auth flow

### Google login

- **Login page:** `OAuthButton` with `provider="google"` → `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${origin}/auth/callback?next=...` } })`.
- **Signup page:** Same pattern for "Sign up with Google"; `redirectTo` includes `/auth/callback?next=/account`.
- **Client:** `createClient()` from `@/lib/supabase/client` (uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`).

### Microsoft login

- **Login page:** `OAuthButton` with `provider="azure"` → `supabase.auth.signInWithOAuth({ provider: "azure", options: { redirectTo: ... } })`.
- **Signup page:** "Sign up with Microsoft" uses `provider: "azure"` and same `redirectTo` pattern.

### Redirect handling

- All OAuth flows use: `redirectTo: \`${window.location.origin}/auth/callback?next=${encodeURIComponent(callbackUrl)}\``.
- **Callback route** (`app/auth/callback/route.ts`): `exchangeCodeForSession(code)` via `createClient()` from `@/lib/supabase/server` (cookie-aware), then redirect to `next` or `/account`. No provisioning in callback; provisioning runs on first use of `getAppSession()`.

### Supabase client initialization

- **Browser:** `lib/supabase/client.ts` — `createBrowserClient(supabaseUrl, supabaseAnonKey)` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (fallback `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for anon key).
- **Server:** `lib/supabase/server.ts` — `createServerClient` from `@supabase/ssr` with cookies.
- **Server (no cookies):** `lib/supabase.ts` — `createClient` with `persistSession: false` (e.g. signup API).

---

## 5. Authentication guards

### Middleware

- **File:** `middleware.ts` (root). **`proxy.ts` does not exist.**
- **Logic:** `updateSession(request)` from `@/lib/supabase/middleware`.
- **Protected paths:** `["/account", "/dashboard"]` (and any path under them).
- **Behavior:** Uses `createServerClient` and `supabase.auth.getUser()`. If path is protected and no user → redirect to `/login?callbackUrl=<path>`.

### Layout guards

- **`app/account/layout.tsx`:** `getAppSession()`; if no `session?.user?.email` or `session?.user?.id` → `redirect("/login?callbackUrl=/account")`.
- **`app/dashboard/layout.tsx`:** `getAppSession()`; if no `session?.user?.id` → `redirect("/login?callbackUrl=/dashboard")`.

**Verdict:** Protected routes require a valid Supabase session; unauthenticated users are redirected to login with a callback URL.

---

## 6. User provisioning

### Location

- **`lib/auth-supabase.ts`:** `provisionUserFromSupabaseAuth(supabaseUser)` (internal); called from `getAppSession()`.

### Logic

1. **Lookup by Supabase ID:** `prisma.user.findUnique({ where: { supabaseUserId } })`. If found → update `email`, `name`, `image`; return existing id.
2. **Lookup by email:** Case-insensitive `findFirst({ where: { email: { equals: email, mode: "insensitive" } } })`. If found → update `supabaseUserId`, `name`, `image`; return existing id (links existing app user to this Supabase identity).
3. **Create:** If neither found → `prisma.user.create({ data: { email, supabaseUserId, name, image } })`.

After provisioning, `getAppSession()` calls `ensureDefaultWorkspaceForUser(id)` (from `lib/auth.ts`).

### Duplicate users

- **Same email, same provider:** One Supabase user → one Prisma User (by `supabaseUserId`).
- **Same email, different providers (e.g. Google then Microsoft):** Supabase creates two auth users (different `id`). First login creates Prisma User with that `supabaseUserId`. Second login matches by email, updates same Prisma User with the second `supabaseUserId`. **Result: one Prisma User per email; no duplicate app users.**

---

## 7. Environment variables

### Required (validated in production by `lib/env.ts`)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `POSTGRES_URL`

### Optional

- `POSTGRES_PRISMA_URL` — used by Prisma config for migrations when set.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — fallback for anon key in some Supabase clients; not in `.env.example`.

### Removed (not referenced in code)

- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

**Note:** `validateEnv()` is **never invoked** in the codebase. To fail fast in production when required env is missing, call it from `instrumentation.ts` (Next.js) or another single bootstrap path.

---

## 8. Risks and edge cases

| Risk | Mitigation |
|------|------------|
| **Same email, multiple OAuth providers** | Single Prisma User per email; `supabaseUserId` stores last-used provider’s Supabase id. If user switches provider, they still get the same app user. |
| **Env validation not run** | Add `instrumentation.ts` that calls `validateEnv()` so production fails fast on missing vars. |
| **Supabase redirect URLs** | Must include production and local URLs in Supabase Dashboard (e.g. `https://yourdomain.com/auth/callback`, `http://localhost:3000/auth/callback`). |
| **Middleware deprecation** | Next.js may warn about `middleware` → `proxy`. Auth behavior is correct; follow framework guidance when migrating to `proxy` later. |

---

## 9. Test checklist

### Local

- [ ] Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `POSTGRES_URL` in `.env.local`.
- [ ] In Supabase Dashboard, add `http://localhost:3000/auth/callback` to Redirect URLs.
- [ ] **Google:** Click "Continue with Google" on `/login` → redirects to Google → back to `/auth/callback` → redirects to `/account`. User appears in Prisma `User` with `supabaseUserId` set.
- [ ] **Microsoft:** Same with "Continue with Microsoft"; user created or linked by email.
- [ ] **Email/password:** Sign up via `/signup` (non-Gmail) → confirm if required → log in; then open `/account`.
- [ ] **Guards:** Open `/account` or `/dashboard` while logged out → redirect to `/login?callbackUrl=...`.
- [ ] **Sign out:** From account/nav, sign out → session cleared; protected routes redirect to login.

### Vercel

- [ ] Set env vars in project: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `POSTGRES_URL` (and `POSTGRES_PRISMA_URL` if needed for deploy).
- [ ] In Supabase, add `https://<your-vercel-domain>/auth/callback` to Redirect URLs; set Site URL if required.
- [ ] Run same flows as local (Google, Microsoft, email/password, guards, sign out).
- [ ] Confirm no references to old vars in Vercel env (remove `NEXTAUTH_*`, `GOOGLE_*` if still present).

---

## Summary

- **Legacy:** No remaining NextAuth or old OAuth code in the app. Only docs referenced the old setup; those have been updated or marked historical.
- **Supabase Auth:** Google and Microsoft use `signInWithOAuth` with correct `redirectTo`; callback exchanges code and redirects; client and server Supabase usage is correct.
- **Guards:** Middleware and layout checks enforce Supabase session for `/account` and `/dashboard`; redirect to login when unauthenticated.
- **Provisioning:** Single path in `getAppSession()` → `provisionUserFromSupabaseAuth` + `ensureDefaultWorkspaceForUser`; one Prisma User per email; no duplicate users for same email across providers.
- **Env:** Only Supabase and Postgres vars are used; no code references removed vars. Optional improvement: call `validateEnv()` at bootstrap so production fails fast on missing env.
