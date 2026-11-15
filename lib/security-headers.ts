/**
 * The response headers this site sends on everything it serves itself (the
 * owner's security plan, item 7, 2026-11-15): `next.config.ts`'s `headers()`
 * puts them on pages, file routes, its own API routes, 404s and static files.
 * Two kinds pass through without them, pinned by the browser suite: the
 * config's redirects (a 308 with no body) and the `/api/platform` proxy to the
 * platform (JSON, never framed or shown as a page). Strict-Transport-Security
 * is not here: Vercel sends it. A route's own headers (the file routes'
 * `frame-ancestors 'self'` policy, `lib/file-view.ts`) stay as they are.
 *
 * The policy is report-only: the browser reports what breaks it and blocks
 * nothing, so it can be enforced in a later round on the evidence the browser
 * suite gathers (`e2e/accessibility-authenticated.spec.ts`). Its sources are
 * what the site loads today:
 * - script and style `'unsafe-inline'`: Next's inline scripts carry no nonce,
 *   the root layout's theme script is inline, and React and Framer Motion
 *   write style attributes; `next dev` alone adds `'unsafe-eval'`;
 * - img and frame `blob:`: a file or a run package is read here and shown
 *   from an object URL (`components/blocks/Picture.tsx`,
 *   `components/dashboard/FileView.tsx`, the package page); img `data:` for
 *   inline pictures;
 * - fonts are this origin's (`next/font` serves Inter itself);
 * - connect `https:`: an upload goes straight to the store, at the URL the
 *   platform signed (`putFileToSignedUrl` in `lib/platform-api.ts`), whose
 *   host the platform chooses; every other call is this origin's
 *   (`/api/platform`);
 * - frame protection is `'self'`, never `'none'`: the site frames its own
 *   files.
 *
 * The camera, the microphone, location and the Topics API are refused to
 * every frame: the site asks for none of them. A file input's `capture`
 * (`app/account/flows/RunFileField.tsx`) opens the device's own camera, which
 * no Permissions-Policy governs.
 *
 * Pure, and loaded by its unit test as it is: no React and no `@/` import.
 */

export type SecurityHeader = { key: string; value: string };

/** The report-only Content-Security-Policy, as one header value. */
export function contentSecurityPolicy(development = false): string {
  const directives: Array<[string, string[]]> = [
    ["default-src", ["'self'"]],
    [
      "script-src",
      ["'self'", "'unsafe-inline'", ...(development ? ["'unsafe-eval'"] : [])],
    ],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", ["'self'", "data:", "blob:"]],
    ["font-src", ["'self'"]],
    ["connect-src", ["'self'", "https:"]],
    ["frame-src", ["'self'", "blob:"]],
    ["worker-src", ["'self'"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", ["'self'"]],
  ];
  return directives
    .map(([name, sources]) => `${name} ${sources.join(" ")}`)
    .join("; ");
}

/** Every header, in the order `next.config.ts` sends them. */
export function securityHeaders(development = false): SecurityHeader[] {
  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
    },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    {
      key: "Content-Security-Policy-Report-Only",
      value: contentSecurityPolicy(development),
    },
  ];
}
