export default function SectionCard({ title, text, href, accent = "orange" }) {
  const accentClass =
    accent === "lime"
      ? "hover:border-lime-400/40"
      : "hover:border-orange-400/40";

  return (
    <a
      href={href}
      className={`rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:-translate-y-1 hover:bg-white/10 ${accentClass}`}
    >
      <p className="text-xl font-semibold">{title}</p>

      <p className="mt-3 leading-7 text-white/60">
        {text}
      </p>

      <p className="mt-5 text-sm font-semibold text-orange-300">
        Scopri di più →
      </p>
    </a>
  );
}
