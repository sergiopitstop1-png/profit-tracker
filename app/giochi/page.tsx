import type { Metadata } from "next";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";

export const metadata: Metadata = {
  title: "Giochi | Sergio Apicella",
  description:
    "I giochini creati da Sergio: si giocano nel browser, da computer e da smartphone, senza installare niente.",
};

const games = [
  {
    title: "Salto Matto",
    section: "arcade",
    text: "Platform 2D: corri, salta sulla testa dei nemici, raccogli tutte le monete e arriva alla bandiera.",
    tags: ["Platform", "Tastiera e touch"],
    href: "/giochi/salto-matto",
    image: "/giochi/salto-matto-anteprima.jpg",
    alt: "Salto Matto: un omino con i capelli grigi corre su un prato al tramonto verso delle monete",
  },
  {
    title: "Falco '84",
    section: "arcade",
    text: "Sparatutto anni '80: pilota il tuo aereo, abbatti le ondate di nemici, raccogli i bonus e affronta il boss.",
    tags: ["Sparatutto", "Tastiera e touch"],
    href: "/giochi/falco-84",
    image: "/giochi/falco-84-anteprima.jpg",
    alt: "Falco '84: un aereo bianco spara a un grande aereo nemico viola sopra il mare",
  },
  {
    title: "Tetris",
    section: "arcade",
    text: "Il classico dei blocchi che cadono: completa le righe, tieni da parte un pezzo e resisti ai livelli più veloci.",
    tags: ["Classico", "Tastiera e touch"],
    href: "/giochi/tetris",
    image: "/giochi/tetris-anteprima.jpg",
    alt: "Tetris: il campo di gioco con i blocchi colorati e il pannello dei punti",
  },
  {
    title: "Occhio di Lince",
    section: "enigmistica",
    text: "Trova le differenze tra due quadri quasi identici. Ogni quadro è generato a caso, quindi non si ripete mai.",
    tags: ["Differenze", "Tastiera e touch"],
    href: "/giochi/occhio-di-lince",
    image: "/giochi/occhio-di-lince-anteprima.jpg",
    alt: "Occhio di Lince: due quadri di un villaggio al tramonto con differenze cerchiate in verde",
  },
  {
    title: "Cruciverba",
    section: "enigmistica",
    text: "Schemi veloci da 9×9, 11×11 e 13×13, con pochissime caselle nere. Ogni schema è nuovo: giocalo a schermo o stampalo.",
    tags: ["Cruciverba", "Tastiera e touch", "Stampabile"],
    href: "/giochi/cruciverba",
    image: "/giochi/cruciverba-anteprima.jpg",
    alt: "Cruciverba: una griglia 11×11 con parole incrociate e pochi quadratini neri",
  },
];

const sections = [
  { id: "arcade", title: "Arcade" },
  { id: "enigmistica", title: "Enigmistica" },
];

export default function GiochiPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-orange-950 text-white">
      <SiteHeader />

      <section className="mx-auto max-w-6xl px-6 py-20">
        <p className="text-sm uppercase tracking-[0.3em] text-lime-300">
          Giochi
        </p>

        <h1 className="mt-4 text-4xl font-bold md:text-6xl">
          I giochini che costruisco.
        </h1>

        <p className="mt-6 max-w-3xl text-lg leading-8 text-white/70">
          Si giocano nel browser, da computer e da smartphone, senza installare
          niente. Ne arriveranno altri, uno alla volta.
        </p>

        {sections.map((sec) => (
          <div key={sec.id} className="mt-14">
            <h2 className="text-2xl font-bold md:text-3xl">{sec.title}</h2>
            <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {games
              .filter((game) => game.section === sec.id)
              .map((game) => (
              <a
                key={game.href}
                href={game.href}
                className="group block overflow-hidden rounded-3xl border border-white/10 bg-white/5 transition hover:-translate-y-1 hover:border-lime-400/40 hover:bg-white/10"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={game.image}
                  alt={game.alt}
                  width={800}
                  height={448}
                  loading="lazy"
                  className="aspect-[800/448] w-full object-cover"
                />
                <div className="p-6">
                  <h3 className="text-2xl font-semibold">{game.title}</h3>
                  <p className="mt-3 leading-7 text-white/70">{game.text}</p>
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {game.tags.map((tag) => (
                      <li
                        key={tag}
                        className="rounded-full border border-white/15 px-3 py-1 text-xs uppercase tracking-[0.15em] text-white/60"
                      >
                        {tag}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-5 text-sm font-semibold text-lime-300 transition group-hover:text-lime-200">
                    Gioca →
                  </p>
                </div>
              </a>
            ))}
          </div>
          </div>
        ))}
      </section>

      <SiteFooter />
    </main>
  );
}
