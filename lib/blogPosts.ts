// Elenco unico degli articoli del blog.
// Sia app/page.tsx (home, mostra gli ultimi 3) sia app/blog/page.tsx
// (mostra tutti) leggono da qui — aggiungere un articolo qui lo fa
// comparire automaticamente in entrambi i posti, senza doverlo
// aggiungere a mano in due file diversi.
//
// Il più recente va sempre in cima all'array.

export const posts = [
  {
    title: "Mondiale 2026: il torneo che ha cambiato il calcio",
    category: "Analisi Calcio",
    excerpt:
      "La Spagna sul tetto del mondo, il tramonto di Messi, l'ennesima consacrazione di Mbappé e il futuro già iniziato. Il racconto completo del torneo della transizione.",
    href: "/blog/mondiale-2026-spagna-campione",
  },
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
