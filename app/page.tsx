export default function SergioApicellaHomepage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-orange-950 text-white">
      <header className="border-b border-white/10 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xl font-semibold tracking-wide">Sergio Apicella</p>
            <p className="text-sm text-white/60">Strategia. Metodo. Operatività.</p>
          </div>
          <nav className="hidden gap-6 text-sm text-white/75 md:flex">
            <a href="#home" className="transition hover:text-orange-300">Home</a>
            <a href="#reserved" className="transition hover:text-orange-300">Area Riservata</a>
            <a href="/oggi" className="transition hover:text-lime-300">PronoX</a>
            <a href="#coming-soon" className="transition hover:text-orange-300">Servizi</a>
            <a href="#coming-soon" className="transition hover:text-orange-300">Chi Sono</a>
          </nav>
        </div>
      </header>

      <section id="home" className="mx-auto grid min-h-[70vh] max-w-6xl items-center gap-10 px-6 py-16 md:grid-cols-2 md:py-24">
        <div className="space-y-6">
          <div className="inline-flex rounded-full border border-orange-400/30 bg-orange-500/10 px-4 py-1 text-sm text-orange-200">
            Trasforma ogni occasione in profitto. 🔥
          </div>
          <h1 className="text-4xl font-bold leading-tight md:text-6xl">
            Vuoi fare soldi <span className="text-orange-400">online</span> con più metodo e meno caos?
          </h1>
          <p className="max-w-xl text-lg leading-8 text-white/75">
            Niente fumo. Niente frasi da guru. Solo strategia, organizzazione e strumenti pratici per costruire un sistema che lavori davvero.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row">
            <a href="mailto:sergio.apicella.lavoro@gmail.com?subject=Richiesta%20informazioni%20da%20sergioapicella.it" className="rounded-2xl bg-orange-500 px-6 py-4 text-center font-semibold text-white shadow-lg shadow-orange-950/40 transition hover:scale-[1.02] hover:bg-orange-400">
              Chiedimi come
            </a>
            <a href="/profit-tracker" className="rounded-2xl border border-white/15 bg-white/5 px-6 py-4 text-center font-semibold text-white transition hover:bg-white/10">
              Area Riservata
            </a>
            <a href="/oggi" className="rounded-2xl border border-lime-400/40 bg-lime-500/10 px-6 py-4 text-center font-semibold text-lime-300 transition hover:bg-lime-500/20">
              PronoX
            </a>
          </div>
          <p className="text-sm text-white/45">
            Versione completa in arrivo.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/30 backdrop-blur">
          <div className="mb-6 flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-red-400" />
            <div className="h-3 w-3 rounded-full bg-yellow-400" />
            <div className="h-3 w-3 rounded-full bg-green-400" />
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
              <p className="text-sm uppercase tracking-[0.2em] text-orange-300">Focus</p>
              <p className="mt-2 text-2xl font-semibold">Sistema prima del rumore</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm text-white/60">Metodo</p>
                <p className="mt-2 text-lg font-semibold">Organizzazione operativa</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm text-white/60">Accesso</p>
                <p className="mt-2 text-lg font-semibold">Profit Tracker riservato</p>
              </div>
            </div>
            <div className="rounded-2xl border border-lime-400/20 bg-lime-500/10 p-5">
              <p className="text-sm uppercase tracking-[0.2em] text-lime-300">Nuovo</p>
              <p className="mt-2 text-lg font-semibold">PronoX · Pronosticatore Sportivo</p>
              <p className="mt-1 text-sm text-white/60">Analisi Poisson · dati reali · EV calcolato</p>
              <a href="/oggi" className="mt-3 inline-block text-sm font-semibold text-lime-300 hover:text-lime-200">Apri PronoX →</a>
            </div>
          </div>
        </div>
      </section>

      <section id="coming-soon" className="border-t border-white/10 bg-black/20">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 py-14 md:grid-cols-3">
          {[
            ["Chi Sono", "Under Construction"],
            ["Servizi", "Under Construction"],
            ["Progetti", "Under Construction"],
          ].map(([title, subtitle]) => (
            <div key={title} className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <p className="text-xl font-semibold">{title}</p>
              <p className="mt-3 text-white/60">{subtitle}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="reserved" className="mx-auto max-w-6xl px-6 py-14">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-orange-500/15 to-transparent p-8">
          <p className="text-sm uppercase tracking-[0.2em] text-orange-300">Accesso diretto</p>
          <h2 className="mt-3 text-3xl font-bold">Area Riservata</h2>
          <p className="mt-4 max-w-2xl text-white/70">
            Accesso al sistema operativo dedicato. Ambiente riservato, protetto e pensato per lavorare davvero.
          </p>
          <a href="/profit-tracker" className="mt-6 inline-block rounded-2xl bg-white px-6 py-4 font-semibold text-black transition hover:scale-[1.02]">
            Entra ora
          </a>
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-8 text-center text-sm text-white/45">
        © Sergio Apicella — Tutti i diritti riservati · PronoX © Sergio Apicella 2026
      </footer>
    </main>
  );
}
