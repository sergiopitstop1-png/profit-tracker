-- Sessioni live: permesso di MODIFICARE le proprie sessioni (23/10/2026)
-- Serve alla finestra del gruppo (🎯 Numeri usciti · roulette di oggi) per scrivere o correggere i numeri usciti
-- DOPO aver salvato la sessione. Il salvataggio dei numeri durante la sessione NON ne ha bisogno.
-- Lancialo solo se premendo "💾 Salva" ti compare l'errore "la tabella live_sessioni non permette la modifica".
-- Eseguire una sola volta nel SQL Editor di Supabase (si puo' rilanciare senza danni).
-- Aggiunge una sola regola di modifica, e solo se la tabella non ne ha gia' una: non tocca niente altro.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'live_sessioni' and column_name = 'user_id')
     and not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'live_sessioni' and cmd in ('UPDATE', 'ALL')) then
    create policy live_sessioni_modifica on public.live_sessioni for update using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

notify pgrst, 'reload schema';
