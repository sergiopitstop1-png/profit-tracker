import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const SITE = "https://sergioapicella.it";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { data: posts } = await supabase
    .from("blog_posts")
    .select("slug, created_at")
    .eq("published", true);

  const blogUrls: MetadataRoute.Sitemap = (posts || []).map((p) => ({
    url: `${SITE}/blog/${p.slug}`,
    lastModified: new Date(p.created_at),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const staticUrls: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 1.0 },
    { url: `${SITE}/blog`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 0.9 },
    { url: `${SITE}/chi-sono`, lastModified: new Date(), changeFrequency: "yearly" as const, priority: 0.5 },
    { url: `${SITE}/servizi`, lastModified: new Date(), changeFrequency: "yearly" as const, priority: 0.5 },
    { url: `${SITE}/progetti`, lastModified: new Date(), changeFrequency: "yearly" as const, priority: 0.5 },
  ];

  return [...staticUrls, ...blogUrls];
}
