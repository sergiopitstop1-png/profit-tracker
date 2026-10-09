-- Messaggi dei gruppi Telegram dell'Accademia del Profitto (letti dal PC fisso)
-- Contenuto riservato: RLS attiva e NESSUNA policy di lettura, quindi si legge solo
-- dal server (service role) con controllo del ruolo, mai direttamente dal browser.
create table if not exists public.accademia_messaggi (
  id bigint generated always as identity primary key,
  chat_id bigint not null,
  chat_titolo text,
  topic_id bigint,
  topic_titolo text,
  msg_id bigint not null,
  data_msg timestamptz not null,
  modificato_il timestamptz,
  mittente text,
  testo text,
  media_tipo text,
  link text,
  raccolto timestamptz not null default now(),
  unique (chat_id, msg_id)
);
create index if not exists accademia_messaggi_data_idx on public.accademia_messaggi (data_msg desc);
create index if not exists accademia_messaggi_chat_topic_idx on public.accademia_messaggi (chat_id, topic_id, data_msg desc);
create index if not exists accademia_messaggi_testo_idx on public.accademia_messaggi using gin (to_tsvector('italian', coalesce(testo, '')));
alter table public.accademia_messaggi enable row level security;
