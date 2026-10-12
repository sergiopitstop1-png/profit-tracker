-- 11/10/2026 · Raccoglitore dei consigli dell'Accademia: Lucy legge i messaggi e ne estrae i consigli operativi
-- (slot consigliate per una promo, consigli su altre promo, bug, schemi con cui le promo sono arrivate).
-- Eseguibile piu' volte. RLS attiva e nessuna policy: si legge solo dal server (service role) con controllo admin.
create table if not exists public.accademia_consigli (
  id bigint generated always as identity primary key,
  chiave text not null unique,
  tipo text not null check (tipo in ('slot','promo','bug','pattern','file')),
  book text,
  promo text,
  argomento text,
  titolo text not null,
  consiglio text not null,
  dettagli text,
  scopo text,
  da_staff boolean not null default false,
  autori text[] not null default '{}',
  n_fonti int not null default 1,
  fonti jsonb not null default '[]'::jsonb,
  chat_titolo text,
  topic_titolo text,
  prima_data timestamptz,
  ultima_data timestamptz,
  stato text not null default 'attivo' check (stato in ('attivo','archiviato')),
  creato timestamptz not null default now(),
  aggiornato timestamptz not null default now()
);
create index if not exists accademia_consigli_tipo_idx on public.accademia_consigli (tipo, stato, ultima_data desc);
create index if not exists accademia_consigli_book_idx on public.accademia_consigli (book);
alter table public.accademia_consigli enable row level security;

create table if not exists public.accademia_consigli_stato (
  ambito text primary key,
  ultimo_msg timestamptz,
  ultimo_id bigint,
  ultima_esecuzione timestamptz,
  messaggi_letti bigint not null default 0,
  consigli_trovati bigint not null default 0,
  costo_usd numeric not null default 0,
  errori_consecutivi int not null default 0,
  ultimo_errore text,
  batch_saltati int not null default 0
);
alter table public.accademia_consigli_stato enable row level security;

-- 12/10/2026 · aggiunto il tipo 'file' (condivisione file). Per chi ha gia' creato la tabella:
alter table public.accademia_consigli drop constraint if exists accademia_consigli_tipo_check;
alter table public.accademia_consigli add constraint accademia_consigli_tipo_check check (tipo in ('slot','promo','bug','pattern','file'));

-- 12/10/2026 · elenco strutturato delle slot nominate in un consiglio (per alimentare la lista Slot consigliate del Profit)
alter table public.accademia_consigli add column if not exists slot jsonb not null default '[]'::jsonb;
