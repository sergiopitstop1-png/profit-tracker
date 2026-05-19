import SiteHeader from "../../components/SiteHeader";
import SiteFooter from "../../components/SiteFooter";

export default function ArticlePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-orange-950 text-white">
      <SiteHeader />

      <article className="mx-auto max-w-4xl px-6 py-20">

        <p className="text-sm uppercase tracking-[0.3em] text-orange-300">
          Analisi Calcio
        </p>

        <h1 className="mt-4 text-4xl font-bold leading-tight md:text-6xl">
          Come trovare partite Over 0.5 Primo Tempo con valore statistico
        </h1>
        <p className="mt-5 text-white/50">
  di Sergio Apicella
</p>

        <p className="mt-6 text-lg leading-8 text-white/70">
          L’Over 0.5 Primo Tempo è uno dei mercati più giocati nel calcio live e pre-match.
          Ma la differenza tra giocare “a sensazione” e trovare davvero valore statistico è enorme.
        </p>

        <div className="mt-10 rounded-3xl border border-orange-400/20 bg-orange-500/10 p-8">
          <p className="text-xl font-semibold leading-9">
            Il vero obiettivo non è indovinare un gol.
            È trovare quote dove la probabilità reale è superiore a quella proposta dal bookmaker.
          </p>
        </div>

        <section className="mt-16 space-y-6">

          <h2 className="text-3xl font-bold">
            Perché l’Over 0.5 HT è così interessante
          </h2>

          <p className="leading-8 text-white/70">
            Il mercato Over 0.5 HT si basa su un concetto semplice:
            serve almeno un gol nel primo tempo.
          </p>

          <p className="leading-8 text-white/70">
            Tuttavia, dietro questa apparente semplicità si nasconde un’enorme differenza tra:
          </p>

          <ul className="list-disc space-y-3 pl-6 text-white/70">
            <li>partite realmente aggressive</li>
            <li>match con ritmo lento</li>
            <li>squadre che segnano presto</li>
            <li>squadre che entrano in partita lentamente</li>
          </ul>

        </section>

        <section className="mt-16 space-y-6">

          <h2 className="text-3xl font-bold">
            Le statistiche più importanti
          </h2>

          <p className="leading-8 text-white/70">
            Per trovare partite con valore reale bisogna guardare diversi fattori contemporaneamente.
          </p>

          <div className="grid gap-6 md:grid-cols-2">

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-xl font-semibold text-orange-300">
                ⚽ Media gol
              </h3>

              <p className="mt-4 leading-7 text-white/65">
                Squadre con alta produzione offensiva aumentano la probabilità di vedere un gol entro il 45° minuto.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-xl font-semibold text-orange-300">
                📊 Forma recente
              </h3>

              <p className="mt-4 leading-7 text-white/65">
                Le ultime partite spesso contano più delle statistiche stagionali complete.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-xl font-semibold text-orange-300">
                🔥 Ritmo offensivo
              </h3>

              <p className="mt-4 leading-7 text-white/65">
                Alcune squadre partono fortissimo nei primi 20 minuti, altre crescono lentamente.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-xl font-semibold text-orange-300">
                🧠 Motivazioni
              </h3>

              <p className="mt-4 leading-7 text-white/65">
                Classifica, necessità di vittoria e situazione del campionato influenzano enormemente il ritmo iniziale.
              </p>
            </div>

          </div>

        </section>

        <section className="mt-16 space-y-6">

          <h2 className="text-3xl font-bold">
            Dove sbagliano quasi tutti
          </h2>

          <p className="leading-8 text-white/70">
            Uno degli errori più comuni è guardare solo le quote basse.
          </p>

          <p className="leading-8 text-white/70">
            Una quota 1.25 non significa automaticamente alta probabilità reale.
            A volte il bookmaker incorpora margini enormi e il valore sparisce completamente.
          </p>

          <p className="leading-8 text-white/70">
            Il concetto corretto è confrontare:
          </p>

          <div className="rounded-2xl border border-lime-400/20 bg-lime-500/10 p-8 text-center">
            <p className="text-2xl font-bold">
              Probabilità reale VS probabilità implicita della quota
            </p>
          </div>

        </section>

        <section className="mt-16 space-y-6">

          <h2 className="text-3xl font-bold">
            Il ruolo dei modelli statistici
          </h2>

          <p className="leading-8 text-white/70">
            Sistemi basati su Poisson, forma squadre, expected goals e modelli probabilistici permettono di stimare il numero di gol attesi in una partita.
          </p>

          <p className="leading-8 text-white/70">
            Da queste informazioni è possibile costruire probabilità più realistiche rispetto alla semplice lettura delle quote bookmaker.
          </p>

        </section>

        <section className="mt-16 rounded-3xl border border-orange-400/20 bg-orange-500/10 p-8">

          <h2 className="text-3xl font-bold">
            Conclusione
          </h2>

          <p className="mt-6 leading-8 text-white/75">
            Trovare valore nell’Over 0.5 Primo Tempo non significa cercare partite “sicure”.
            Significa costruire un approccio disciplinato basato su dati, probabilità e selezione.
          </p>

          <p className="mt-6 leading-8 text-white/75">
            È proprio da questa filosofia che nasce PronoX:
            un sistema progettato per trasformare statistiche e dati in segnali operativi più intelligenti.
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
