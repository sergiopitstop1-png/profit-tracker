import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import SiteHeader from "../../components/SiteHeader";
import SiteFooter from "../../components/SiteFooter";
import { renderArticleContent } from "../../../lib/renderArticle";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const revalidate = 60;

async function getPost(slug: string) {
  const { data } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .single();
  return data;
}

// Titolo e descrizione che Google mostra nei risultati di ricerca, e che
// vengono usati anche per l'anteprima quando l'articolo viene condiviso
// su WhatsApp/Facebook/Telegram ecc.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return {};

  return {
    title: `${post.title} | Sergio Apicella`,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      url: `https://sergioapicella.it/blog/${post.slug}`,
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) return notFound();

  return (
    <main className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-orange-950 text-white">
      <SiteHeader />

      <article className="mx-auto max-w-4xl px-6 py-20">

        <p className="text-sm uppercase tracking-[0.3em] text-orange-300">
          {post.category}
        </p>

        <h1 className="mt-4 text-4xl font-bold leading-tight md:text-6xl">
          {post.title}
        </h1>

        <p className="mt-5 text-white/50">
          di {post.author || "Sergio Apicella"} · {new Date(post.created_at).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}
        </p>

        {renderArticleContent(post.content || "")}

        {post.cta_label && post.cta_url && (
          <div className="mt-16 rounded-3xl border border-lime-400/20 bg-lime-500/10 p-8 text-center">
            <a
              href={post.cta_url}
              className="inline-block rounded-2xl bg-orange-500 px-6 py-4 font-semibold text-white transition hover:scale-[1.02] hover:bg-orange-400"
            >
              {post.cta_label}
            </a>
          </div>
        )}

      </article>

      <SiteFooter />
    </main>
  );
}
