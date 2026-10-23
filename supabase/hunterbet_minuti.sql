-- Hunterbet: minuto del gol che fa vincere + minuto stimato del segnale (23/10/2026)
-- Aggiunge solo colonne nuove e vuote: non cambia ne' cancella nessun dato. Si puo' rilanciare senza danni.
alter table if exists public.hunterbet_segnali
  add column if not exists minuto_gol integer,                 -- minuto del gol che ha fatto vincere (es. 34; per 45+2 qui 45)
  add column if not exists minuto_gol_extra integer,           -- recupero (es. 2 per 45+2), vuoto se nessuno
  add column if not exists minuto_segnale_stimato integer,     -- minuto del segnale ricostruito dall'orario del messaggio (approssimato)
  add column if not exists minuti_letti_il timestamptz;        -- quando il programma sul PC ha letto i minuti da API-Football
notify pgrst, 'reload schema';
