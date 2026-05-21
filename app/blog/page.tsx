import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";

const posts = [
  {
    title: "Salernitana in semifinale: al Benelli una vittoria di sostanza",
    category: "Analisi Calcio",
    excerpt:
      "Ravenna-Salernitana 0-2. Villa e Inglese trascinano i granata alle semifinali playoff di Serie C. Analisi tattica e obiettiva della partita.",
    href: "/blog/salernitana-playoff-serie-c-2026",
  },
  {
    title: "Juventus, un'occasione sprecata. Napoli, lezione di solidità nonostante tutto",
    category: "Analisi Calcio",
    excerpt:
      "Champions persa in casa contro la Fiorentina. Napoli secondo nonostante infortuni e assenze. Due stagioni agli antipodi.",
    href: "/blog/juventus-napoli-stagione-2026",
  },
  {
    title: "Aston Villa campione d'Europa: 3-0 al Friburgo nella finale di Istanbul",
    category: "Analisi Calcio",
    excerpt:
      "A 44 anni dalla Coppa dei Campioni, l'Aston Villa torna a vincere in Europa. Gol di Tielemans, Buendía e Rogers. I dati che avevano previsto tutto.",
    href: "/blog/europa-league-finale-2026",
  },
  {
    title: "Playoff Serie B 2026: Monza e Catanzaro in finale per l'ultimo posto in A",
    category: "Analisi Calcio",
    excerpt:
      "Venezia e Frosinone già promosse. La terza si decide il 24 e 29 maggio. Regolamento, dati e pronostici sulla doppia finale.",
    href: "/blog/playoff-serie-b-2026",
  },
  {
    title: "Come trovare partite Over 0.5 Primo Tempo con valore statistico",
    category: "Analisi Calcio",
    excerpt:
      "Strategie, Poisson, statistiche offensive e lettura delle quote per individuare partite ad alta probabilità.",
    href: "/blog/over-05-primo-tempo",
  },
  {
    title: "Value Bet: cosa sono e perché quasi tutti le usano male",
    category: "Strategie",
    excerpt:
      "Capire il valore reale di una quota è molto più importante del semplice pronostico.",
    href: "/blog/value-bet-spiegazione",
  },
  {
    title: "PronoX: quando la matematica incontra il calcio",
    category: "PronoX",
    excerpt:
      "Il motore matematico dietro PronoX: Poisson, Dixon-Coles, value betting e probabilità reali.",
    href: "/blog/pronox-matematica-calcio",
  },
];

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
