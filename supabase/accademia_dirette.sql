-- Calendario dirette dell'Accademia (09/10/2026): annunci letti da Lucy nei messaggi Telegram.
-- Contenuto riservato: RLS attiva e nessuna policy -> si legge solo dal server (service role) con controllo admin.
create table if not exists public.accademia_dirette (
  id bigint generated always as identity primary key,
  chat_id bigint not null,
  msg_id bigint not null,
  titolo text not null,
  inizio timestamptz not null,
  link text,
  gruppo text,
  topic text,
  avviso_24h boolean not null default false,
  avviso_30m boolean not null default false,
  creato timestamptz not null default now()
);
create index if not exists accademia_dirette_inizio_idx on public.accademia_dirette (inizio);
alter table public.accademia_dirette enable row level security;

-- messaggi gia' letti per le dirette (anche quelli senza nessuna diretta), cosi' non si rileggono
create table if not exists public.accademia_dirette_letti (
  chat_id bigint not null,
  msg_id bigint not null,
  letto timestamptz not null default now(),
  primary key (chat_id, msg_id)
);
alter table public.accademia_dirette_letti enable row level security;
