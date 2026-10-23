-- Profilazioni mirate: da quando contare i campionati baccarat (23/10/2026)
-- Serve solo al pulsante "🔄 Riparto da zero" nella finestra del gruppo: dopo la pausa, quando i conti ripartono,
-- il conteggio delle 4 sessioni riparte da zero (le sessioni giocate restano in Archivio).
-- L'avviso di pausa e la posizione netta per conto funzionano anche senza questo file.
-- Eseguire una sola volta nel SQL Editor di Supabase (si puo' rilanciare senza danni).
-- Aggiunge una sola colonna a profilazioni_mirate: non tocca niente altro.
alter table public.profilazioni_mirate add column if not exists conteggio_dal timestamptz;

notify pgrst, 'reload schema';
