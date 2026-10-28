"use client";

import { useEffect, useState } from "react";

type Game = {
  title: string;
  section: string;
  text: string;
  tags: string[];
  href: string;
  image: string;
  alt: string;
};

type Section = {
  id: string;
  title: string;
  description: string;
};

export default function GiochiSezioni({
  games,
  sections,
}: {
  games: Game[];
  sections: Section[];
}) {
  const [active, setActive] = useState(sections[0].id);

  // Se l'indirizzo finisce con #enigmistica (o #arcade) apre direttamente quella sezione
  useEffect(() => {
    const fromHash = window.location.hash.replace("#", "");
    if (sections.some((s) => s.id === fromHash)) setActive(fromHash);
  }, [sections]);

  function choose(id: string) {
    setActive(id);
    window.history.replaceState(null, "", "#" + id);
  }

  const visible = games.filter((g) => g.section === active);

  return (
    <div className="mt-10">
      <div
        role="tablist"
        aria-label="Sezioni dei giochi"
        className="grid grid-cols-2 gap-3 md:gap-4"
      >
        {sections.map((sec) => {
          const count = games.filter((g) => g.section === sec.id).length;
          const selected = sec.id === active;
          return (
            <button
              key={sec.id}
              type="button"
              role="tab"
              id={"tab-" + sec.id}
              aria-selected={selected}
              aria-controls={"panel-" + sec.id}
              onClick={() => choose(sec.id)}
              className={
                "rounded-2xl border px-4 py-4 text-left transition md:px-6 md:py-5 " +
                (selected
                  ? "border-lime-400/60 bg-lime-400/10"
                  : "border-white/10 bg-white/5 hover:border-white/30")
              }
            >
              <span className="block text-xl font-bold md:text-2xl">
                {sec.title}
              </span>
              <span className="mt-1 block text-sm text-white/60">
                {count} {count === 1 ? "gioco" : "giochi"}
              </span>
              <span className="mt-2 hidden text-sm text-white/50 sm:block">
                {sec.description}
              </span>
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={"panel-" + active}
        aria-labelledby={"tab-" + active}
        className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3"
      >
        {visible.map((game) => (
          <a
            key={game.href}
            href={game.href}
            className="group block overflow-hidden rounded-3xl border border-white/10 bg-white/5 transition hover:-translate-y-1 hover:border-lime-400/40 hover:bg-white/10"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={game.image}
              alt={game.alt}
              width={800}
              height={448}
              loading="lazy"
              className="aspect-[800/448] w-full object-cover"
            />
            <div className="p-6">
              <h3 className="text-2xl font-semibold">{game.title}</h3>
              <p className="mt-3 leading-7 text-white/70">{game.text}</p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {game.tags.map((tag) => (
                  <li
                    key={tag}
                    className="rounded-full border border-white/15 px-3 py-1 text-xs uppercase tracking-[0.15em] text-white/60"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-sm font-semibold text-lime-300 transition group-hover:text-lime-200">
                Gioca →
              </p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
