-- Hunterbet: colonna «giocata» per la spunta «Giocata» della tabella Segnali (23/10/2026)
-- La quota (colonna "quota") esiste gia': qui si aggiunge solo la spunta «giocata» (vero = giocato, falso = NON giocato, vuoto = non indicato, conta come NON giocato).
-- Eseguire una volta nel SQL Editor di Supabase (si puo' rilanciare senza danni).
alter table if exists public.hunterbet_segnali
  add column if not exists giocata boolean;
notify pgrst, 'reload schema';
