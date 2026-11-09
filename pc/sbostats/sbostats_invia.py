#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
sbostats_invia.py  ·  09/11/2026

Tiene aperto il browser con SBOStats (Match Analysis) e, ogni N minuti, rilegge le prime pagine e manda
i pronostici nuovi (e gli esiti aggiornati) al Profit Tracker: scheda Segnali > SBOStats.
La prima volta carica anche lo storico (di default le ultime 100 pagine, circa mille pronostici).

  python sbostats_invia.py                 → resta in esecuzione e invia ogni N minuti
  python sbostats_invia.py --una-volta     → un solo giro e poi esce (per l'Utilita' di pianificazione)
  python sbostats_invia.py --storico 300   → rilegge le ultime 300 pagine (anche se lo storico e' gia' stato caricato)
  python sbostats_invia.py --prova         → legge ma NON invia niente al sito

Il login a SBOStats si fa a mano nel browser (la sessione resta nella cartella profilo_browser: non condividerla).
Il programma non clicca niente, non tocca password: cambia solo il numero di pagina nell'indirizzo (?page=N), con una pausa fra una pagina e l'altra.
La configurazione sta in sbostats_config.json (si crea al primo avvio).
"""
import json
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

from playwright.sync_api import sync_playwright

import estrai_sbostats as est

QUI = Path(__file__).resolve().parent
FILE_CONFIG = QUI / 'sbostats_config.json'
FILE_STATO = QUI / 'sbostats_stato.json'
FILE_LOG = QUI / 'sbostats.log'
CONFIG_BASE = {
    'segreto': '',                                   # = SEGNALI_SECRET su Vercel (lo stesso degli altri lettori sul PC)
    'sito_url': 'https://sergioapicella.it',
    'url_sbostats': est.START_URL,
    'minuti_ciclo': 30,                              # ogni quanto rilegge
    'pagine_ciclo': 5,                               # quante pagine rilegge a ogni giro (10 pronostici a pagina, i piu' recenti per primi)
    'pagine_storico': 100,                           # storico caricato la prima volta
}


def log(msg):
    riga = f"{datetime.now().strftime('%d/%m %H:%M:%S')}  {msg}"
    print(riga, flush=True)
    try:
        if FILE_LOG.exists() and FILE_LOG.stat().st_size > 400_000:   # il log non cresce all'infinito
            FILE_LOG.write_text(FILE_LOG.read_text(encoding='utf-8')[-150_000:], encoding='utf-8')
        with FILE_LOG.open('a', encoding='utf-8') as f:
            f.write(riga + '\n')
    except OSError:
        pass


def carica_config():
    if not FILE_CONFIG.exists():
        FILE_CONFIG.write_text(json.dumps(CONFIG_BASE, indent=2, ensure_ascii=False), encoding='utf-8')
        print(f'\nHo creato {FILE_CONFIG.name}. Aprilo col Blocco note, scrivi il "segreto" (SEGNALI_SECRET di Vercel) e rilancia.')
        return None
    try:
        cfg = {**CONFIG_BASE, **json.loads(FILE_CONFIG.read_text(encoding='utf-8-sig'))}
    except ValueError as ex:
        print(f'{FILE_CONFIG.name} non e\' un JSON valido: {ex}')
        return None
    return cfg


def carica_stato():
    try:
        return json.loads(FILE_STATO.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return {}


def salva_stato(stato):
    FILE_STATO.write_text(json.dumps(stato, indent=2), encoding='utf-8')


def invia(cfg, righe):
    """Manda le righe al sito a blocchi di 500. Ritorna True se tutto e' andato a buon fine."""
    url = cfg['sito_url'].rstrip('/') + '/api/segnali/sbostats'
    for i in range(0, len(righe), 500):
        blocco = [{k: r[k] for k in ('data', 'partita', 'campionato', 'pronostico', 'frequenza', 'quota_teorica', 'risultato', 'esito')}
                  for r in righe[i:i + 500]]
        req = urllib.request.Request(
            url, data=json.dumps({'righe': blocco}).encode('utf-8'), method='POST',
            headers={'Content-Type': 'application/json', 'x-pt-segreto': cfg['segreto'], 'User-Agent': 'ProfitTrackerPC/1.0'})
        try:
            with urllib.request.urlopen(req, timeout=90) as resp:
                log(f"  Sito: {resp.read().decode('utf-8', 'replace')[:200]}")
        except urllib.error.HTTPError as ex:
            corpo = ex.read().decode('utf-8', 'replace')[:300]
            log(f"  ERRORE dal sito {ex.code}: {corpo}" + ('  (segreto sbagliato?)' if ex.code == 401 else ''))
            return False
        except Exception as ex:   # rete assente, timeout…
            log(f"  Invio non riuscito ({type(ex).__name__}: {str(ex)[:120]}): riprovo al prossimo giro")
            return False
    return True


def leggi(pagina, cfg, n_pagine):
    """Apre la pagina 1 dell'elenco e legge n_pagine pagine di fila. Ritorna la lista di righe."""
    pagina.goto(est.with_page(cfg['url_sbostats'], 1), wait_until='domcontentloaded')
    records = {}
    est.capture_auto(pagina, records, n_pagine)
    return list(records.values())


def main():
    args = sys.argv[1:]
    prova = '--prova' in args
    una_volta = '--una-volta' in args
    storico = None
    if '--storico' in args:
        try:
            storico = int(args[args.index('--storico') + 1])
        except (IndexError, ValueError):
            print('Uso: --storico NUMERO_PAGINE')
            return 1
    cfg = carica_config()
    if cfg is None:
        return 1
    if not cfg['segreto'] and not prova:
        print(f'Manca il "segreto" in {FILE_CONFIG.name}.')
        return 1

    stato = carica_stato()
    with sync_playwright() as p:
        ctx = est.launch(p)
        try:
            login = ctx.pages[0] if ctx.pages else ctx.new_page()
            login.goto(cfg['url_sbostats'], wait_until='domcontentloaded')
            lavoro = ctx.new_page()   # scheda di lavoro: quella con il login la puoi usare liberamente

            # sessione valida? se non vedo la tabella aspetto che tu faccia il login nel browser
            while True:
                try:
                    login.wait_for_selector('tbody tr td', timeout=15000)
                except Exception:
                    pass
                if est.read_rows(login):
                    break
                input('\nNel browser accedi a SBOStats e apri Match Analysis. Quando vedi la tabella premi INVIO qui... ')
                login.reload(wait_until='domcontentloaded')
                time.sleep(2)
            log('Sessione SBOStats OK. Lascia il browser aperto.')

            primo = True
            segnalato_vuoto = False
            while True:
                try:
                    if storico is not None or (primo and not stato.get('storico_fatto')):
                        pagine = storico if storico is not None else int(cfg['pagine_storico'])
                        log(f'Carico lo storico: {pagine} pagine (ci vuole qualche minuto)…')
                    else:
                        pagine = int(cfg['pagine_ciclo'])
                        log(f'Giro di controllo: {pagine} pagine')
                    righe = leggi(lavoro, cfg, pagine)
                    log(f'  Letti {len(righe)} pronostici')
                    if not righe:
                        if not segnalato_vuoto:
                            log('  Nessuna riga letta: sessione scaduta o pagina cambiata? Controlla il browser (accedi di nuovo se serve).')
                            segnalato_vuoto = True
                    else:
                        segnalato_vuoto = False
                        if prova:
                            log('  --prova: non invio niente. Esempio: ' + json.dumps(righe[0], ensure_ascii=False)[:250])
                        elif invia(cfg, righe):
                            if storico is not None or not stato.get('storico_fatto'):
                                stato['storico_fatto'] = True
                            stato['ultimo_invio'] = datetime.now().isoformat(timespec='seconds')
                            salva_stato(stato)
                    storico = None
                    primo = False
                except Exception as ex:
                    if 'closed' in str(ex).lower():
                        log('Il browser e\' stato chiuso: esco.')
                        break
                    log(f'  Errore nel giro: {type(ex).__name__}: {str(ex)[:150]}')
                if una_volta:
                    break
                attesa = max(1, int(cfg['minuti_ciclo'])) * 60
                log(f'Prossimo giro tra {attesa // 60} minuti.')
                for _ in range(attesa):
                    time.sleep(1)
                    if all(t.is_closed() for t in ctx.pages):
                        log('Il browser e\' stato chiuso: esco.')
                        return 0
        except KeyboardInterrupt:
            log('Interrotto.')
        finally:
            try:
                ctx.close()
            except Exception:
                pass
    return 0


if __name__ == '__main__':
    code = main()
    sys.exit(code)
