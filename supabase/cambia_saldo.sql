-- 20/10/2026 · cambia_saldo: aggiorna il saldo di un book o di un wallet con "saldo = saldo + importo"
-- direttamente nel database (importo negativo = toglie). Evita che una pagina aperta con saldi vecchi
-- sovrascriva le operazioni fatte altrove. Se la riga non esiste (o le regole di accesso la nascondono) dà errore.
-- Già eseguito da Sergio in Supabase (SQL Editor) il 20/10/2026. Solo aggiunta: non tocca tabelle né dati.

create or replace function public.cambia_saldo(
  p_tabella text,
  p_id bigint,
  p_importo numeric
)
returns numeric
language plpgsql
as $$
declare
  nuovo numeric;
begin
  if p_tabella = 'books' then
    update public.books
       set saldo = coalesce(saldo, 0) + p_importo
     where id = p_id
    returning saldo into nuovo;
  elsif p_tabella = 'wallets' then
    update public.wallets
       set saldo = coalesce(saldo, 0) + p_importo
     where id = p_id
    returning saldo into nuovo;
  else
    raise exception 'tabella non valida: %', p_tabella;
  end if;

  if not found then
    raise exception 'riga non trovata (% id %)', p_tabella, p_id;
  end if;

  return nuovo;
end;
$$;

revoke all on function public.cambia_saldo(text, bigint, numeric) from public;
grant execute on function public.cambia_saldo(text, bigint, numeric) to anon, authenticated, service_role;
