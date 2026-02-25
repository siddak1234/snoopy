import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // @ts-expect-error turbopack is not yet in NextConfig type
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
