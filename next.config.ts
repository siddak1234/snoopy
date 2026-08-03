import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
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
      // The dashboard stub route was removed; the real app lives at /account.
      { source: "/dashboard", destination: "/account", permanent: false },
    ];
  },
};

export default nextConfig;
