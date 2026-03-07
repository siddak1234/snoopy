# Auth Migration: NextAuth → Supabase Auth

> **Status: Historical.** This document describes the migration plan. The migration is complete; current auth is Supabase Auth only. See STACK.md and README for current setup.

## 1. Current Architecture Audit (pre-migration)

### Auth Providers
| Provider | Current Implementation | Source |
|----------|------------------------|--------|
| **Google** | NextAuth `GoogleProvider` | `lib/auth.ts`, `signIn("google")` |
| **Microsoft** | Not implemented | — |
| **Email/Password** | Supabase Auth + NextAuth Credentials | `lib/auth.ts` CredentialsProvider, `/api/auth/signup` |

### Session & Identity
- **Session**: NextAuth JWT in cookies (`NEXTAUTH_SECRET`)
- **Session shape**: `{ user: { id, email, name?, workspaceId } }` — `id` = Prisma User id
- **Session access**: `getServerSession(getAuthOptions())` (server), `useSession()` (client)
- **Sign out**: `signOut({ callbackUrl })` from `next-auth/react`

### User Provisioning (Critical)
- **Location**: `lib/auth.ts` — `provisionUser()`, `provisionUserFromEmail()`, `ensureDefaultWorkspaceForUser()`
- **Flow**: After OAuth or credentials sign-in, JWT callback calls `provisionUser()` which:
  1. Finds User by `googleSub` (OAuth) or email
  2. Creates or updates User in Prisma
  3. `ensureDefaultWorkspaceForUser()` creates workspace + membership if none
- **Result**: `session.user.id` = Prisma User id, `session.user.workspaceId` = workspace id

### Files Involved
| File | Role |
|------|------|
| `lib/auth.ts` | NextAuth config, providers, provisioning, `getAuthOptions` |
| `app/api/auth/[...nextauth]/route.ts` | NextAuth API handler |
| `app/api/auth/signup/route.ts` | Supabase signUp (email/password) |
| `lib/supabase.ts` | Server Supabase client (auth only) |
| `lib/env.ts` | Required env validation |
| `app/login/page.tsx` | `signIn("google")`, `signIn("credentials")` |
| `app/signup/page.tsx` | `signIn("google")`, fetch signup API, `signIn("credentials")` |
| `components/providers/SessionProvider.tsx` | NextAuth `SessionProvider` |
| `components/navigation/AuthNavLinks.tsx` | `useSession`, `signOut` |
| `components/navigation/MobileNavMenu.tsx` | `useSession`, `signOut` |
| `components/account/DeleteAccountButton.tsx` | `signOut` |
| `app/account/layout.tsx` | `getServerSession` |
| `app/account/page.tsx` | `getServerSession` |
| `app/account/projects/page.tsx` | `getServerSession` |
| `app/account/projects/[id]/page.tsx` | `getServerSession` |
| `app/account/projects/actions.ts` | `getServerSession` |
| `app/account/billing/page.tsx` | (likely) |
| `app/dashboard/layout.tsx` | `getServerSession` |
| `app/api/account/delete/route.ts` | `getServerSession` |
| `app/api/__sessioncheck/route.ts` | `getServerSession` |
| `proxy.ts` | `getToken` (NextAuth JWT) — **not wired as middleware** (no `middleware.ts`) |

### Env Variables
| Variable | Used for |
|----------|----------|
| `NEXTAUTH_URL` | NextAuth base URL, redirect URLs |
| `NEXTAUTH_SECRET` | JWT signing |
| `GOOGLE_CLIENT_ID` | NextAuth Google provider |
| `GOOGLE_CLIENT_SECRET` | NextAuth Google provider |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client |
| `POSTGRES_URL` | Prisma (app DB) |

### Current Login Flow
1. User clicks "Continue with Google" → `signIn("google", { callbackUrl })`
2. NextAuth redirects to Google OAuth
3. Google redirects to `/api/auth/callback/google`
4. NextAuth JWT callback: `provisionUser()` → Prisma User id in token
5. `ensureDefaultWorkspaceForUser()` → workspaceId in token
6. Redirect to `callbackUrl` (e.g. `/account`)

---

## 2. Target Architecture

### Auth Flow
- **Google**: `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } })`
- **Microsoft**: `supabase.auth.signInWithOAuth({ provider: "azure", options: { redirectTo } })`
- **Email/Password**: Same as today (Supabase signUp/signInWithPassword)

### Session
- Supabase Auth session in cookies (via `@supabase/ssr`)
- App session = Supabase session + derived Prisma User id + workspaceId

### User Provisioning
- After Supabase auth success, server-side: get Supabase user → `provisionUserFromSupabaseAuth()` → Prisma User id + workspaceId
- Same logic as today, just triggered from Supabase session instead of NextAuth

---

## 3. Migration Plan

### Phase 1: Add Supabase SSR
- Install `@supabase/ssr`
- Create `lib/supabase/client.ts` (browser client)
- Create `lib/supabase/server.ts` (server client with cookie handling)
- Create `lib/supabase/middleware.ts` (token refresh)

### Phase 2: Auth Callback & Provisioning
- Create `/api/auth/callback/route.ts` — Supabase OAuth callback (exchange code, redirect)
- Create `lib/auth-supabase.ts` — `provisionUserFromSupabaseAuth()`, `getAppSession()` (replaces getServerSession)

### Phase 3: Schema
- Add `supabaseUserId` to User (optional, for OAuth lookup)

### Phase 4: Login/Signup Pages
- Replace `signIn("google")` with `supabase.auth.signInWithOAuth({ provider: "google" })`
- Add "Continue with Microsoft" → `signInWithOAuth({ provider: "azure" })`
- Keep email/password flow; ensure provisioning runs after Supabase session exists

### Phase 5: Session Replacement
- Replace `getServerSession(getAuthOptions())` with `getAppSession()` everywhere
- Replace `useSession` with `useSupabaseSession()` hook (or Supabase's `useSession` + custom wrapper)
- Replace `signOut` with `supabase.auth.signOut()`

### Phase 6: Middleware
- Create `middleware.ts` using Supabase `updateSession` for auth + refresh

### Phase 7: Remove NextAuth
- Delete `app/api/auth/[...nextauth]/route.ts`
- Delete NextAuth from `lib/auth.ts` (keep provisioning logic, move to `lib/auth-supabase.ts`)
- Remove `SessionProvider` from layout (or replace with Supabase session provider)
- Remove `next-auth` from package.json
- Remove `proxy.ts` if unused
- Update env: remove `NEXTAUTH_*`, `GOOGLE_*`

---

## 4. Risks & Assumptions

- **Supabase Dashboard**: Google and Microsoft (Azure) providers must be configured in Supabase Auth settings.
- **Redirect URLs**: Supabase needs `https://yourdomain.com/api/auth/callback` (and localhost) in Redirect URLs.
- **Existing users**: Users with `googleSub` will be matched by email on first Supabase sign-in; we link `supabaseUserId`.
- **Email/password**: Already uses Supabase; no change to flow, only to how we read session and provision.
