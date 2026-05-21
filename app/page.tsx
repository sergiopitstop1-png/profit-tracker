import SiteHeader from "./components/SiteHeader";
import SiteFooter from "./components/SiteFooter";
import SectionCard from "./components/SectionCard";

export default function SergioApicellaHomepage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-orange-950 text-white">
      <SiteHeader />

      <section className="mx-auto grid min-h-[70vh] max-w-6xl items-center gap-10 px-6 py-16 md:grid-cols-2 md:py-24">
        <div className="space-y-6">
          <div className="inline-flex rounded-full border border-orange-400/30 bg-orange-500/10 px-4 py-1 text-sm text-orange-200">
            Laboratorio digitale indipendente
          </div>
          <h1 className="text-4xl font-bold leading-tight md:text-6xl">
            Vuoi fare soldi{" "}
            <span className="text-orange-400">online</span> con più metodo e
            meno caos?
          </h1>
          <p className="max-w-xl text-lg leading-8 text-white/75">
            Niente fumo. Niente frasi da guru. Solo strategia, organizzazione,
            dati e strumenti pratici per costruire sistemi che lavorano davvero.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row">
            
              href="mailto:sergio.apicella.lavoro@gmail.com?subject=Richiesta%20informazioni%20da%20sergioapicella.it"
              className="rounded-2xl bg-orange-500 px-6 py-4 text-center font-semibold text-white shadow-lg shadow-orange-950/40 transition hover:scale-[1.02] hover:bg-orange-400"
            >
              Chiedimi come
            </a>
            
              href="/profit-tracker"
              className="rounded-2xl border border-white/15 bg-white/5 px-6 py-4 text-center font-semibold text-white transition hover:bg-white/10"
            >
              Area Riservata
            </a>
            
              href="/oggi"
              className="rounded-2xl border border-lime-400/40 bg-lime-500/10 px-6 py-4 text-center font-semibold text-lime-300 transition hover:bg-lime-500/20"
            >
              PronoX
            </a>
          </div>
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
              <p className="mt-1 text-sm text-white/60">Analisi Poisson · dati reali · value bet</p>
              <a href="/oggi" className="mt-3 inline-block text-sm font-semibold text-lime-300 hover:text-lime-200">
                Apri PronoX →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* DAL BLOG */}
      <section className="mx-auto max-w-6xl px-6 py-14">
        <p className="text-sm uppercase tracking-[0.3em] text-orange-300">Dal Blog</p>
        <h2 className="mt-3 text-3xl font-bold mb-8">Ultimi articoli</h2>
        <div className="grid gap-6 md:grid-cols-3">
          <a href="/blog/salernitana-playoff-serie-c-2026"
            className="block rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:-translate-y-1 hover:border-orange-400/40 hover:bg-white/10">
            <p className="text-xs uppercase tracking-[0.2em] text-orange-300 mb-3">Analisi Calcio</p>
            <h3 className="text-lg font-bold leading-snug mb-3">
              Salernitana in semifinale: al Benelli una vittoria di sostanza
            </h3>
            <p className="text-sm text-white/60 leading-7">
              Ravenna-Salernitana 0-2. Villa e Inglese trascinano i granata alle semifinali playoff di Serie C.
            </p>
            <p className="mt-4 text-sm font-semibold text-orange-300">Leggi articolo →</p>
          </a>
          <a href="/blog/juventus-napoli-stagione-2026"
            className="block rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:-translate-y-1 hover:border-orange-400/40 hover:bg-white/10">
            <p className="text-xs uppercase tracking-[0.2em] text-orange-300 mb-3">Analisi Calcio</p>
            <h3 className="text-lg font-bold leading-snug mb-3">
              Juventus, un occasione sprecata. Napoli, lezione di solidità
            </h3>
            <p className="text-sm text-white/60 leading-7">
              Champions persa in casa contro la Fiorentina. Napoli secondo nonostante infortuni e assenze.
            </p>
            <p className="mt-4 text-sm font-semibold text-orange-300">Leggi articolo →</p>
          </a>
          <a href="/blog/europa-league-finale-2026"
            className="block rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:-translate-y-1 hover:border-orange-400/40 hover:bg-white/10">
            <p className="text-xs uppercase tracking-[0.2em] text-orange-300 mb-3">Analisi Calcio</p>
            <h3 className="text-lg font-bold leading-snug mb-3">
              Aston Villa campione d'Europa: 3-0 al Friburgo a Istanbul
            </h3>
            <p className="text-sm text-white/60 leading-7">
              Tielemans, Buendía e Rogers. Emery conquista la sua quinta Europa League.
            </p>
            <p className="mt-4 text-sm font-semibold text-orange-300">Leggi articolo →</p>
          </a>
        </div>
        <div className="mt-8 text-right">
          <a href="/blog" className="text-sm font-semibold text-orange-300 hover:text-orange-200">
            Tutti gli articoli →
          </a>
        </div>
      </section>

      {/* CHI SONO / SERVIZI / PROGETTI */}
      <section className="border-t border-white/10 bg-black/20">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 py-14 md:grid-cols-3">
          <SectionCard
            title="Chi Sono"
            text="Una storia fatta di cadute, metodo, tecnologia e rinascita operativa. Non teoria da vetrina: esperienza sul campo."
            href="/chi-sono"
          />
          <SectionCard
            title="Servizi"
            text="Analisi statistiche, automazioni, strumenti digitali, consulenza operativa e sistemi personalizzati."
            href="/servizi"
          />
          <SectionCard
            title="Progetti"
            text="PronoX, Profit Tracker, Lucy e altri strumenti costruiti per trasformare dati e idee in operatività reale."
            href="/progetti"
            accent="lime"
          />
        </div>
      </section>

      {/* AREA RISERVATA */}
      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-orange-500/15 to-transparent p-8">
          <p className="text-sm uppercase tracking-[0.2em] text-orange-300">Accesso diretto</p>
          <h2 className="mt-3 text-3xl font-bold">Area Riservata</h2>
          <p className="mt-4 max-w-2xl text-white/70">
            Accesso al sistema operativo dedicato. Ambiente riservato, protetto e pensato per lavorare davvero.
          </p>
          
            href="/profit-tracker"
            className="mt-6 inline-block rounded-2xl bg-white px-6 py-4 font-semibold text-black transition hover:scale-[1.02]"
          >
            Entra ora
          </a>
        </div>
      </section>

      {/* COLLABORAZIONI */}
      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="rounded-3xl border border-orange-400/20 bg-orange-500/10 p-8">
          <p className="text-sm uppercase tracking-[0.2em] text-orange-300">Collaborazioni</p>
          <h2 className="mt-3 text-3xl font-bold">Hai un progetto operativo da costruire?</h2>
          <p className="mt-4 max-w-3xl text-white/70">
            Automazioni, dashboard, sistemi statistici, organizzazione operativa,
            workflow intelligenti o idee digitali da sviluppare.
            Se il progetto ha senso, possiamo costruirlo davvero.
          </p>
          
            href="mailto:sergio.apicella.lavoro@gmail.com?subject=Richiesta%20informazioni%20da%20sergioapicella.it"
            className="mt-6 inline-block rounded-2xl bg-orange-500 px-6 py-4 font-semibold text-white transition hover:scale-[1.02] hover:bg-orange-400"
          >
            Contattami
          </a>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
