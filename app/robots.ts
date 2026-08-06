import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/profit-tracker",
        "/proptracker",
        "/admin",
        "/api",
        "/login",
        "/register",
        "/reset-password",
        "/password-dimenticata",
      ],
    },
    sitemap: "https://sergioapicella.it/sitemap.xml",
  };
}
