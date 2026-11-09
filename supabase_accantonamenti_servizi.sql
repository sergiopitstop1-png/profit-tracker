-- Eseguire una sola volta nel SQL Editor di Supabase.
-- Flag mensili usati dagli Accantonamenti per i 4 servizi software.
alter table public.dashboard_settings
  add column if not exists chatgpt_openai_pagato_mese text,
  add column if not exists supabase_database_pagato_mese text,
  add column if not exists anthropic_claude_pagato_mese text,
  add column if not exists vercel_deployment_pagato_mese text;

-- 09/11/2026: flag mensili dei servizi aggiunti dopo (API-Football, Sbostats).
alter table public.dashboard_settings
  add column if not exists api_football_pagato_mese text,
  add column if not exists sbostats_pagato_mese text;
