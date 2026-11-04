-- Masaniello: assicurazione sullo 0-0 e incasso del cashout (04/11/2026).
-- Eseguire una sola volta nel SQL Editor di Supabase (si puo' rilanciare senza danni).
-- Aggiunge SOLO due colonne alla tabella masaniello_events: non tocca ne' cancella nessun dato.
--   assicurata      = true se su questa partita hai fatto l'assicurazione (di partenza false)
--   incasso_cashout = quanto hai incassato dal cashout dell'assicurazione (di partenza vuoto)
-- Il motore del Masaniello non legge questi campi: puntate e obiettivo non cambiano.
alter table public.masaniello_events add column if not exists assicurata boolean not null default false;
alter table public.masaniello_events add column if not exists incasso_cashout numeric;
