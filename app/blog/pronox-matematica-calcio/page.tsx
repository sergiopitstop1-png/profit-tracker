import SiteHeader from "../../components/SiteHeader";
import SiteFooter from "../../components/SiteFooter";

export default function PronoXArticlePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-orange-950 text-white">
      <SiteHeader />

      <article className="mx-auto max-w-4xl px-6 py-20">
        <p className="text-sm uppercase tracking-[0.3em] text-lime-300">
          PronoX
        </p>

        <h1 className="mt-4 text-4xl font-bold leading-tight md:text-6xl">
          PronoX: quando la matematica incontra il calcio
        </h1>

        <p className="mt-5 text-white/50">di Sergio Apicella</p>

        <p className="mt-8 text-lg leading-8 text-white/70">
          Quante volte hai sentito qualcuno dire “secondo me vince il Milan
          stasera”? Quante volte quella stessa persona ha perso la schedina?
          Il problema non è la passione per il calcio. Il problema è che il
          cervello umano segue istinto, ricordi selettivi e sensazioni. I numeri,
          invece, non si emozionano.
        </p>

        <section className="mt-14 space-y-6">
          <h2 className="text-3xl font-bold">Come nasce PronoX</h2>

          <p className="leading-8 text-white/70">
            Non sono partito dall’idea di fare “un sito di pronostici”. Sono
            partito da una domanda più scomoda: è possibile trovare valore nei
            mercati dei bookmaker in modo sistematico?
          </p>

          <p className="leading-8 text-white/70">
            La risposta onesta è: raramente, ma sì, se sai dove cercare. I
            bookmaker non sono onniscienti. A volte offrono quote superiori alla
            probabilità reale di un evento. Quel momento si chiama value bet.
          </p>

          <div className="rounded-3xl border border-lime-400/20 bg-lime-500/10 p-8">
            <p className="text-xl font-semibold leading-9">
              PronoX non è una sfera di cristallo. È un motore matematico che
              analizza dati reali e cerca scarti tra probabilità calcolata e
              probabilità implicita nelle quote.
            </p>
          </div>
        </section>

        <section className="mt-14 space-y-6">
          <h2 className="text-3xl font-bold">Come funziona il modello</h2>

          <p className="leading-8 text-white/70">
            Al cuore di PronoX c’è il modello di Poisson con correzione
            Dixon-Coles. Ogni squadra ha coefficienti di attacco e difesa
            calcolati sui dati stagionali, con maggiore peso alle partite più
            recenti.
          </p>

          <p className="leading-8 text-white/70">
            Da questi coefficienti il sistema calcola i gol attesi, i cosiddetti
            lambda, e da lì ricava le probabilità dei principali mercati:
            1X2, Over/Under 2.5, BTTS, Under 2.5 e Over 0.5 primo tempo.
          </p>

          <ul className="list-disc space-y-3 pl-6 text-white/70">
            <li>Forma recente degli ultimi 5 match</li>
            <li>Vantaggio casalingo reale della squadra di casa</li>
            <li>H2H degli ultimi 6 scontri diretti</li>
            <li>Correzione Dixon-Coles per i punteggi bassi</li>
          </ul>
        </section>

        <section className="mt-14 space-y-6">
          <h2 className="text-3xl font-bold">La parte che fa la differenza</h2>

          <p className="leading-8 text-white/70">
            Avere una probabilità è solo metà del lavoro. L’altra metà è
            confrontarla con la quota del bookmaker.
          </p>

          <div className="rounded-2xl border border-orange-400/20 bg-orange-500/10 p-8 text-center">
            <p className="text-2xl font-bold">
              Probabilità reale VS probabilità implicita della quota
            </p>
          </div>

          <p className="leading-8 text-white/70">
            Se il modello assegna a un evento il 65% di probabilità, la quota
            equa è 1 / 0.65, cioè circa 1.54. Se il bookmaker offre 1.70, stai
            ricevendo più del dovuto. Quello è expected value positivo.
          </p>
        </section>

        <section className="mt-14 space-y-6">
          <h2 className="text-3xl font-bold">I numeri parlano</h2>

          <p className="leading-8 text-white/70">
            Nelle prime settimane di utilizzo reale, con soglie ottimizzate,
            PronoX ha raggiunto un win rate del 70% su 71 pronostici verificati.
            Non è ancora il punto d’arrivo, ma è una base concreta su cui
            continuare a lavorare.
          </p>

          <p className="leading-8 text-white/70">
            La singola partita può sempre andare male. Ma su grandi numeri,
            quando il valore atteso è positivo, la matematica inizia a lavorare
            dalla tua parte.
          </p>
        </section>

        <section className="mt-14 space-y-6">
          <h2 className="text-3xl font-bold">Cosa copre PronoX oggi</h2>

          <div className="grid gap-5 md:grid-cols-2">
            {[
              "19 campionati analizzati",
              "Modello Poisson + Dixon-Coles",
              "Archivio pronostici",
              "Verifica automatica risultati",
              "Statistiche win rate",
              "Interfaccia mobile friendly",
            ].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-white/10 bg-white/5 p-5"
              >
                <p className="font-semibold text-white/80">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14 space-y-6">
          <h2 className="text-3xl font-bold">Cosa arriverà presto</h2>

          <ul className="list-disc space-y-3 pl-6 text-white/70">
            <li>Integrazione più avanzata delle quote bookmaker</li>
            <li>Kelly Criterion per la puntata ottimale</li>
             <li>Tennis — modello probabilistico con rimozione del vig e identificazione VALUE</li>
            <li>Statistiche tennis per superficie,(Sinner sulla terra vs Sinner sull'erba — due giocatori diversi)</li>
            <li>Basket con modello sui punti totali</li>
            <li>Storico performance per mercato e campionato</li>
          </ul>
        </section>

        <section className="mt-14 rounded-3xl border border-orange-400/20 bg-orange-500/10 p-8">
          <h2 className="text-3xl font-bold">
            Una cosa che non troverai qui
          </h2>

          <p className="mt-6 leading-8 text-white/75">
            Pronostici sicuri al 100%. Chiunque te li venda sta mentendo. Il
            calcio è imprevedibile per definizione. PronoX non promette certezze:
            promette metodo, trasparenza sui numeri e un vantaggio statistico da
            cercare nel lungo periodo.
          </p>

          <a
            href="/oggi"
            className="mt-8 inline-block rounded-2xl bg-orange-500 px-6 py-4 font-semibold text-white transition hover:scale-[1.02] hover:bg-orange-400"
          >
            Apri PronoX
          </a>
        </section>
      </article>

      <SiteFooter />
    </main>
  );
}
