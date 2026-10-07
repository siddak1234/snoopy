import type { NextConfig } from "next";
import { backendApiOrigin } from "./lib/backend-origin";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    const origin = backendApiOrigin();
    if (!origin) return [];
    return [
      {
        source: "/api/platform/:path*",
        destination: `${origin}/:path*`,
      },
    ];
  },
  async redirects() {
    return [
      // 2026-08 Nocturne revamp: industries + use cases folded into /solutions.
      {
        source: "/solutions/healthcare",
        destination: "/solutions#healthcare",
        permanent: true,
      },
      {
        source: "/solutions/finance",
        destination: "/solutions#finance",
        permanent: true,
      },
      {
        source: "/solutions/use-cases",
        destination: "/solutions#usecases",
        permanent: true,
      },
      {
        source: "/solutions/use-cases/:slug",
        destination: "/solutions#usecases",
        permanent: true,
      },
      {
        source: "/use-cases",
        destination: "/solutions#usecases",
        permanent: true,
      },
      {
        source: "/use-cases/:slug",
        destination: "/solutions#usecases",
        permanent: true,
      },
      { source: "/insights", destination: "/solutions", permanent: true },
      // 2026-08 Round 5R: signup merged into the single provider sign-in card.
      // The first sign-in creates the account, so a separate signup page only
      // duplicated it (query string, incl. ?callbackUrl=, passes through).
      { source: "/signup", destination: "/login", permanent: false },
      // The dashboard stub route was removed; the real app lives at /account.
      { source: "/dashboard", destination: "/account", permanent: false },
      // Saved-workflow deep links into the old public builder. The canvas was
      // removed with the account area's builder (`415e57a`), so a saved link
      // lands on the flows it could have started (register F53).
      {
        source: "/automation-builder",
        has: [{ type: "query", key: "id" }],
        destination: "/account/flows",
        permanent: false,
      },
      // 2026-10 BUILD-PLAN 24.11.11: Automations became Flows, and Projects
      // became Teams (a team is a project in the platform's contract). A saved
      // link lands on the same place under its new name.
      {
        source: "/account/automations",
        destination: "/account/flows",
        permanent: true,
      },
      {
        source: "/account/projects",
        destination: "/account/teams",
        permanent: true,
      },
      {
        source: "/account/projects/:id",
        destination: "/account/teams/:id",
        permanent: true,
      },
      // 2026-10 the owner's build 14 feedback #6: the platform's notification
      // emails link to `/runs/<id>` and `/approvals/<id>` on this origin
      // (`PRODUCT_ORIGIN`, backend `apps/runs/src/notifications.ts`), which no
      // page here served — every mailed link answered 404. A run's page and the
      // decisions waiting are in the account area; an email already sent lands
      // there too.
      {
        source: "/runs/:runId",
        destination: "/account/runs/:runId",
        permanent: false,
      },
      {
        source: "/approvals/:approvalId",
        destination: "/account/approvals",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
