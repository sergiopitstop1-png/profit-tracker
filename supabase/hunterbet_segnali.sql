-- Hunterbet PRO signals
create table if not exists public.hunterbet_segnali (
  msg_id bigint primary key,
  data_msg timestamptz,
  competizione text,
  casa text,
  ospite text,
  tipo_segnale text,
  score_casa_segnale integer,
  score_ospite_segnale integer,
  minuto_segnale integer,
  fixture_id bigint,
  score_casa_attuale integer,
  score_ospite_attuale integer,
  stato_match text,
  esito text,
  data_esito timestamptz,
  minuti_al_gol integer,
  aggiornato timestamptz not null default now()
);
create index if not exists hunterbet_segnali_data_msg_idx on public.hunterbet_segnali (data_msg desc);
alter table public.hunterbet_segnali enable row level security;
drop policy if exists "hunterbet lettura autenticati" on public.hunterbet_segnali;
create policy "hunterbet lettura autenticati" on public.hunterbet_segnali for select to authenticated using (true);
