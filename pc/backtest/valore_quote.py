# -*- coding: utf-8 -*-
"""
VALORE NELLE QUOTE · c'è un margine reale giocando le quote dei book contro Pinnacle?
Per ogni partita: probabilità "giusta" = Pinnacle in chiusura senza margine.
Si guarda cosa succede giocando 1 unità sulle quote di ciascun book (e sulla migliore tra più book)
quando la quota supera la quota giusta. Non usa il modello PronoX, non tocca il database.
Solo libreria standard di Python. Usa gli stessi file scaricati da backtest_pronox.py (cartella dati).
"""
import argparse
import math
import os
import sys
import datetime as dt

import backtest_pronox as bt

# (nome, colonne 1X2 casa/X/ospite)
FONTI_1X2 = [
    ('bet365 (quota di inizio settimana)', ('B365H', 'B365D', 'B365A')),
    ('bet365 (chiusura)', ('B365CH', 'B365CD', 'B365CA')),
    ('Bwin', ('BWH', 'BWD', 'BWA')),
    ('Interwetten', ('IWH', 'IWD', 'IWA')),
    ('William Hill', ('WHH', 'WHD', 'WHA')),
    ('VC Bet', ('VCH', 'VCD', 'VCA')),
    ('MIGLIORE tra i 5 book sopra (inizio settimana)', None),  # calcolata
    ('MIGLIORE di tutti i book del file (Max, inizio settimana)', ('MaxH', 'MaxD', 'MaxA')),
    ('MIGLIORE di tutti i book del file (Max, chiusura)', ('MaxCH', 'MaxCD', 'MaxCA')),
]
CINQUE = ['bet365 (quota di inizio settimana)', 'Bwin', 'Interwetten', 'William Hill', 'VC Bet']
RIF_1X2 = [('PSCH', 'PSCD', 'PSCA'), ('PSH', 'PSD', 'PSA')]  # Pinnacle chiusura (poi Pinnacle)
SOGLIE = [0.0, 0.02, 0.05]


def carica(leghe, stagioni):
    corrente = stagioni[-1]
    sel = []  # una riga per selezione
    for lega in leghe:
        for stag in stagioni:
            path = bt.scarica(lega, stag, corrente)
            if not path:
                continue
            for r in bt.leggi_csv(path):
                d = bt.data_da(r.get('Date'))
                try:
                    hg, ag = int(float(r['FTHG'])), int(float(r['FTAG']))
                except (KeyError, TypeError, ValueError):
                    continue
                if d is None:
                    continue
                rif = None
                for cols in RIF_1X2:
                    v = [bt.numero(r.get(c)) for c in cols]
                    if all(v):
                        rif = v
                        break
                if not rif:
                    continue
                giuste = bt.senza_margine(rif)
                esito = 0 if hg > ag else (1 if hg == ag else 2)
                quote = {}
                for nome, cols in FONTI_1X2:
                    if cols:
                        v = [bt.numero(r.get(c)) for c in cols]
                        if all(v):
                            quote[nome] = v
                if all(n in quote for n in CINQUE):
                    quote['MIGLIORE tra i 5 book sopra (inizio settimana)'] = [max(quote[n][k] for n in CINQUE) for k in range(3)]
                for k in range(3):
                    for nome, v in quote.items():
                        sel.append((nome, stag, k == esito, v[k], giuste[k]))
    return sel


def stat(righe):
    n = len(righe)
    if n == 0:
        return None
    prof = [(q - 1) if vinta else -1.0 for (_, _, vinta, q, _) in righe]
    ev = [q * p - 1 for (_, _, _, q, p) in righe]
    m = sum(prof) / n
    var = sum((x - m) ** 2 for x in prof) / max(1, n - 1)
    return {'n': n, 'roi': m, 'se': math.sqrt(var / n), 'ev': sum(ev) / n,
            'vinte': sum(1 for x in righe if x[2]) / n, 'quota': sum(x[3] for x in righe) / n}


def riga(testo, s):
    if not s:
        return f'  {testo:<26} nessuna giocata'
    return (f'  {testo:<26} giocate {s["n"]:>6} | valore atteso {s["ev"]*100:+5.1f}% | ROI reale {s["roi"]*100:+5.1f}% ± {1.96*s["se"]*100:.1f}'
            f' | quota media {s["quota"]:.2f}')


def main():
    ap = argparse.ArgumentParser(description='Valore delle quote dei book contro Pinnacle')
    ap.add_argument('--leghe', default=','.join(bt.LEGHE))
    ap.add_argument('--stagioni', default=','.join(bt.STAGIONI_DEFAULT))
    args = ap.parse_args()
    leghe = [x.strip() for x in args.leghe.split(',') if x.strip() in bt.LEGHE]
    stagioni = [x.strip() for x in args.stagioni.split(',') if x.strip()]

    righe_out = []
    def out(t=''):
        print(t)
        righe_out.append(t)

    print('Leggo i dati (se mancano li scarico)…')
    sel = carica(leghe, stagioni)
    out(f'VALORE NELLE QUOTE · QUOTE DEI BOOK CONTRO PINNACLE · {dt.date.today().strftime("%d/%m/%Y")}')
    out(f'Leghe: {", ".join(bt.LEGHE[l] for l in leghe)} · stagioni {stagioni[0]}–{stagioni[-1]} · {len(sel)} selezioni 1X2 valutate')
    if not sel:
        out('Nessun dato: controlla la connessione e riprova.')
        return
    out('Quota giusta = Pinnacle in chiusura senza margine. "Valore atteso" = quanto rende in media la quota rispetto a quella giusta;')
    out('"ROI reale" = quanto ha reso davvero giocando 1 unità (± = margine di errore al 95%). Se il valore atteso è positivo ma il ROI reale no, è fortuna/sfortuna.')

    nomi = [n for n, _ in FONTI_1X2]
    for nome in nomi:
        s_nome = [x for x in sel if x[0] == nome]
        if not s_nome:
            continue
        out(f'\n=== {nome} ===')
        out(riga('tutte le selezioni', stat(s_nome)))
        for t in SOGLIE:
            out(riga(f'solo valore ≥ {t*100:.0f}%', stat([x for x in s_nome if x[3] * x[4] - 1 >= t])))
        out(riga('quota 1,40-1,60, val ≥ 0%', stat([x for x in s_nome if 1.40 <= x[3] <= 1.60 and x[3] * x[4] - 1 >= 0])))
        out(riga('quota 1,40-1,60, val ≥ 2%', stat([x for x in s_nome if 1.40 <= x[3] <= 1.60 and x[3] * x[4] - 1 >= 0.02])))

    chiave = 'MIGLIORE tra i 5 book sopra (inizio settimana)'
    base = [x for x in sel if x[0] == chiave and x[3] * x[4] - 1 >= 0.02]
    if base:
        out(f'\n=== STABILITÀ NEGLI ANNI · {chiave}, valore ≥ 2% ===')
        for stag in sorted({x[1] for x in base}):
            out(riga(f'stagione {stag}', stat([x for x in base if x[1] == stag])))

    out('\nCOME LEGGERE: guarda la sezione «MIGLIORE tra i 5 book». Se con valore ≥ 2% il valore atteso resta positivo (e il ROI reale non è chiaramente negativo)')
    out('in tutte le stagioni, esiste un margine sfruttabile scegliendo ogni volta il book che paga di più. Se invece è sotto zero, conviene solo con più book/alert veloci.')
    out('ATTENZIONE: sono quote di inizio settimana, non garantite al momento in cui giochi; i limiti di puntata e le limitazioni dei conti non sono considerati.')
    try:
        with open(os.path.join(bt.CARTELLA, 'report_valore_quote.txt'), 'w', encoding='utf-8') as f:
            f.write('\n'.join(righe_out) + '\n')
        print('\nSalvato: report_valore_quote.txt (nella stessa cartella dello script).')
    except Exception as e:
        print('Report non salvato:', e)


if __name__ == '__main__':
    sys.exit(main())
