export default function SiteHeader() {
  return (
    <header className="border-b border-white/10 bg-black/20 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="/" className="group">
          <p className="text-xl font-semibold tracking-wide transition group-hover:text-orange-300">
            Sergio Apicella
          </p>
          <p className="text-sm text-white/60">Strategia. Metodo. Operatività.</p>
        </a>

        <nav className="flex flex-wrap justify-end gap-3 text-xs text-white/75 md:gap-6 md:text-sm">
          <a href="/" className="transition hover:text-orange-300">Home</a>
          <a href="/chi-sono" className="transition hover:text-orange-300">Chi Sono</a>
          <a href="/servizi" className="transition hover:text-orange-300">Servizi</a>
          <a href="/progetti" className="transition hover:text-orange-300">Progetti</a>
          <a href="/blog" className="transition hover:text-orange-300">Blog</a>
          <a href="/oggi" className="transition hover:text-lime-300">PronoX</a>
          <a href="/storico-pronostici" className="transition hover:text-lime-300">Storico Pronostici</a>
          <a href="/profit-tracker" className="transition hover:text-orange-300">Area Riservata</a>
        </nav>
      </div>
    </header>
  );
}
