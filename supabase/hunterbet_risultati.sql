-- Segnali Hunterbet / ScoreTrend: colonne per i risultati automatici (23/10/2026)
-- Servono al programma sul PC (pc/risultati/risultati_partite.py) e alla route /api/segnali/risultati.
-- Aggiunge SOLO le colonne che mancano: se ci sono gia' non cambia niente, quindi si puo' rilanciare senza danni.
-- Eseguire una volta nel SQL Editor di Supabase PRIMA della prima prova del programma.
-- (se non lo fai e una colonna manca, il programma si ferma con un errore 500 che nomina la colonna mancante)

alter table if exists public.hunterbet_segnali
  add column if not exists ht_casa integer,
  add column if not exists ht_ospite integer,
  add column if not exists ft_casa integer,
  add column if not exists ft_ospite integer,
  add column if not exists quota numeric,
  add column if not exists esito_manuale boolean default false,
  add column if not exists af_fixture_id bigint,
  add column if not exists af_stato text,
  add column if not exists risultato_tentativi integer default 0;

alter table if exists public.scoretrend_segnali
  add column if not exists data_partita timestamptz,
  add column if not exists ht_casa integer,
  add column if not exists ht_ospite integer,
  add column if not exists ft_casa integer,
  add column if not exists ft_ospite integer,
  add column if not exists af_fixture_id bigint,
  add column if not exists af_stato text,
  add column if not exists risultato_tentativi integer default 0;

-- il programma conta i tentativi con "< 6": una riga con valore vuoto non verrebbe mai cercata, quindi i vuoti diventano 0
update public.hunterbet_segnali set risultato_tentativi = 0 where risultato_tentativi is null;
do $$
begin
  if to_regclass('public.scoretrend_segnali') is not null then
    execute 'update public.scoretrend_segnali set risultato_tentativi = 0 where risultato_tentativi is null';
  end if;
end $$;

notify pgrst, 'reload schema';
