-- SBOStats · Match Analysis (09/11/2026)
-- Pronostici letti dal PC (pc/sbostats) e mostrati nella scheda Segnali > SBOStats.
-- Si può rilanciare senza danni.
create table if not exists public.sbostats_segnali (
  chiave text primary key,              -- «data|partita|pronostico» come scritti su SBOStats
  data_partita timestamptz,             -- ora italiana convertita
  data_testo text,                      -- data come scritta sul sito (gg/mm/aaaa hh:mm)
  partita text,
  casa text,
  ospite text,
  campionato text,
  pronostico text,
  frequenza numeric,                    -- in %, es. 75.63
  quota_teorica numeric,                -- 100 / frequenza: NON è una quota di mercato
  risultato text,                       -- es. «2 - 1», vuoto se non finita
  esito text,                           -- VINTA / PERSA / NULLA; null = in attesa
  aggiornato timestamptz not null default now()
);
create index if not exists sbostats_segnali_data_idx on public.sbostats_segnali (data_partita desc);
create index if not exists sbostats_segnali_pronostico_idx on public.sbostats_segnali (pronostico);
alter table public.sbostats_segnali enable row level security;
drop policy if exists "sbostats lettura autenticati" on public.sbostats_segnali;
create policy "sbostats lettura autenticati" on public.sbostats_segnali for select to authenticated using (true);
