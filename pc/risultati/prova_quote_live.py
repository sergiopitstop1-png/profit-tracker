#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
prova_quote_live.py  ·  24/10/2026

PROVA (non scrive niente sul sito): chiede ad API-Football
  1. l'elenco dei mercati disponibili nelle quote in diretta (odds/live/bets): ci dice se c'e' «segna la squadra» / «prossimo gol»
  2. le quote in diretta di ogni partita in corso (odds/live), con i mercati che parlano di gol
e salva tutto in  quote_live_prova.txt  (stessa cartella) da incollare nella chat.
Usa la stessa chiave di risultati_config.json. Fanno 2 chiamate in tutto. Va lanciato mentre ci sono partite in corso.
"""
import os
import sys

from risultati_partite import ErroreRete, QUI, carica_config, chiama

USCITA = os.path.join(QUI, 'quote_live_prova.txt')
righe = []


def dico(t=''):
    print(t)
    righe.append(t)


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
    cfg = carica_config()
    if not cfg.get('API_FOOTBALL_KEY'):
        print('Apri con il Blocco note il file risultati_config.json e compila api_football_key')
        return 2
    h = {'x-apisports-key': cfg['API_FOOTBALL_KEY']}
    base = cfg['API_FOOTBALL_URL']
    try:
        j = chiama(f'{base}/odds/live/bets', intestazioni=h)
        if j.get('errors'):
            dico('Risposta con errori: ' + str(j['errors'])[:300])
        bets = j.get('response') or []
        parole = ('goal', 'score', 'gol', 'scorer')
        dico(f'== MERCATI IN DIRETTA DISPONIBILI: {len(bets)} (qui sotto solo quelli che parlano di gol) ==')
        for b in bets:
            if any(x in str(b.get('name') or '').lower() for x in parole):
                dico(f"  {b.get('id')}: {b.get('name')}")
        dico()
        j = chiama(f'{base}/odds/live', intestazioni=h)
        if j.get('errors'):
            dico('Risposta con errori: ' + str(j['errors'])[:300])
        resp = j.get('response') or []
        dico(f'== PARTITE IN CORSO CON QUOTE: {len(resp)} ==')
        if not resp:
            dico('Nessuna partita in corso con quote: riprova mentre ci sono partite.')
        for r in resp[:3]:
            f, t = r.get('fixture') or {}, r.get('teams') or {}
            st = f.get('status') or r.get('status') or {}
            dico(f"\n-- {(t.get('home') or {}).get('name')} - {(t.get('away') or {}).get('name')}   minuto {st.get('elapsed')}   (fixture {f.get('id')})")
            for m in r.get('odds') or []:
                nome = str(m.get('name') or '')
                if any(x in nome.lower() for x in parole):
                    vals = ', '.join(f"{v.get('value')} {v.get('handicap') or ''} @{v.get('odd')}" + (' [sospesa]' if v.get('suspended') else '') for v in (m.get('values') or [])[:6])
                    dico(f"   {m.get('id')} {nome}: {vals}")
    except ErroreRete as e:
        dico('Errore: ' + str(e))
        return 1
    finally:
        with open(USCITA, 'w', encoding='utf-8') as f:
            f.write('\n'.join(righe))
    print(f'\nSalvato anche in {USCITA}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
