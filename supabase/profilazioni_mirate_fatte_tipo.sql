-- Profilazioni mirate sport: tipo di giocata (doppia/tripla) e quota totale (22/11/2026)
-- Si compilano quando premi "Fatta" su una mirata sport (es. Sport 3, fedeltà Lottomatica).
-- Lucy li legge da profilazioni_mirate_fatte insieme a importo_per_conto e li vede anche in Archivio.
-- Eseguire una sola volta nel SQL Editor di Supabase (si puo' rilanciare senza danni).
-- Aggiunge solo due colonne: non tocca niente altro.
alter table public.profilazioni_mirate_fatte add column if not exists tipo_giocata text;
alter table public.profilazioni_mirate_fatte add column if not exists quota_totale numeric;

notify pgrst, 'reload schema';
