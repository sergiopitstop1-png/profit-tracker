import SiteHeader from "../../components/SiteHeader";
import SiteFooter from "../../components/SiteFooter";

export default function ValueBetArticlePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-orange-950 text-white">
      <SiteHeader />

      <article className="mx-auto max-w-4xl px-6 py-20">

        <p className="text-sm uppercase tracking-[0.3em] text-orange-300">
          Strategie
        </p>

        <h1 className="mt-4 text-4xl font-bold leading-tight md:text-6xl">
          Value Bet: cosa sono e perché quasi tutti le usano male
        </h1>

        <p className="mt-5 text-white/50">
          di Sergio Apicella
        </p>

        <p className="mt-8 text-lg leading-8 text-white/70">
          La maggior parte degli scommettitori pensa che vincere significhi
          “indovinare più partite”.
          In realtà il concetto davvero importante è un altro:
          trovare quote con valore matematico positivo.
        </p>

        <div className="mt-10 rounded-3xl border border-orange-400/20 bg-orange-500/10 p-8">
          <p className="text-xl font-semibold leading-9">
            Una value bet non è una scommessa sicura.
            È una quota pagata più di quanto dovrebbe.
          </p>
        </div>

        <section className="mt-16 space-y-6">

          <h2 className="text-3xl font-bold">
            Il concetto che cambia tutto
          </h2>

          <p className="leading-8 text-white/70">
            Immagina una partita dove la probabilità reale di vittoria di una squadra
            sia del 60%.
          </p>

          <p className="leading-8 text-white/70">
            La quota equa sarebbe:
          </p>

          <div className="rounded-2xl border border-lime-400/20 bg-lime-500/10 p-8 text-center">
            <p className="text-3xl font-bold">
              1 / 0.60 = 1.66
            </p>
          </div>

          <p className="leading-8 text-white/70">
            Se il bookmaker offre 1.90 invece di 1.66,
            significa che sta pagando quell’evento più del dovuto.
          </p>

          <p className="leading-8 text-white/70">
            Ed è lì che nasce il valore.
          </p>

        </section>

        <section className="mt-16 space-y-6">

          <h2 className="text-3xl font-bold">
            Perché il bookmaker sbaglia
          </h2>

          <p className="leading-8 text-white/70">
            I bookmaker non fanno quote “perfette”.
            Devono coprire centinaia di campionati, mercati e variazioni live.
          </p>

          <p className="leading-8 text-white/70">
            Inoltre:
          </p>

          <ul className="list-disc space-y-3 pl-6 text-white/70">
            <li>proteggono il margine</li>
            <li>seguono i flussi di denaro</li>
            <li>reagiscono ai movimenti del mercato</li>
            <li>a volte correggono lentamente</li>
          </ul>

          <p className="leading-8 text-white/70">
            In certi momenti si creano squilibri.
            Ed è proprio lì che i sistemi di value betting cercano opportunità.
          </p>

        </section>

        <section className="mt-16 space-y-6">

          <h2 className="text-3xl font-bold">
            Dove sbagliano quasi tutti
          </h2>

          <p className="leading-8 text-white/70">
            Molti pensano che value betting significhi:
          </p>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
            <p className="text-xl font-semibold">
              “Quota alta = valore”
            </p>
          </div>

          <p className="leading-8 text-white/70">
            È completamente sbagliato.
          </p>

          <p className="leading-8 text-white/70">
            Il valore non dipende dalla quota in sé,
            ma dal rapporto tra:
          </p>

          <div className="rounded-2xl border border-orange-400/20 bg-orange-500/10 p-8 text-center">
            <p className="text-2xl font-bold">
              probabilità reale VS probabilità implicita
            </p>
          </div>

        </section>

        <section className="mt-16 space-y-6">

          <h2 className="text-3xl font-bold">
            Il lungo periodo è tutto
          </h2>

          <p className="leading-8 text-white/70">
            Una singola value bet può perdere.
            Anche dieci di fila possono perdere.
          </p>

          <p className="leading-8 text-white/70">
            Ma se continui a investire solo quando il valore atteso è positivo,
            nel lungo periodo la matematica tende a compensare la varianza.
          </p>

          <p className="leading-8 text-white/70">
            Questo è il motivo per cui i professionisti parlano sempre di:
          </p>

          <ul className="list-disc space-y-3 pl-6 text-white/70">
            <li>ROI</li>
            <li>Expected Value</li>
            <li>campione statistico</li>
            <li>gestione bankroll</li>
          </ul>

        </section>

        <section className="mt-16 space-y-6">

          <h2 className="text-3xl font-bold">
            Come aiuta PronoX
          </h2>

          <p className="leading-8 text-white/70">
            PronoX confronta le probabilità calcolate dal modello statistico
            con le quote dei bookmaker.
          </p>

          <p className="leading-8 text-white/70">
            Quando trova uno scarto positivo abbastanza alto,
            segnala una possibile value bet.
          </p>

          <p className="leading-8 text-white/70">
            Non promette vincite sicure.
            Cerca semplicemente di individuare situazioni dove il mercato
            potrebbe aver sbagliato valutazione.
          </p>

        </section>

        <section className="mt-16 rounded-3xl border border-lime-400/20 bg-lime-500/10 p-8">

          <h2 className="text-3xl font-bold">
            Conclusione
          </h2>

          <p className="mt-6 leading-8 text-white/75">
            Le value bet non sono magia.
            Sono matematica applicata alle quote.
          </p>

          <p className="mt-6 leading-8 text-white/75">
            E la vera differenza non la fa il pronostico “geniale”,
            ma la capacità di prendere decisioni con valore atteso positivo
            centinaia di volte nel tempo.
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
