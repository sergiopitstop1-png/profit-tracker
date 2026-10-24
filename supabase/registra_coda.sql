-- Registra al volo dal PC (24/10/2026): coda delle registrazioni mandate dal programmino sul desktop (Alt+R).
-- Il programma sul PC scrive qui; il Profit Tracker, quando e' aperto, prende le voci in attesa e le mette nel Registro manuale
-- (cosi' non si sovrascrivono mai a vicenda). Una voce presa passa da 'attesa' a 'preso', poi a 'fatto' (o 'errore' con il motivo).
-- Eseguire una sola volta nel SQL Editor di Supabase (si puo' rilanciare senza danni).
-- Non tocca nessuna tabella esistente: aggiunge solo questa.
-- book_ids = elenco degli id dei conti scelti (testo), tipo_op = Sport / Casinò / slot / Ricarica / Promo / VXT / Altro
-- importo  = testo come scritto (10 oppure 5/15), nota = descrizione facoltativa
create table if not exists public.registra_coda (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  book_ids jsonb not null,
  tipo_op text not null default 'Sport',
  importo text,
  nota text,
  stato text not null default 'attesa' check (stato in ('attesa', 'preso', 'fatto', 'errore')),
  messaggio text,
  creato timestamptz not null default now(),
  preso_il timestamptz
);

create index if not exists registra_coda_attesa_idx on public.registra_coda (user_id, stato, creato);

-- Ognuno vede e modifica solo le proprie righe (il programma sul PC passa dal server con la chiave di servizio).
alter table public.registra_coda enable row level security;

drop policy if exists registra_coda_select on public.registra_coda;
drop policy if exists registra_coda_insert on public.registra_coda;
drop policy if exists registra_coda_update on public.registra_coda;
drop policy if exists registra_coda_delete on public.registra_coda;

create policy registra_coda_select on public.registra_coda for select to authenticated using (auth.uid() = user_id);
create policy registra_coda_insert on public.registra_coda for insert to authenticated with check (auth.uid() = user_id);
create policy registra_coda_update on public.registra_coda for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy registra_coda_delete on public.registra_coda for delete to authenticated using (auth.uid() = user_id);
