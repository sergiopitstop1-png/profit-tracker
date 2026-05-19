import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";

const services = [
  [
    "⚽ Analisi e Pronostici Statistici",
    "Sistemi di analisi calcistica basati su dati reali, modelli probabilistici, Poisson, forma squadre e ricerca del valore.",
  ],
  [
    "🎯 Match Betting & Bonus Hunting",
    "Strategie operative per bonus sportivi e casinò, gestione rischio, rollover, value betting e organizzazione multiaccount.",
  ],
  [
    "🤖 Automazioni e Tool Personalizzati",
    "Script, dashboard e strumenti web per ridurre lavoro manuale, errori ripetitivi e dispersione operativa.",
  ],
  [
    "📊 Profit Tracker",
    "Gestione di bookmaker, wallet, transazioni, profitti, uscite e controllo operativo in un ambiente riservato.",
  ],
  [
    "🧠 AI e Sistemi Intelligenti",
    "Studio e sviluppo di assistenti AI, workflow vocali, integrazioni API e automazioni evolute.",
  ],
  [
    "🚀 Consulenza Strategica",
    "Supporto pratico per costruire processi più ordinati, misurabili e orientati alla crescita.",
  ],
];

export default function ServiziPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-orange-950 text-white">
      <SiteHeader />

      <section className="mx-auto max-w-6xl px-6 py-20">
        <p className="text-sm uppercase tracking-[0.3em] text-orange-300">
          Servizi
        </p>

        <h1 className="mt-4 text-4xl font-bold md:text-6xl">
          Strumenti e strategie per lavorare meglio.
        </h1>

        <p className="mt-6 max-w-3xl text-lg leading-8 text-white/70">
          Non vendo formule magiche. Costruisco e organizzo sistemi: analisi,
          automazioni, dashboard, processi e strumenti pratici.
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {services.map(([title, text]) => (
            <div
              key={title}
              className="rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:-translate-y-1 hover:border-orange-400/40 hover:bg-white/10"
            >
              <h2 className="text-xl font-semibold">{title}</h2>
              <p className="mt-4 leading-7 text-white/60">{text}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 rounded-3xl border border-orange-400/20 bg-orange-500/10 p-8">
          <h2 className="text-2xl font-bold">
            Hai un progetto operativo da costruire?
          </h2>

          <p className="mt-4 max-w-3xl text-white/70">
            Scrivimi. Se l’idea ha senso, la trasformiamo in una struttura
            concreta: semplice dove serve, potente dove conta.
          </p>

          <a
            href="mailto:sergio.apicella.lavoro@gmail.com?subject=Richiesta%20servizi%20da%20sergioapicella.it"
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
