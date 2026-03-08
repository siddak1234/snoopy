# Microsoft (Azure) OAuth – Protocol and Setup

This app uses Supabase Auth with the **Azure** provider (`provider: "azure"`) for "Continue with Microsoft" and "Sign up with Microsoft". The following protocol and configuration are required for user creation and correct behavior.

## Tenant: use `common`

- **Supabase** uses the **Microsoft common tenant** by default: `https://login.microsoftonline.com/common`.
- **Common** allows both personal Microsoft accounts (e.g. Outlook, Live) and work/school (Azure AD) accounts to sign in. It is the correct choice for a public "Continue with Microsoft" flow.
- In **Supabase Dashboard → Authentication → Providers → Azure**:
  - Leave **Azure Tenant URL** empty to use the default (`common`), or set explicitly to:
    - `https://login.microsoftonline.com/common`
  - Do **not** set a single-tenant URL (e.g. `https://login.microsoftonline.com/<your-tenant-id>`) unless you intend to restrict sign-in to that organization only.

## Required: `email` scope

- **Supabase Auth requires a valid email from Azure to create the user.** If the `email` scope is not requested, Azure may not return the email claim and Supabase will not create a user.
- All Microsoft OAuth entry points in this codebase request `email openid`:
  - **Login**: `app/login/page.tsx` – `OAuthButton` with `provider="azure"` uses `scopes: "email openid"`.
  - **Signup**: `app/signup/page.tsx` – "Sign up with Microsoft" uses `scopes: "email openid"`.
  - **Link account**: `components/account/LinkedAccountsSection.tsx` – `linkIdentity({ provider: "azure", options: { ..., scopes: "email openid" } })`.

## Azure app registration (Redirect URI)

- In **Azure Portal → Microsoft Entra ID → App registrations → your app**:
  - **Redirect URI** must be the **Supabase** callback URL, not this app’s URL:
    - `https://<project-ref>.supabase.co/auth/v1/callback`
  - Replace `<project-ref>` with your Supabase project reference (Dashboard → Project Settings → General).
- For local development, Azure does not allow `127.0.0.1`; use `localhost`. Configure Supabase local API URL in `config.toml` if needed (see Supabase Azure docs).

## This app’s redirect URL

- After Azure and Supabase complete the OAuth flow, Supabase redirects the user to **this app’s** callback URL, which must be in Supabase’s allow list:
  - **Supabase Dashboard → Authentication → URL Configuration → Redirect URLs**
  - Add e.g. `https://yourdomain.com/auth/callback` and `http://localhost:3000/auth/callback` (or a wildcard like `http://localhost:3000/**`).

## Provider identifier in code

- Supabase’s provider id for Microsoft is **`azure`** (not `microsoft`). All code uses `provider: "azure"`.
- Identity and JWT claims may expose `azure`, `azure_ad`, or `microsoft`; `LinkedAccountsSection` normalizes these to a single "Microsoft" display and linking state.

## Summary checklist

- [ ] Supabase Azure provider: Tenant URL empty or `https://login.microsoftonline.com/common`.
- [ ] All `signInWithOAuth` and `linkIdentity` calls for Azure pass `scopes: "email openid"`.
- [ ] Azure app Redirect URI = `https://<project-ref>.supabase.co/auth/v1/callback`.
- [ ] Supabase Redirect URLs include this app’s `/auth/callback` URL.
