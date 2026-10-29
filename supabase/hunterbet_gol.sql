-- Hunterbet: elenco completo dei gol di ogni partita (29/10/2026)
-- Serve alla pagina Analisi (Studio partite) per sapere il punteggio a un minuto qualsiasi, es. "0-0 al 70'".
-- Aggiunge SOLO due colonne nuove e vuote: non cambia ne' cancella nessun dato. Si puo' rilanciare senza danni.
-- Eseguire una volta nel SQL Editor di Supabase. Poi si lancia risultati_partite.py sul PC: riempie da solo le partite gia' finite
-- (circa 150 partite per esecuzione: le altre al giro successivo).
alter table if exists public.hunterbet_segnali
  add column if not exists gol jsonb,                    -- es. [{"m":34,"s":"casa"},{"m":71,"s":"ospite"}]  (m = minuto, s = chi ha segnato)
  add column if not exists gol_letti_il timestamptz;     -- quando il programma sul PC ha letto i gol da API-Football
notify pgrst, 'reload schema';
