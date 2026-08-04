import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";
import { posts } from "../../lib/blogPosts";

export default function BlogPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-orange-950 text-white">
      <SiteHeader />

      <section className="mx-auto max-w-6xl px-6 py-20">

        <p className="text-sm uppercase tracking-[0.3em] text-orange-300">
          Blog
        </p>

        <h1 className="mt-4 text-4xl font-bold md:text-6xl">
          Idee, strategie e sistemi operativi.
        </h1>

        <p className="mt-6 max-w-3xl text-lg leading-8 text-white/70">
          Analisi statistiche, value bet, automazioni, AI, organizzazione
          operativa e costruzione di strumenti digitali.
        </p>

        <div className="mt-14 space-y-6">
          {posts.map((post) => (
            <a
              key={post.title}
              href={post.href}
              className="block rounded-3xl border border-white/10 bg-white/5 p-8 transition hover:-translate-y-1 hover:border-orange-400/40 hover:bg-white/10"
            >
              <p className="text-sm uppercase tracking-[0.2em] text-orange-300">
                {post.category}
              </p>
              <h2 className="mt-3 text-2xl font-bold">
                {post.title}
              </h2>
              <p className="mt-4 max-w-3xl leading-8 text-white/65">
                {post.excerpt}
              </p>
              <p className="mt-5 text-sm font-semibold text-orange-300">
                Leggi articolo →
              </p>
            </a>
          ))}
        </div>
        

      </section>

      <SiteFooter />
    </main>
  );
}
