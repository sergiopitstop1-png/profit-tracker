-- Popup "Promo nuove" in Dashboard (14/10/2026): ricorda da quando contano le promo nuove e quali hai segnato "ok visto".
-- Eseguire una sola volta nel SQL Editor di Supabase (si puo' rilanciare senza danni).
-- Non tocca nessuna tabella esistente.
-- chiave = 'inizio'  -> il momento in cui e' partito il popup (le promo gia' presenti prima non fanno popup)
-- chiave = 'msg:ID'  -> la segnalazione con quell'id (tabella accademia_messaggi) l'hai gia' vista
create table if not exists public.promo_segnalate_viste (
  chiave text primary key,
  visto_il timestamptz not null default now()
);

-- Solo il sito (chiave di servizio) la legge e la scrive: nessuna policy = nessun accesso dal browser.
alter table public.promo_segnalate_viste enable row level security;
