-- Registro delle operazioni di profilazione (14/10/2026): chi ha fatto cosa, cliente per cliente.
-- Serve a far proseguire la profilazione come dice Profiliamo: il passo dopo parte per chi ha fatto il precedente.
-- Si riempie quando segni "Fatto" (o "Parziale") sulle righe Profiliamo di "Oggi da fare".
-- Eseguire una sola volta nel SQL Editor di Supabase (si puo' rilanciare senza danni).
-- Non tocca nessuna tabella esistente: aggiunge solo questa.
-- chiave   = identificativo del passo (profiliamo|giorno|id conto)
-- completa = true se il passo e' stato fatto tutto, false se solo in parte
-- residuo  = cosa non e' stato fatto (slitta al giorno dopo)
create table if not exists public.profilazione_operazioni (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  chiave text not null,
  book_id text not null,
  book_nome text,
  intestatario text,
  giorno date not null default current_date,
  origine text not null default 'profiliamo',
  azione text,
  completa boolean not null default true,
  residuo text,
  creato timestamptz not null default now(),
  unique (user_id, chiave)
);

create index if not exists profilazione_operazioni_book_idx on public.profilazione_operazioni (user_id, book_id, giorno desc);
create index if not exists profilazione_operazioni_giorno_idx on public.profilazione_operazioni (user_id, giorno desc);

-- Ognuno vede e modifica solo le proprie righe.
alter table public.profilazione_operazioni enable row level security;

drop policy if exists profilazione_operazioni_select on public.profilazione_operazioni;
drop policy if exists profilazione_operazioni_insert on public.profilazione_operazioni;
drop policy if exists profilazione_operazioni_update on public.profilazione_operazioni;
drop policy if exists profilazione_operazioni_delete on public.profilazione_operazioni;

create policy profilazione_operazioni_select on public.profilazione_operazioni for select to authenticated using (auth.uid() = user_id);
create policy profilazione_operazioni_insert on public.profilazione_operazioni for insert to authenticated with check (auth.uid() = user_id);
create policy profilazione_operazioni_update on public.profilazione_operazioni for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy profilazione_operazioni_delete on public.profilazione_operazioni for delete to authenticated using (auth.uid() = user_id);
