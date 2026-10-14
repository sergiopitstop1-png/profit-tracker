-- Bet generate da Lucy (14/10/2026): salvate per giorno, cosi' non si perdono se ricarichi la pagina
-- e resta un archivio consultabile (con l'esito: fatta / saltata / rimandata) nella pagina "Oggi da fare".
-- Eseguire una sola volta nel SQL Editor di Supabase (si puo' rilanciare senza danni).
-- Non tocca nessuna tabella esistente: aggiunge solo questa.
-- dati   = le bet generate (per rimetterle com'erano dopo un ricaricamento)
-- righe  = elenco leggibile per l'archivio (cliente, book, partita, importo)
create table if not exists public.lucy_proposte_giorno (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  giorno date not null,
  dati jsonb not null,
  righe jsonb not null default '[]'::jsonb,
  aggiornato timestamptz not null default now(),
  unique (user_id, giorno)
);

create index if not exists lucy_proposte_giorno_idx on public.lucy_proposte_giorno (user_id, giorno desc);

-- Ognuno vede e modifica solo le proprie righe.
alter table public.lucy_proposte_giorno enable row level security;

drop policy if exists lucy_proposte_giorno_select on public.lucy_proposte_giorno;
drop policy if exists lucy_proposte_giorno_insert on public.lucy_proposte_giorno;
drop policy if exists lucy_proposte_giorno_update on public.lucy_proposte_giorno;
drop policy if exists lucy_proposte_giorno_delete on public.lucy_proposte_giorno;

create policy lucy_proposte_giorno_select on public.lucy_proposte_giorno for select to authenticated using (auth.uid() = user_id);
create policy lucy_proposte_giorno_insert on public.lucy_proposte_giorno for insert to authenticated with check (auth.uid() = user_id);
create policy lucy_proposte_giorno_update on public.lucy_proposte_giorno for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy lucy_proposte_giorno_delete on public.lucy_proposte_giorno for delete to authenticated using (auth.uid() = user_id);
