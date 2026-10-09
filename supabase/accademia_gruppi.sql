-- Elenco gruppi/topic con conteggi per la tab Telegram di Archivio Lucy (09/10/2026)
-- Eseguibile piu' volte. Solo il server (service role) puo' chiamarla.
create or replace function public.accademia_gruppi()
returns table (chat_id bigint, chat_titolo text, topic_id bigint, topic_titolo text, n bigint, ultimo timestamptz)
language sql
security definer
set search_path = public
as $$
  select m.chat_id, max(m.chat_titolo), m.topic_id, max(m.topic_titolo), count(*)::bigint, max(m.data_msg)
  from public.accademia_messaggi m
  group by m.chat_id, m.topic_id
$$;
revoke all on function public.accademia_gruppi() from public, anon, authenticated;
grant execute on function public.accademia_gruppi() to service_role;
