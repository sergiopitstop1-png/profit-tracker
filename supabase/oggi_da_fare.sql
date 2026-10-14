-- Pagina "Oggi da fare" (14/10/2026): stato delle voci segnate Fatto o Rimandate.
-- Eseguire una sola volta nel SQL Editor di Supabase (si puo' rilanciare senza danni).
-- Non tocca nessuna tabella esistente: salva solo "questa voce e' fatta" oppure "rimandata al giorno X".
-- chiave   = identificativo stabile della voce (es. bet|..., conto|data|id, avviso|id, mail|id, masaniello|id)
-- stato    = fatto | rimandato
-- giorno   = il giorno in cui l'hai segnata
-- rimanda_a = data scelta per il rinvio (obbligatoria se rimandato)
-- sezione, titolo, dettaglio, tag = copia del testo, cosi' una voce rimandata ricompare nel giorno scelto anche se il calcolo del giorno e' cambiato
create table if not exists public.oggi_da_fare_stato (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  chiave text not null,
  stato text not null check (stato in ('fatto', 'rimandato')),
  giorno date not null default current_date,
  rimanda_a date,
  sezione text,
  titolo text,
  dettaglio text,
  tag text,
  aggiornato timestamptz not null default now(),
  unique (user_id, chiave),
  check (stato <> 'rimandato' or rimanda_a is not null)
);

create index if not exists oggi_da_fare_stato_giorno_idx on public.oggi_da_fare_stato (user_id, giorno desc);
create index if not exists oggi_da_fare_stato_rimando_idx on public.oggi_da_fare_stato (user_id, rimanda_a) where stato = 'rimandato';

-- Ognuno vede e modifica solo le proprie righe.
alter table public.oggi_da_fare_stato enable row level security;

drop policy if exists oggi_da_fare_stato_select on public.oggi_da_fare_stato;
drop policy if exists oggi_da_fare_stato_insert on public.oggi_da_fare_stato;
drop policy if exists oggi_da_fare_stato_update on public.oggi_da_fare_stato;
drop policy if exists oggi_da_fare_stato_delete on public.oggi_da_fare_stato;

create policy oggi_da_fare_stato_select on public.oggi_da_fare_stato for select to authenticated using (auth.uid() = user_id);
create policy oggi_da_fare_stato_insert on public.oggi_da_fare_stato for insert to authenticated with check (auth.uid() = user_id);
create policy oggi_da_fare_stato_update on public.oggi_da_fare_stato for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy oggi_da_fare_stato_delete on public.oggi_da_fare_stato for delete to authenticated using (auth.uid() = user_id);
