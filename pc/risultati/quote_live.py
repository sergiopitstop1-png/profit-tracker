#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
quote_live.py  ·  24/10/2026

Quando arriva un segnale Hunterbet LIVE «Gol casa» / «Gol ospiti», legge su API-Football la quota in diretta di Bet365
e la scrive sul Profit Tracker (colonna «Quota B365»). Si lancia ogni minuto con  installa_quote_live.ps1  (se non ci sono segnali nuovi esce subito
senza fare nessuna chiamata ad API-Football).

Quale quota: «Gol casa» = la casa segna ALMENO UN ALTRO gol  →  mercato «Home Team Goals» (id 58), Over (gol già segnati dalla casa + 0,5).
             «Gol ospiti»                                    →  mercato «Away Team Goals» (id 39), Over (gol già segnati dagli ospiti + 0,5).
I gol già segnati sono quelli del punteggio AL SEGNALE. Se in quel momento la quota è sospesa o la linea non c'è, riprova al minuto dopo (max 8 volte).

  python quote_live.py            → lavora davvero
  python quote_live.py --prova    → NON scrive niente sul sito: mostra solo cosa troverebbe

Usa risultati_config.json (stessa cartella, stessa chiave) e solo la libreria standard di Python.
"""
import os
import sys
from datetime import datetime

from risultati_partite import ErroreRete, QUI, carica_config, chiama, sito, somiglianza, SOGLIA_COPPIA, SOGLIA_NOME

FILE_LOG = os.path.join(QUI, 'quote_live.log')
BET = {'GOL_CASA': 58, 'GOL_OSPITI': 39}     # Home Team Goals / Away Team Goals
SOSPESA_DOPO = 4                             # dal 4° tentativo si salva anche una quota sospesa (ultimo prezzo visto)


def log(msg):
    riga = f"{datetime.now().strftime('%d/%m %H:%M:%S')}  {msg}"
    print(riga)
    try:
        if os.path.exists(FILE_LOG) and os.path.getsize(FILE_LOG) > 400_000:   # il log non cresce all'infinito
            with open(FILE_LOG, encoding='utf-8') as f:
                tieni = f.read()[-150_000:]
            with open(FILE_LOG, 'w', encoding='utf-8') as f:
                f.write(tieni)
        with open(FILE_LOG, 'a', encoding='utf-8') as f:
            f.write(riga + '\n')
    except OSError:
        pass


def partita_live(riga, live):
    """La partita in corso (da fixtures?live=all) con le squadre piu' simili a quelle del segnale."""
    migliore = None
    for p in live:
        t = p.get('teams') or {}
        sc = somiglianza(riga.get('casa'), (t.get('home') or {}).get('name'))
        so = somiglianza(riga.get('ospite'), (t.get('away') or {}).get('name'))
        punti = (sc + so) / 2
        if sc >= SOGLIA_NOME and so >= SOGLIA_NOME and punti >= SOGLIA_COPPIA and (migliore is None or punti > migliore[0]):
            migliore = (punti, p)
    return migliore[1] if migliore else None


def quota_over(risposta, bet_id, linea):
    """(quota, sospesa) dell'Over `linea` nel mercato bet_id, oppure (None, None)."""
    for r in risposta or []:
        for m in r.get('odds') or []:
            if int(m.get('id') or 0) != bet_id:
                continue
            for v in m.get('values') or []:
                valore = str(v.get('value') or '').strip().lower()
                try:
                    h = float(str(v.get('handicap')).replace(',', '.')) if v.get('handicap') not in (None, '') else None
                except ValueError:
                    h = None
                if h is None and valore.startswith('over'):
                    try:
                        h = float(valore.replace('over', '').strip().replace(',', '.'))
                    except ValueError:
                        h = None
                if valore.startswith('over') and h is not None and abs(h - linea) < 1e-9:
                    try:
                        return float(v.get('odd')), bool(v.get('suspended') or m.get('suspended'))
                    except (TypeError, ValueError):
                        return None, None
    return None, None


def controlla_api(j):
    if j.get('errors'):
        e = j['errors']
        raise ErroreRete('API-Football ha risposto: ' + (str(e)[:300]))
    return j.get('response') or []


def main(argv):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
    prova = '--prova' in argv
    cfg = carica_config()
    if not cfg.get('SEGNALI_SECRET') or not cfg.get('API_FOOTBALL_KEY'):
        print('Apri con il Blocco note il file risultati_config.json e compila segreto e api_football_key')
        return 2
    try:
        segnali = sito(cfg, '/api/segnali/quote-live').get('segnali') or []
    except ErroreRete as e:
        log('Non riesco a leggere i segnali dal sito: ' + str(e))
        return 1
    if not segnali:
        return 0                                         # niente da fare: nessuna chiamata ad API-Football
    h = {'x-apisports-key': cfg['API_FOOTBALL_KEY']}
    base = cfg['API_FOOTBALL_URL']
    log(f"{len(segnali)} segnale/i senza quota Bet365" + (' (PROVA: non scrivo)' if prova else ''))
    esiti = []
    try:
        live = controlla_api(chiama(f'{base}/fixtures?live=all', intestazioni=h))
        for s in segnali:
            tipo = s.get('tipo_segnale')
            nome = f"{s.get('casa')} – {s.get('ospite')}"
            tentativo = int(s.get('quota_b365_tentativi') or 0) + 1
            gia = s.get('score_casa_segnale') if tipo == 'GOL_CASA' else s.get('score_ospite_segnale')
            if gia is None:
                log(f'  {nome}: manca il punteggio al segnale, non so quale linea leggere')
                esiti.append({'msg_id': s['msg_id'], 'stato': 'riprova'})
                continue
            linea = int(gia) + 0.5
            p = partita_live(s, live)
            if not p:
                log(f'  {nome}: partita non trovata tra quelle in corso (tentativo {tentativo})')
                esiti.append({'msg_id': s['msg_id'], 'stato': 'riprova'})
                continue
            fid = (p.get('fixture') or {}).get('id')
            minuto = ((p.get('fixture') or {}).get('status') or {}).get('elapsed')
            risp = controlla_api(chiama(f'{base}/odds/live?fixture={fid}&bet={BET[tipo]}', intestazioni=h))
            q, sospesa = quota_over(risp, BET[tipo], linea)
            if q is None:
                log(f"  {nome}: quota Over {linea} non offerta adesso (minuto {minuto}, tentativo {tentativo})")
                esiti.append({'msg_id': s['msg_id'], 'stato': 'riprova', 'fixture_id': fid})
            elif sospesa and tentativo < SOSPESA_DOPO:
                log(f"  {nome}: quota Over {linea} @{q} sospesa (minuto {minuto}), riprovo")
                esiti.append({'msg_id': s['msg_id'], 'stato': 'riprova', 'fixture_id': fid})
            else:
                log(f"  ✓ {nome}: Over {linea} @{q}{' [sospesa]' if sospesa else ''}  (minuto {minuto})")
                esiti.append({'msg_id': s['msg_id'], 'stato': 'sospesa' if sospesa else 'ok', 'quota': q, 'linea': linea, 'fixture_id': fid})
    except ErroreRete as e:
        log('Mi fermo qui: ' + str(e))
    if prova or not esiti:
        return 0
    try:
        r = sito(cfg, '/api/segnali/quote-live', 'POST', {'righe': esiti})
        log(f"Sito: {r.get('aggiornati', 0)} righe aggiornate")
    except ErroreRete as e:
        log('Errore scrivendo sul sito: ' + str(e))
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
