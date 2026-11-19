-- Eplay24: il book si scrive senza trattino (19/11/2026, Sergio)
-- Nella Matrice il book "E-Play24" diventa "Eplay24". Il Profit Tracker lo mostra gia' cosi' anche senza questo file:
-- serve solo a sistemare il database una volta per tutte.
-- Eseguire una sola volta nel SQL Editor di Supabase (si puo' rilanciare senza danni).
-- Non tocca la tabella books: i Book gia' creati con il trattino vengono riconosciuti lo stesso dal codice.

-- (facoltativo) controllo prima di lanciare:
-- select bookmaker, count(*) from public.matrice_bookmakers where bookmaker ilike 'e-play24' group by bookmaker;

-- se per lo stesso cliente esiste gia' una riga "Eplay24" la riga col trattino resta com'e' (niente doppioni): controllala a mano
update public.matrice_bookmakers m
   set bookmaker = 'Eplay24', updated_at = now()
 where m.bookmaker ilike 'e-play24'
   and not exists (select 1 from public.matrice_bookmakers x where x.cliente = m.cliente and x.bookmaker = 'Eplay24');

-- (facoltativo) righe rimaste col trattino, da controllare a mano:
-- select id, cliente, bookmaker, stato from public.matrice_bookmakers where bookmaker ilike 'e-play24';
