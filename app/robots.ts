import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/account", "/api", "/onboarding"],
    },
    sitemap: "https://autom8x.ai/sitemap.xml",
  };
}
