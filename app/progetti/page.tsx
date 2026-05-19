import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";

const projects = [
  {
    title: "🔥 PronoX",
    status: "Online",
    text: "Motore di analisi calcistica basato su dati reali, Poisson, forma squadre, probabilità e futura integrazione delle quote bookmaker.",
    href: "/oggi",
  },
  {
    title: "📈 Profit Tracker",
    status: "Area riservata",
    text: "Web app per gestire attività, wallet, movimenti, cassa, profitti, prelievi, royalty e controllo operativo.",
    href: "/profit-tracker",
  },
  {
    title: "🤖 Lucy",
    status: "In sviluppo",
    text: "Assistente AI personale progettato per automazioni, analisi dati, comandi vocali, gestione operativa e supporto decisionale.",
    href: null,
  },
  {
    title: "⚡ Workflow Operativi",
  status: "In evoluzione",
  text: "Strumenti e processi progettati per migliorare organizzazione, monitoraggio dati, automazioni e gestione operativa quotidiana.",
  href: null,
  },
  {
    title: "🧪 Laboratorio Automazioni",
    status: "Sperimentale",
    text: "Ambiente dedicato a script, API, integrazioni, raccolta dati, test operativi e strumenti personalizzati.",
    href: null,
  },
  {
    title: "🖋️ Alessandro Vitale",
  status: "Creativo",
  text: "Alessandro Vitale è il lato narrativo e visionario del progetto: uno spazio dove idee, tecnologia, memoria e immaginazione si incontrano per dare forma a storie e visioni del futuro.",
  href: null,
  },
];

export default function ProgettiPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-orange-950 text-white">
      <SiteHeader />

      <section className="mx-auto max-w-6xl px-6 py-20">
        <p className="text-sm uppercase tracking-[0.3em] text-lime-300">
          Progetti
        </p>

        <h1 className="mt-4 text-4xl font-bold md:text-6xl">
          Il laboratorio dove le idee diventano sistemi.
        </h1>

        <p className="mt-6 max-w-3xl text-lg leading-8 text-white/70">
          Ogni progetto nasce da un problema reale: organizzare meglio,
          automatizzare, analizzare dati e costruire strumenti utili.
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {projects.map((project) => (
            <div
              key={project.title}
              className="rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:-translate-y-1 hover:border-lime-400/40 hover:bg-white/10"
            >
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-2xl font-semibold">
                  {project.title}
                </h2>

                <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/60">
                  {project.status}
                </span>
              </div>

              <p className="mt-4 leading-7 text-white/60">
                {project.text}
              </p>

              {project.href ? (
                <a
                  href={project.href}
                  className="mt-5 inline-block text-sm font-semibold text-lime-300 hover:text-lime-200"
                >
                  Apri progetto →
                </a>
              ) : (
                <p className="mt-5 text-sm font-semibold text-white/35">
                  In arrivo
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
