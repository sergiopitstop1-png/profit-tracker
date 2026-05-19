import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";

export default function ChiSonoPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-orange-950 text-white">
      <SiteHeader />

      <section className="mx-auto max-w-5xl px-6 py-20">
        <p className="text-sm uppercase tracking-[0.3em] text-orange-300">
          Chi Sono
        </p>

        <h1 className="mt-4 text-4xl font-bold md:text-6xl">
          Metodo nato dal caos.
        </h1>

        <div className="mt-10 grid gap-8 md:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6 text-lg leading-9 text-white/75">
            <p>
              Mi chiamo Sergio Apicella. Per anni ho vissuto una vita normale:
              lavoro, responsabilità, problemi, cadute, ripartenze e notti
              passate a cercare una via d’uscita concreta.
            </p>

            <p>
              Non mi sono avvicinato alla tecnologia, ai dati e alle strategie
              digitali per moda. Ci sono arrivato per necessità, fame e
              testardaggine.
            </p>

            <p>
              Ho studiato matched betting, bonus hunting, trading sportivo,
              automazioni, gestione operativa, sviluppo web e intelligenza
              artificiale con un obiettivo preciso: costruire sistemi utili,
              misurabili e replicabili.
            </p>

            <p>
              Questo sito è il mio laboratorio pubblico: un punto di incontro
              tra esperienza reale, matematica, tecnologia e visione.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/30">
            <p className="text-sm uppercase tracking-[0.2em] text-orange-300">
              Principio guida
            </p>

            <p className="mt-4 text-2xl font-semibold leading-9">
              “Prima il metodo. Poi il risultato. Il resto è rumore.”
            </p>

            <div className="mt-8 space-y-4 text-white/65">
              <p>⚙️ Sistemi prima dell’improvvisazione</p>
              <p>📊 Dati prima delle sensazioni</p>
              <p>🧠 Strategia prima della fretta</p>
              <p>🔥 Operatività prima delle chiacchiere</p>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
