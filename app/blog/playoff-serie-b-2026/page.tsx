import SiteHeader from "../../components/SiteHeader";
import SiteFooter from "../../components/SiteFooter";

export default function PlayoffSerieB2026() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-orange-950 text-white">
      <SiteHeader />

      <article className="mx-auto max-w-4xl px-6 py-20">

        <p className="text-sm uppercase tracking-[0.3em] text-orange-300">
          Analisi Calcio
        </p>

        <h1 className="mt-4 text-4xl font-bold leading-tight md:text-6xl">
          Playoff Serie B 2026: Monza e Catanzaro in finale per l'ultimo posto in A
        </h1>

        <p className="mt-5 text-white/50">
          di Sergio Apicella · 21 maggio 2026
        </p>

        <p className="mt-8 text-lg leading-8 text-white/70">
          Venezia e Frosinone sono già in Serie A. Il terzo posto è ancora da
          assegnare. Monza e Catanzaro si sfideranno nella doppia finale del 24
          e 29 maggio per conquistare l'ultimo pass per la massima serie.
          Ecco come ci sono arrivate, e cosa dicono i numeri.
        </p>

        <div className="mt-10 rounded-3xl border border-orange-400/20 bg-orange-500/10 p-8">
          <p className="text-xl font-semibold leading-9">
            Nei playoff di Serie B non esistono supplementari né rigori.
            La classifica regolare decide tutto in caso di parità. Un sistema che
            premia la continuità stagionale più del singolo risultato.
          </p>
        </div>

        <section className="mt-16 space-y-6">
          <h2 className="text-3xl font-bold">Il tabellone: come ci siamo arrivati</h2>
          <p className="leading-8 text-white/70">
            Il percorso verso la finale è stato definito dal turno preliminare
            in gara unica, poi dalle semifinali di andata e ritorno.
          </p>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
            <div>
              <p className="text-sm uppercase tracking-widest text-orange-300 mb-2">Turno Preliminare</p>
              <p className="text-white/70">Modena - Juve Stabia <span className="text-white font-bold">0-1</span></p>
              <p className="text-white/70">Catanzaro - Avellino <span className="text-white font-bold">3-0</span></p>
            </div>
            <div>
              <p className="text-sm uppercase tracking-widest text-orange-300 mb-2">Semifinali</p>
              <p className="text-white/70">Catanzaro - Palermo <span className="text-white font-bold">3-0</span> (andata) · Palermo - Catanzaro <span className="text-white font-bold">2-0</span> (ritorno) → passa Catanzaro</p>
              <p className="text-white/70">Juve Stabia - Monza <span className="text-white font-bold">2-2</span> (andata) · Monza - Juve Stabia <span className="text-white font-bold">2-1</span> (ritorno) → passa Monza</p>
            </div>
            <div>
              <p className="text-sm uppercase tracking-widest text-orange-300 mb-2">Finale</p>
              <p className="text-white/70">Andata: 24 maggio · Ritorno: 29 maggio</p>
            </div>
          </div>
        </section>

        <section className="mt-16 space-y-6">
          <h2 className="text-3xl font-bold">Catanzaro: il metodo dei calabresi</h2>
          <p className="leading-8 text-white/70">
            Il Catanzaro ha eliminato Avellino e poi Palermo con una solidità
            difensiva notevole. Il 3-0 all'andata contro il Palermo — con Iemmello
            protagonista a segno al 1' e al 15' — ha di fatto chiuso la
            qualificazione già prima del ritorno.
          </p>
          <p className="leading-8 text-white/70">
            La squadra calabrese ha chiuso la regular season con 59 punti,
            dietro le prime quattro ma con una coerenza difensiva che nei playoff
            diventa un'arma decisiva: nei match a eliminazione diretta, chi
            subisce meno gol gestisce il vantaggio senza i rigori.
          </p>
          <div className="rounded-2xl border border-lime-400/20 bg-lime-500/10 p-8 text-center">
            <p className="text-3xl font-bold">6 gol fatti · 2 subiti</p>
            <p className="mt-2 text-white/60 text-sm">Catanzaro nei playoff fino alla finale</p>
          </div>
        </section>

        <section className="mt-16 space-y-6">
          <h2 className="text-3xl font-bold">Monza: la rimonta sofferta contro la Juve Stabia</h2>
          <p className="leading-8 text-white/70">
            Il Monza ha vissuto la semifinale più combattuta. Dopo il 2-2
            dell'andata a Castellammare, il ritorno in casa è stato deciso
            da Cutrone: doppietta all'85' e al 97', con il gol della speranza
            di Burnete al 90' che ha tenuto i cuori in sospeso fino all'ultimo.
          </p>
          <p className="leading-8 text-white/70">
            Il club brianzolo, terzo classificato con 76 punti, si presenta alla
            finale da testa di serie: in caso di parità aggregata, passerebbe
            il Monza grazie al miglior piazzamento in campionato.
          </p>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
            <p className="text-xl font-semibold">
              In un sistema senza rigori, il vantaggio della classifica regolare
              vale oro. Il Monza lo sa e probabilmente costruirà la sua strategia
              di finale intorno a questo dato.
            </p>
          </div>
        </section>

        <section className="mt-16 space-y-6">
          <h2 className="text-3xl font-bold">Il regolamento che cambia tutto</h2>
          <p className="leading-8 text-white/70">
            Vale la pena capire le regole perché influenzano le scelte tattiche
            delle due squadre in modo profondo.
          </p>
          <ul className="list-disc space-y-3 pl-6 text-white/70">
            <li>Finale in gara di andata e ritorno</li>
            <li>No supplementari, no rigori in caso di parità aggregata</li>
            <li>In caso di parità, va in Serie A la squadra meglio classificata in regular season</li>
            <li>Il Monza (3°) batte il Catanzaro (5°) in caso di parità</li>
          </ul>
          <p className="leading-8 text-white/70">
            Questo significa che il Catanzaro deve necessariamente vincere
            almeno una delle due partite in modo netto. Un pareggio complessivo
            non basta. Il Monza, invece, può anche accontentarsi di un doppio 0-0.
          </p>
        </section>

        <section className="mt-16 space-y-6">
          <h2 className="text-3xl font-bold">Cosa dice la statistica sulla finale</h2>
          <p className="leading-8 text-white/70">Il Monza parte favorito per tre motivi oggettivi:</p>
          <ul className="list-disc space-y-3 pl-6 text-white/70">
            <li>Vantaggio di classifica (76 vs 59 punti in regular season)</li>
            <li>Ritorno in casa propria il 29 maggio</li>
            <li>Qualità di rosa superiore per valore di mercato</li>
          </ul>
          <p className="leading-8 text-white/70">
            Il Catanzaro, però, ha dimostrato nei playoff una capacità di
            gestione difensiva fuori dal comune. Il 3-0 al Palermo — squadra
            con 72 punti in campionato — è stato uno degli scorpioni statistici
            del turno: nessuno lo aveva pronosticato con quel margine.
          </p>
          <p className="leading-8 text-white/70">
            Nei playoff il campione di dati è piccolo. La varianza aumenta.
            Ed è proprio qui che i modelli probabilistici vanno usati con cautela.
          </p>
        </section>

        <section className="mt-16 rounded-3xl border border-lime-400/20 bg-lime-500/10 p-8">
          <h2 className="text-3xl font-bold">Conclusione</h2>
          <p className="mt-6 leading-8 text-white/75">
            La finale dei playoff di Serie B 2026 è tra le più equilibrate degli
            ultimi anni. Monza favorito per struttura e regolamento, Catanzaro
            outsider credibile per solidità difensiva e inerzia psicologica.
          </p>
          <p className="mt-6 leading-8 text-white/75">
            Una finale senza reti di scarto potrebbe valere una promozione intera.
            Andata il 24 maggio, ritorno il 29. Tutto ancora da decidere.
          </p>
          <a href="/oggi" className="mt-8 inline-block rounded-2xl bg-orange-500 px-6 py-4 font-semibold text-white transition hover:scale-[1.02] hover:bg-orange-400">
            Analizza le partite con PronoX
          </a>
        </section>

      </article>
      <SiteFooter />
    </main>
  );
}
