-- Hunterbet: colonna «giocata» per il riquadro «Quota giocata» (23/10/2026)
-- La quota (colonna "quota") esiste gia': qui si aggiunge solo la spunta «giocata» (vero = giocato, falso = NON giocato, vuoto = non indicato).
-- Eseguire una volta nel SQL Editor di Supabase (si puo' rilanciare senza danni).
alter table if exists public.hunterbet_segnali
  add column if not exists giocata boolean;
notify pgrst, 'reload schema';
