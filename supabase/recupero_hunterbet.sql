-- =====================================================================
-- 23/10/2026 · Masaniello «Hunterbet Pre-live» (Recupero conti)
-- Da lanciare UNA volta nel SQL Editor di Supabase. Si può rilanciare senza danni.
-- Il piano nasce SPENTO: lo accendi tu dal pannello «Masaniello Hunterbet Pre-live».
-- =====================================================================

create table if not exists public.recupero_hb_piano (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid(),
  attivo      boolean not null default false,
  capitale    numeric not null default 500,
  n_eventi    int     not null default 50,
  k_vincite   int     not null default 30,
  quota_rif   numeric not null default 1.60,
  eventi_extra int    not null default 0,
  saltati     jsonb   not null default '[]'::jsonb,   -- msg_id dei segnali che hai scelto di non giocare
  creato      timestamptz not null default now(),
  aggiornato  timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.recupero_hb_bets (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid(),
  msg_id         bigint not null,                 -- id del segnale in hunterbet_segnali
  event_start    timestamptz,
  partita        text,
  competizione   text,
  tipo_segnale   text,
  book_id        text,
  book_nome      text,
  intestatario   text,
  tipo           text,
  importo        numeric not null,
  puntata_evento numeric,                          -- puntata totale della partita (somma dei pezzi)
  quota_minima   numeric not null default 1.60,
  quota_reale    numeric,                          -- la quota che hai trovato davvero quando hai piazzato
  stato          text not null default 'da_fare' check (stato in ('da_fare','piazzata','saltata')),
  piazzata_at    timestamptz,
  creato         timestamptz not null default now()
);

create index if not exists recupero_hb_bets_user_msg on public.recupero_hb_bets (user_id, msg_id);

alter table public.recupero_hb_piano enable row level security;
alter table public.recupero_hb_bets  enable row level security;

drop policy if exists recupero_hb_piano_own on public.recupero_hb_piano;
create policy recupero_hb_piano_own on public.recupero_hb_piano
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists recupero_hb_bets_own on public.recupero_hb_bets;
create policy recupero_hb_bets_own on public.recupero_hb_bets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

notify pgrst, 'reload schema';
