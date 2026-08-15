# Microsoft login boundary

Microsoft login is backend-mediated OAuth. Snoopy obtains the published provider
policy from Edge and starts the approved same-origin login route; it contains no
OAuth client ID, client secret, Supabase SDK, PKCE state, token exchange, or
callback implementation.

Identity-provider registration, Entra tenant policy, Supabase adapter settings,
and redirect allowlists are owned by the backend/deployment environment. When a
disposable non-production website origin is used for OAuth observation, that
environment must allow `http://127.0.0.1:3001` explicitly. Do not record the
provider configuration or any secret in this repository.

Login identity is separate from Microsoft/Graph connector authorization. The
latter follows the published Connections contract and stores credentials only in
the backend-owned secret boundary.
