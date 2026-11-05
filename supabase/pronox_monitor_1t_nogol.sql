-- PronoX · monitoraggio Over 0.5 1T e NoGol (05/11/2026).
-- Eseguire una sola volta nel SQL Editor di Supabase (si puo' rilanciare senza danni).
-- Aggiunge una colonna vuota a pronox_risultati e crea una vista in sola lettura: nessun dato esistente viene toccato.
-- Legge le fotografie giornaliere (prediction_snapshots, model_version dc_v2_1t_v1), gli esiti (selection_outcomes) e i punteggi (pronox_risultati).
-- Una riga per partita e mercato: preferisce la fotografia a 24 ore, poi quella di apertura (nessun doppione).
-- Aggiunge anche la colonna minuto_primo_gol_1t a pronox_risultati (vuota finche' il cron non la compila; nessun dato esistente cambia).
-- esito: VINTA / PERSA / NULLA (partita annullata) / vuoto (ancora da giocare).
alter table public.pronox_risultati add column if not exists minuto_primo_gol_1t integer;

create or replace view public.pronox_monitor_1t_nogol as
select distinct on (s.event_id, s.market)
  s.event_id,
  s.market      as mercato,
  s.event_start as data_partita,
  s.competition as competizione,
  s.home_team   as casa,
  s.away_team   as ospite,
  s.horizon,
  s.model_prob  as prob,
  s.odds_taken  as quota,
  case when o.event_id is null then null when o.won is true then 'VINTA' when o.won is false then 'PERSA' else 'NULLA' end as esito,
  r.ht_casa, r.ht_ospite, r.ft_casa, r.ft_ospite,
  r.minuto_primo_gol_1t
from public.prediction_snapshots s
left join public.selection_outcomes o on o.event_id = s.event_id and o.market = s.market and o.selection = s.selection
left join public.pronox_risultati r on r.event_id = s.event_id
where s.model_version = 'dc_v2_1t_v1' and s.market in ('OU0.5HT', 'NOGOL')
order by s.event_id, s.market, case s.horizon when 't24h' then 0 when 'opening' then 1 else 2 end, s.id;

grant select on public.pronox_monitor_1t_nogol to authenticated;
