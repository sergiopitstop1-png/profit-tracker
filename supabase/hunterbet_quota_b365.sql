-- Hunterbet: quota Bet365 letta in diretta da API-Football quando arriva il segnale (24/10/2026)
-- Solo colonne nuove e vuote: non cambia ne' cancella nessun dato. Si puo' rilanciare senza danni.
alter table if exists public.hunterbet_segnali
  add column if not exists quota_b365 numeric,                  -- quota Over (gol gia' segnati dalla squadra + 0,5) di Bet365, al momento della lettura
  add column if not exists quota_b365_linea numeric,            -- la linea letta (es. 1.5)
  add column if not exists quota_b365_il timestamptz,           -- quando e' stata letta
  add column if not exists quota_b365_stato text,               -- ok | sospesa | riprova | fallita
  add column if not exists quota_b365_tentativi integer default 0;
notify pgrst, 'reload schema';
