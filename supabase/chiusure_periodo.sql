-- 28/11/2026 · CHIUSURE AUTOMATICHE DI FINE MESE E ARCHIVIO DELL'ANNO
-- Eseguire UNA volta nel SQL Editor di Supabase (si può rieseguire senza danni).
--
-- chiusure_periodo: una riga per mese chiuso, con la fotografia dei dati. Non si modifica e non si cancella.
-- chiudi_periodo('2026-12') fa tutto in un colpo solo: legge saldi e movimenti, scrive il periodo in
--   weekly_snapshots (tab Periodi) e salva la fotografia. La chiusura di dicembre contiene l'archivio dell'anno.
-- chiudi_periodo('2026-12', false) = ANTEPRIMA: non scrive niente.

create table if not exists public.chiusure_periodo (
  periodo       text primary key check (periodo ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  data_chiusura date        not null,
  istante       timestamptz not null,              -- mezzanotte italiana di fine mese
  eseguita      timestamptz not null default now(),
  in_ritardo    boolean     not null default false,
  books         numeric     not null,
  wallets       numeric     not null,
  cassa         numeric     not null,
  apertura_anno numeric     not null,
  prelievi_anno numeric     not null,
  profitto_anno numeric     not null,
  fotografia    jsonb       not null
);
-- Nessuna policy: si legge e si scrive solo dal server
alter table public.chiusure_periodo enable row level security;

create or replace function public.chiusure_non_modificabili() returns trigger language plpgsql as $$
begin
  raise exception 'Le chiusure sono congelate: non si modificano e non si cancellano';
end $$;

drop trigger if exists chiusure_periodo_congelate on public.chiusure_periodo;
create trigger chiusure_periodo_congelate before update or delete on public.chiusure_periodo
  for each row execute function public.chiusure_non_modificabili();
drop trigger if exists chiusure_periodo_no_truncate on public.chiusure_periodo;
create trigger chiusure_periodo_no_truncate before truncate on public.chiusure_periodo
  for each statement execute function public.chiusure_non_modificabili();

create or replace function public.chiudi_periodo(p_periodo text, p_salva boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
set timezone = 'UTC'
as $$
declare
  v_inizio   date;
  v_fine     date;
  v_anno     int;
  v_istante  timestamptz;
  v_da_anno  timestamptz;
  v_adesso   timestamptz := clock_timestamp();
  v_taglio   timestamptz;
  v_books    numeric;
  v_wallets  numeric;
  v_dopo     numeric;
  v_cassa    numeric;
  v_prelievi numeric;
  v_apertura numeric;
  v_profitto numeric;
  v_ritardo  boolean;
  v_foto     jsonb;
begin
  if p_periodo !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Periodo non valido: %', p_periodo;
  end if;
  v_inizio  := (p_periodo || '-01')::date;
  v_fine    := (v_inizio + interval '1 month' - interval '1 day')::date;
  v_anno    := extract(year from v_inizio);
  v_istante := (v_fine + 1)::timestamp at time zone 'Europe/Rome';
  v_da_anno := make_date(v_anno, 1, 1)::timestamp at time zone 'Europe/Rome';

  if p_salva then
    perform pg_advisory_xact_lock(hashtext('chiudi_periodo'));
    if exists (select 1 from chiusure_periodo where periodo = p_periodo) then
      return jsonb_build_object('gia_fatta', true, 'periodo', p_periodo);
    end if;
    if v_adesso < v_istante then
      raise exception 'Il periodo % non è ancora finito', p_periodo;
    end if;
    -- mentre fotografa, nessuno può scrivere saldi o movimenti
    lock table books, wallets, transactions in share mode;
  end if;

  v_taglio := least(v_istante, v_adesso);

  if v_anno <= 2026 then
    v_apertura := 57229.62;
  else
    select c.cassa into v_apertura from chiusure_periodo c where c.periodo = (v_anno - 1) || '-12';
    if v_apertura is null then
      raise exception 'Manca la chiusura di dicembre %: senza quella non c''è la cassa di apertura', v_anno - 1;
    end if;
  end if;

  select coalesce(sum(b.saldo::numeric), 0) into v_books from books b;
  select coalesce(sum(w.saldo::numeric), 0) into v_wallets from wallets w;
  select coalesce(sum(t.importo::numeric), 0) into v_prelievi from transactions t
    where t.azione = 'wallet_to_external' and t.data::timestamptz >= v_da_anno and t.data::timestamptz < v_taglio;
  -- se la chiusura parte in ritardo, i prelievi esterni fatti dopo mezzanotte tornano in cassa
  select coalesce(sum(t.importo::numeric), 0) into v_dopo from transactions t
    where t.azione = 'wallet_to_external' and t.data::timestamptz >= v_istante;

  v_cassa    := round(v_books + v_wallets + v_dopo, 2);
  v_prelievi := round(v_prelievi, 2);
  v_profitto := round(v_cassa + v_prelievi - v_apertura, 2);
  v_ritardo  := v_adesso > v_istante + interval '15 minutes';

  if p_salva then
    insert into weekly_snapshots (snapshot_date, total_cash, external_withdrawals, base_cash_month, profit)
    values (v_fine, v_cassa, v_prelievi, v_apertura, v_profitto)
    on conflict (snapshot_date) do update set
      total_cash = excluded.total_cash, external_withdrawals = excluded.external_withdrawals,
      base_cash_month = excluded.base_cash_month, profit = excluded.profit;
  end if;

  v_foto := jsonb_build_object(
    'books',   (select coalesce(jsonb_agg(to_jsonb(b) order by b.id), '[]') from books b),
    'wallets', (select coalesce(jsonb_agg(to_jsonb(w) order by w.id), '[]') from wallets w),
    'dashboard_settings', (select to_jsonb(d) from dashboard_settings d where d.id = 1),
    'prelievi_dopo_mezzanotte', v_dopo
  );

  -- archivio dell'anno (dicembre, e anche l'anteprima)
  if extract(month from v_inizio) = 12 then
    v_foto := v_foto || jsonb_build_object(
      'periodi', (select coalesce(jsonb_agg(to_jsonb(s) order by s.snapshot_date), '[]') from weekly_snapshots s),
      'movimenti', (select coalesce(jsonb_agg(to_jsonb(t) order by t.data, t.id), '[]') from transactions t
                    where t.data::timestamptz >= v_da_anno and t.data::timestamptz < v_taglio),
      'contabilita_programmata', (select coalesce(jsonb_agg(to_jsonb(s) order by s.mese, s.ordine, s.id), '[]') from stime_cassa s where s.anno = v_anno),
      'spese_gestione', (select coalesce(jsonb_agg(to_jsonb(c) order by c.data_movimento, c.id), '[]') from contabilita c
                    where c.data_movimento::timestamptz >= v_da_anno and c.data_movimento::timestamptz < v_taglio),
      'clienti', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nome', c.nome) order by c.nome), '[]') from clienti c),
      'royalty_accordi', (select coalesce(jsonb_agg(to_jsonb(a) order by a.id), '[]') from royalty_accordi a),
      'royalty_pagamenti', (select coalesce(jsonb_agg(to_jsonb(p) order by p.id), '[]') from royalty_pagamenti p),
      'risparmi_movimenti', (select coalesce(jsonb_agg(to_jsonb(m) order by m.data, m.id), '[]') from risparmi_movimenti m),
      'risparmi_tassi', (select coalesce(jsonb_agg(to_jsonb(r) order by r.valido_dal), '[]') from risparmi_tassi r)
    );
  end if;

  if p_salva then
    insert into chiusure_periodo (periodo, data_chiusura, istante, eseguita, in_ritardo, books, wallets, cassa, apertura_anno, prelievi_anno, profitto_anno, fotografia)
    values (p_periodo, v_fine, v_istante, v_adesso, v_ritardo, round(v_books, 2), round(v_wallets, 2), v_cassa, v_apertura, v_prelievi, v_profitto, v_foto);
  end if;

  return jsonb_build_object(
    'gia_fatta', false, 'periodo', p_periodo, 'salvata', p_salva, 'data_chiusura', v_fine, 'istante', v_istante,
    'eseguita', v_adesso, 'in_ritardo', v_ritardo, 'books', round(v_books, 2), 'wallets', round(v_wallets, 2),
    'cassa', v_cassa, 'apertura_anno', v_apertura, 'prelievi_anno', v_prelievi, 'profitto_anno', v_profitto,
    'fotografia', case when p_salva then null else v_foto end
  );
end $$;

-- La può chiamare solo il server
revoke all on function public.chiudi_periodo(text, boolean) from public, anon, authenticated;
grant execute on function public.chiudi_periodo(text, boolean) to service_role;

-- I movimenti di un anno chiuso non si modificano e non si cancellano
create or replace function public.movimenti_anno_chiuso() returns trigger
language plpgsql security definer set search_path = public set timezone = 'UTC' as $$
declare v_limite timestamptz;
begin
  select max(istante) into v_limite from chiusure_periodo where periodo like '%-12';
  if v_limite is not null and old.data::timestamptz < v_limite then
    raise exception 'Movimento di un anno chiuso: non si può modificare né eliminare';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists transactions_anno_chiuso on public.transactions;
create trigger transactions_anno_chiuso before update or delete on public.transactions
  for each row execute function public.movimenti_anno_chiuso();
