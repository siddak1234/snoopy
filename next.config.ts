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
      // Saved-workflow deep links into the old public builder: the canvas is
      // gated under /account now (query string, incl. ?id=, passes through
      // the login callback).
      {
        source: "/automation-builder",
        has: [{ type: "query", key: "id" }],
        destination: "/account/builder",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
