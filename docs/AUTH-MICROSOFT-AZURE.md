# Microsoft login through Supabase Auth

Status: **Backend-mediated OAuth-only design**
Last verified against code: **2026-08-06**

The website displays Microsoft as provider ID `microsoft`. Only
`snoopy-backend` maps it to Supabase's internal provider ID `azure`, requests
`openid email`, owns PKCE/code exchange, and stores the resulting login session.
Snoopy contains no Supabase SDK or provider secret.

## Redirect chain

1. Browser opens
   `/api/platform/v1/auth/oauth/microsoft/start?return_to=/account`.
2. Backend starts Supabase Azure OAuth with PKCE.
3. Microsoft Entra redirects to the Supabase Auth callback:
   `https://<project-ref>.supabase.co/auth/v1/callback`.
4. Supabase redirects to the exact first-party backend gateway callback:
   `https://www.autom8x.ai/api/platform/v1/auth/oauth/callback`.
5. Backend exchanges the code and sets host-only HttpOnly cookies.

## Configuration checklist

- [ ] Create the Microsoft Entra application for the intended account audience.
- [ ] Set its web redirect URI to
      `https://<project-ref>.supabase.co/auth/v1/callback`.
- [ ] Enable Supabase Authentication → Providers → Azure and store the Entra
      client ID/secret there.
- [ ] Select and document the Entra tenant/audience policy. Do not infer `common`
      versus tenant-restricted behavior from old code.
- [ ] Add the exact Autom8x gateway callback to Supabase's redirect allowlist.
- [ ] Configure the backend identity variable group; do not put these values in
      Snoopy/Vercel except `BACKEND_API_ORIGIN`.
- [ ] Verify email/issuer claims and account-linking behavior in a non-production
      project before enabling production traffic.

## Boundaries

- Microsoft login identity does not grant Microsoft 365 automation access.
- Outlook/Graph connector consent belongs to the future Connection service and
  uses capability-derived scopes and separately vaulted delegated credentials.
- Native app redirect/session behavior is not configured by this website guide.

The governing decision is
[`ADR-0008`](../../snoopy-backend/docs/adr/0008-backend-mediated-oauth-login.md).
