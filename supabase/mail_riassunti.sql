-- Riassunti di mail e SMS dei clienti, alle 12:00 e alle 19:00 ora italiana (10/10/2026)
-- Eseguibile piu' volte. Contenuto riservato: RLS attiva e nessuna policy -> si legge solo dal server (service role) con controllo admin.
-- n_messaggi = mail e SMS ricevuti nella fascia · n_selezionati = quelli importanti (problemi + opportunita')
create table if not exists public.mail_riassunti (
  id bigint generated always as identity primary key,
  giorno date not null,
  fascia smallint not null check (fascia in (12, 19)),
  da timestamptz not null,
  a timestamptz not null,
  testo text not null,
  n_messaggi integer not null default 0,
  n_selezionati integer not null default 0,
  costo_usd numeric,
  inviato_telegram boolean not null default false,
  creato timestamptz not null default now(),
  unique (giorno, fascia)
);
create index if not exists mail_riassunti_giorno_idx on public.mail_riassunti (giorno desc, fascia desc);
alter table public.mail_riassunti enable row level security;
