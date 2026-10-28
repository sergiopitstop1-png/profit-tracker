import type { Metadata } from "next";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";
import GiochiSezioni from "./GiochiSezioni";

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
  {
    title: "Sudoku",
    section: "enigmistica",
    text: "Schemi a soluzione unica in tre livelli, con note a matita, aiuto e stampa. Ogni schema è nuovo.",
    tags: ["Sudoku", "Tastiera e touch", "Stampabile"],
    href: "/giochi/sudoku",
    image: "/giochi/sudoku-anteprima.jpg",
    alt: "Sudoku: una griglia 9×9 con alcuni numeri già inseriti",
  },
  {
    title: "Crucipuzzle",
    section: "enigmistica",
    text: "Trascina il dito sulle lettere per trovare le parole nascoste, anche in diagonale e al contrario nei livelli più difficili.",
    tags: ["Parole nascoste", "Tastiera e touch", "Stampabile"],
    href: "/giochi/crucipuzzle",
    image: "/giochi/crucipuzzle-anteprima.jpg",
    alt: "Crucipuzzle: una griglia di lettere con alcune parole evidenziate a colori",
  },
  {
    title: "Anagrammi",
    section: "enigmistica",
    text: "Riordina le lettere e indovina la parola partendo dalla definizione. Otto parole a partita, con aiuti e punteggio.",
    tags: ["Parole", "Tastiera e touch"],
    href: "/giochi/anagrammi",
    image: "/giochi/anagrammi-anteprima.jpg",
    alt: "Anagrammi: lettere sparse da rimettere in ordine nelle caselle della risposta",
  },
];

const sections = [
  {
    id: "arcade",
    title: "Arcade",
    description: "Platform, sparatutto e classici da giocare con riflessi e fantasia.",
  },
  {
    id: "enigmistica",
    title: "Enigmistica",
    description: "Cruciverba, sudoku, crucipuzzle e giochi di parole, anche da stampare.",
  },
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

        <GiochiSezioni games={games} sections={sections} />
      </section>

      <SiteFooter />
    </main>
  );
}
