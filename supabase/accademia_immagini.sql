-- Lettura delle immagini dei gruppi Telegram dell'Accademia (09/10/2026)
-- Eseguibile piu' volte.
alter table public.accademia_messaggi add column if not exists testo_immagine text;
alter table public.accademia_messaggi add column if not exists immagine_letta timestamptz;
alter table public.accademia_messaggi add column if not exists immagine_costo_usd numeric;
create index if not exists accademia_messaggi_imm_idx on public.accademia_messaggi (immagine_letta) where immagine_letta is not null;
