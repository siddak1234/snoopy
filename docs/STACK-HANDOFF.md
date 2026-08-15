# Website handoff

This is a handoff for the website boundary, not a guide for provisioning cloud
resources. The current implementation uses Next.js 16, React 19, TypeScript,
Tailwind 4, and the Nocturne design system in `app/globals.css` and
`components/ui`.

The website consumes typed public Edge API contracts and has exactly one
configuration setting: `BACKEND_API_ORIGIN`. It must not receive database,
Supabase, object-store, OAuth-provider, or execution credentials.

For local work, install dependencies, copy `.env.example`, and run the checks
in the README. For container work, start the backend platform stack first and
then run `docker compose up -d --build web`. Deployment resource configuration,
provider registration, and secret-manager integration belong to the deployment
and backend owners.
