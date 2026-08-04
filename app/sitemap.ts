import type { MetadataRoute } from "next";

const BASE_URL = "https://autom8x.ai";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}/solutions`, changeFrequency: "weekly", priority: 0.9 },
    {
      url: `${BASE_URL}/automation-builder`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    { url: `${BASE_URL}/contact`, changeFrequency: "monthly", priority: 0.7 },
  ];
}
