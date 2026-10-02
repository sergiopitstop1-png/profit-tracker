// ════════════════════════════════════════════════════════════════════
// TESTO DEL MANUALE (03/10/2026) — per aggiornarlo basta modificare qui.
// parte · sezioni · blocchi (testo, punti, passi, tabella, nota)
// ════════════════════════════════════════════════════════════════════
export type Nota = { tipo: 'attenzione' | 'consiglio' | 'regola'; testo: string }
export type Blocco = { titolo?: string; testo?: string; punti?: string[]; passi?: string[]; tabella?: string[][]; nota?: Nota }
export type Sezione = { id: string; titolo: string; intro?: string; blocchi: Blocco[] }
export type Parte = { id: string; titolo: string; sottotitolo: string; sezioni: Sezione[] }

export const AGGIORNATO = '3 ottobre 2026'

export const PARTI: Parte[] = [
// ─────────────────────────────────────────────────────────────────────
{ id: 'p1', titolo: 'Parte 1 · Primi passi', sottotitolo: 'Cosa c\'è nel Profit Tracker e le parole da conoscere', sezioni: [
  { id: 'benvenuto', titolo: 'Benvenuto: come ragiona il Profit Tracker',
    intro: 'Il Profit Tracker tiene in ordine centinaia di conti bookmaker di molti clienti. Lucy è la sua parte "intelligente": ogni giorno decide quali conti vanno mossi, come e con quanto, e prepara il lavoro. Il tuo compito è eseguire, segnare e controllare.',
    blocchi: [
      { nota: { tipo: 'regola', testo: 'Se non è segnato, non è successo. Ogni bet, ogni sessione, ogni chat con l\'assistenza va registrata nel Profit Tracker nel momento in cui la fai. Lucy decide il lavoro dei giorni successivi solo in base a quello che trova scritto.' } },
      { nota: { tipo: 'regola', testo: 'Niente si perde. Quello che non fai viene riproposto finché non lo segni come fatto, rimandato o saltato. Non serve ricordarsi le cose: serve segnarle.' } },
      { titolo: 'I tre pilastri', punti: [
        'Lucy (tab Profilazione): prepara le bet e le operazioni del giorno.',
        'Avvisi e chat: le cose da fare a mano (assistenza, documenti, slot, virtuali, riaperture).',
        'Archivio operazioni: la memoria di tutto quello che è stato fatto.',
      ] },
    ] },
  { id: 'schede', titolo: 'Le schede in alto: a cosa serve ognuna',
    intro: 'In cima alla pagina c\'è la barra delle schede. Quelle che userai ogni giorno sono Dashboard e Profilazione; le altre servono quando ti occorrono.',
    blocchi: [
      { tabella: [
        ['Scheda', 'A cosa serve', 'Quando la usi'],
        ['Dashboard', 'Cassa, scadenze, avvisi, chat da sentire, card di Lucy', 'Appena entri, ogni giorno'],
        ['💰 Accantonamenti', 'Somme messe da parte (royalty, rinnovi, risparmi)', 'Solo se te lo chiedono'],
        ['Books', 'Archivio di tutti i conti (bookmaker + intestatario) con saldo, stato e note', 'Per cercare un conto, correggere un saldo, scrivere una nota'],
        ['Wallets', 'Carte, conti e metodi di pagamento', 'Quando registri versamenti e prelievi'],
        ['Transactions', 'Tutti i movimenti di denaro', 'Per controllare o registrare un movimento'],
        ['Periodi', 'Fotografie dei conti salvate nel tempo, cash flow annuo', 'Raramente'],
        ['Memo · 📌 Post-it', 'Promemoria con data e note veloci', 'Quando c\'è qualcosa da ricordare'],
        ['Profilazione', 'Il cuore del lavoro: Lucy, bet, live, avvisi, recuperi, archivio', 'Tutti i giorni'],
        ['Clienti', 'Anagrafica, SIM, royalty e scadenze dei clienti', 'Quando arriva un cliente nuovo o cambia qualcosa'],
        ['Matrice', 'Quali bookmaker ha aperto ogni cliente (DA APRIRE / APERTO)', 'Quando si apre un conto nuovo'],
        ['🏆 Punti & Monete', 'Saldo punti per cliente e bookmaker', 'Quando aggiorni i punti fedeltà'],
        ['🔑 Credenziali', 'Accessi agli account, cifrati', 'Quando devi fare un login'],
        ['📱 SMS', 'Gli SMS arrivati sui telefoni dei clienti', 'Codici, avvisi dei book'],
        ['👥 Team', 'Promo, conti e risultati dei collaboratori', 'Se lavori in squadra'],
        ['📈 Prop Hedge · 🎲 Masaniello · Contabilità', 'Moduli dell\'amministratore', 'Solo se autorizzato'],
      ] },
      { nota: { tipo: 'consiglio', testo: 'Lucy Mail (le email e gli SMS dei bookmaker analizzati da Lucy) ha una pagina sua: la trovi all\'indirizzo /profit-tracker/archivio-lucy. È spiegata nel capitolo "Lucy Mail".' } },
    ] },
  { id: 'parole', titolo: 'Le parole da conoscere',
    blocchi: [
      { titolo: 'Conto (book)', testo: 'Un conto è sempre la coppia bookmaker + intestatario: "Sisal · Laura Corà" è un conto, "Sisal · Ivan Bozoki" è un altro. Ogni cliente ha un telefono dedicato nella farm: il pulsante 📱 apre il book proprio su quel telefono.' },
      { titolo: 'Gli stati di un conto', tabella: [
        ['Stato', 'Cosa significa', 'Cosa fa Lucy'],
        ['🟢 Profilazione (attivo)', 'Il conto sta "costruendo" il suo profilo di giocatore', 'Propone bet e sessioni frequenti secondo le schede Profiliamo'],
        ['🟡 Mantenimento', 'Il conto è già profilato e va solo tenuto vivo', 'Lo propone quando si avvicina la scadenza (di base ogni 60 giorni, dal 45°)'],
        ['⚫ Dormiente', 'Conto fermo, da non usare', 'Non lo propone mai (eccezione: i limitati in recupero)'],
        ['🔧 In recupero', 'Conto limitato che stiamo cercando di sbloccare', 'Propone volume "da giocatore" e i contatti con l\'assistenza'],
      ] },
      { titolo: 'Limitato bonus e limitato sport', punti: [
        'Limitato bonus: il book non dà più promozioni, ma si può ancora scommettere normalmente.',
        'Limitato sport: il book accetta solo puntate minime (per noi: pezzi da 2 €).',
        'Lo stato si scrive nella nota del conto con le parole chiave "limitato bonus" o "limitato sport".',
      ] },
      { titolo: 'Incrocio e copertura', testo: 'Un incrocio è una partita in cui conti diversi puntano su esiti diversi, così il risultato complessivo resta quasi neutro qualunque cosa accada. La copertura è la puntata sull\'esito opposto che "protegge" le altre. Copertura totale = protegge tutto; ridotta = Lucy lascia un piccolo vantaggio sull\'esito che PronoX ritiene più probabile.' },
      { titolo: 'Altri termini', tabella: [
        ['Termine', 'Significato'],
        ['Spot', 'Operazione una tantum, fuori dal ciclo normale (es. un conto fermo da troppo che va mosso)'],
        ['Profilazione mirata', 'Un gruppo fisso di conti che fa insieme operazioni di casinò live ogni tot giorni'],
        ['Sestina', 'Puntata su 6 numeri consecutivi della roulette (Lottomatica e GoldBet giocano solo così)'],
        ['Quota minima', 'La quota più bassa accettabile per una bet del Masaniello: sotto quella, la bet non conviene'],
        ['Rimandata / Saltata', 'Rimandata = torna nei prossimi giorni. Saltata = non torna più. Entrambe restano scritte'],
        ['PronoX', 'Il nostro modello di pronostici: stima la probabilità di ogni esito'],
        ['Masaniello', 'Metodo che calcola quanto puntare su una serie di partite per arrivare a un obiettivo con un capitale dato'],
      ] },
    ] },
] },
// ─────────────────────────────────────────────────────────────────────
{ id: 'p2', titolo: 'Parte 2 · La giornata di lavoro', sottotitolo: 'Cosa fare, in che ordine, pulsante per pulsante', sezioni: [
  { id: 'routine', titolo: 'La routine quotidiana in 10 passi',
    intro: 'Seguendo questi passi, ogni giorno, non resta indietro niente.',
    blocchi: [
      { passi: [
        'Apri la Dashboard. Guarda il banner rosso in alto: scadenze, royalty e chat con l\'assistenza da sentire. Le cose "IN RITARDO" vanno fatte per prime.',
        'Vai in Profilazione, vista "Operativa". Leggi la riga 📌 Oggi: ti dice quante chat, avvisi, conti in agenda, bet del Masaniello e incroci ci sono.',
        'Fai le chat con l\'assistenza (sezione ⚠️ Avvisi) e annota subito l\'esito di ognuna.',
        'Premi ⚽ Prepara bet, poi apri 📊 Tabella bet.',
        'Per ogni incrocio: 📱 Apri tutti, piazza le bet sui telefoni, poi CONFERMA riga per riga (oppure 🔁 Rimanda o ⏭ Salta).',
        'In fondo alla Tabella bet: le bet del Masaniello. Conferma la scheda se è nuova, poi piazza e segna ✓ con la quota reale.',
        'Fai le giocate a mano della sezione ⚠️ Avvisi (slot, virtuali, giochi offline, documenti) e segna Fatto o Rimanda.',
        'Se ci sono gruppi live (🎰 Tabella Live) o profilazioni mirate da fare, falle e registrale (✓ Giocata / ✅ Fatta).',
        'Controlla la sezione 📋 Agenda di oggi: tutti i conti proposti devono risultare mossi.',
        'Prima di chiudere apri 📚 Archivio operazioni, filtro "Oggi": quello che vedi è quello che hai fatto. Se manca qualcosa, segnalo adesso.',
      ] },
      { nota: { tipo: 'consiglio', testo: 'Non serve aprire tutte le sezioni: la riga 📌 Oggi ti dice dove c\'è lavoro. Clicca il contatore e ti porta direttamente nella sezione giusta.' } },
    ] },
  { id: 'dashboard', titolo: 'La Dashboard',
    blocchi: [
      { punti: [
        'Il banner rosso in alto raccoglie le scadenze: memo, royalty, nuovi book da segnalare e le chat da sentire (📞 [CHAT] …). Le righe rosse con "IN RITARDO DI N GIORNI" sono prioritarie.',
        'Il pulsante "📝 Annota esito" accanto a una chat ti porta direttamente nella sezione Avvisi della Profilazione, dove scegli l\'esito.',
        'La card di Lucy riassume lo stato operativo.',
        'I riquadri di cassa (saldo bookmaker, wallet, disponibile) servono all\'amministrazione: non devi modificarli.',
      ] },
    ] },
  { id: 'profilazione', titolo: 'La pagina Profilazione, pulsante per pulsante',
    intro: 'In alto a destra scegli la vista: "Operativa" (consigliata: solo quello che serve) o "Completa" (tutto aperto). Questa guida usa la vista Operativa.',
    blocchi: [
      { titolo: 'La barra dei comandi', tabella: [
        ['Pulsante', 'Cosa fa'],
        ['📋 Agenda di oggi', 'I conti da muovere oggi per profilazione e mantenimento, con l\'azione prevista'],
        ['🎰 Slot consigliate', 'L\'elenco delle slot da usare quando un\'azione chiede "slot"'],
        ['⚽ Prepara bet', 'Lucy calcola gli incroci del giorno con le quote attuali'],
        ['📊 Tabella bet', 'Tutte le bet da piazzare in un unico posto: incroci e Masaniello. Il numero indica fatte/totali e le bet del Masaniello (🎯)'],
        ['🎰 Tabella Live', 'I gruppi di casinò live proposti da Lucy per i conti in profilazione'],
        ['✓ Conferma e archivia', 'Da NON usare per ora (vedi nota sotto)'],
        ['✍️ Registro manuale', 'Per registrare un\'operazione di profilazione fatta a mano su un conto: il conto passa in Profilazione'],
        ['⏸ Pausa', 'Ferma la profilazione: solo sport (slot e casinò continuano) oppure tutta. Si può indicare la data di ripresa automatica'],
        ['⚙️', 'Impostazioni di Lucy: costo massimo di oggi, copertura minima, aggiornamento quote, azzeramento della memoria di oggi'],
        ['ℹ️ regole mantenimento', 'Apre l\'editor delle regole di mantenimento (vedi capitolo dedicato)'],
      ] },
      { nota: { tipo: 'attenzione', testo: '"✓ Conferma e archivia" salva nello storico TUTTE le bet proposte da Lucy quel giorno, anche quelle non piazzate o saltate. Le conferme riga per riga (CONFERMA / Rimanda / Salta) bastano e sono precise: non usare questo pulsante finché non viene aggiornato.' } },
      { titolo: 'Il pallino di stato', testo: 'Sotto la barra: verde "Tutto in regola" = nessun problema; giallo o rosso = c\'è qualcosa da sistemare (conti scaduti, bet non fatte da giorni). Il testo accanto spiega cosa.' },
      { titolo: 'La riga 📌 Oggi', tabella: [
        ['Contatore', 'Significato'],
        ['📞 chat da sentire', 'Contatti con l\'assistenza da fare oggi o in ritardo'],
        ['⚠️ avvisi', 'Altre cose da fare a mano (slot, virtuali, documenti, riaperture…)'],
        ['📋 in agenda', 'Conti da muovere oggi'],
        ['🎯 bet recupero PronoX', 'Bet del Masaniello da fare o da confermare'],
        ['⚽ bet da piazzare', 'Incroci fatti/totali e bet del Masaniello: apre la Tabella bet'],
      ] },
      { titolo: 'Le sezioni a scomparsa', punti: [
        '⚠️ Avvisi · chat · giocate a mano — aperta: le cose da fare a mano.',
        '📋 Agenda di oggi — aperta: profilazione e mantenimento.',
        '🎯 Recuperi con PronoX — il pannello completo del Masaniello pilota.',
        '🎰 Sessioni live — per creare una sessione di roulette o baccarat scegliendo tu i conti.',
        '🔧 Coda dei recuperi — i conti limitati attivi e in coda.',
        '🎯 Profilazioni mirate — i gruppi fissi di casinò live.',
        '📊 Pagella PronoX — quanto sono affidabili i pronostici.',
        '📚 Archivio operazioni — tutto quello che è stato fatto.',
        'Ogni sezione si apre e si chiude con un clic e si ricorda come l\'hai lasciata.',
      ] },
    ] },
  { id: 'tabella-bet', titolo: 'Prepara bet e Tabella bet: come si piazzano le bet',
    blocchi: [
      { titolo: 'Come leggere un incrocio', punti: [
        'Intestazione: numero, sport e competizione, partita, orario, mercato, "📱 Apri tutti (n)", bet fatte, costo massimo dell\'incrocio.',
        'Riga verde di PronoX: esito preferito, fiducia (modello e mercato) e quanto viene coperto l\'esito opposto.',
        'Righe dei conti: CONTO (book, intestatario, n° della bet e obiettivo) · RUOLO · ESITO (con il suo colore) · IMPORTO · QUOTA · azioni.',
        'In fondo: "Risultato se piazzi tutto" — quanto si guadagna o si perde per ogni esito.',
      ] },
      { titolo: 'I ruoli', tabella: [
        ['Ruolo', 'Perché c\'è'],
        ['Profilazione', 'Bet richiesta dal protocollo del conto in profilazione'],
        ['Recupero conto', 'Volume per un conto limitato in recupero'],
        ['Operazione spot', 'Conto da muovere una tantum'],
        ['Recupero profilazione', 'Bet di un giorno precedente non fatta, riproposta'],
        ['Mantenimento protocollo', 'Movimento periodico di un conto in mantenimento'],
        ['Copertura', 'Protegge l\'incrocio, fatta con un conto in mantenimento'],
        ['Copertura · recupero', 'Copertura fatta con un conto in recupero (quando non c\'è un conto in mantenimento libero)'],
        ['Extra', 'Puntata aggiuntiva per completare una copertura grande'],
      ] },
      { titolo: 'Come si piazza un incrocio', passi: [
        'Premi "📱 Apri tutti": i book dell\'incrocio si aprono sui telefoni dei rispettivi clienti (conferma con OK).',
        'Su ogni telefono fai il login se serve e cerca la partita.',
        'Controlla la quota: se è diversa da quella in tabella, inseriscila (le coperture si ricalcolano).',
        'Piazza la bet esattamente con l\'importo e l\'esito indicati.',
        'Torna nel Profit Tracker e premi CONFERMA sulla riga: diventa verde "✓ FATTA".',
        'Se una bet non si può fare: 🔁 Rimanda (torna nei prossimi giorni) oppure ⏭ Salta (non torna). Scrivi il motivo: aiuta a capire dopo.',
      ] },
      { nota: { tipo: 'attenzione', testo: 'Fascia rossa "COPERTURA MANCANTE": Lucy non ha trovato nessun conto libero per coprire. Se piazzi le bet base sei scoperto. Leggi il valore atteso: se è negativo, copri a mano su un altro conto oppure salta le bet base.' } },
      { titolo: 'Il piede della tabella', punti: [
        'Puntato confermato oggi, P/L teorico del piano, costo massimo impostato e margine residuo.',
        'Lucy rinvia gli incroci che farebbero superare il costo massimo del giorno.',
        'DA COMPLETARE: bet che oggi non hanno trovato posto (per ogni riga trovi tipo e motivo). Di solito mancano partite compatibili: verranno collocate nei prossimi giorni.',
      ] },
      { nota: { tipo: 'regola', testo: 'Sulla stessa partita, lo stesso bookmaker va su un solo esito (mai Sisal su 1 e Sisal su 2). Lucy lo rispetta già: non cambiare conto di tua iniziativa.' } },
    ] },
  { id: 'masaniello', titolo: 'Le bet del Masaniello (recupero conti con PronoX)',
    intro: 'Sono bet "scoperte" (senza copertura) sui conti limitati: servono a dare volume da giocatore normale ai conti in recupero, con un piano di puntate controllato.',
    blocchi: [
      { passi: [
        'In fondo alla Tabella bet trovi "💡 Lucy propone N partite": per ogni partita esito, probabilità, quota minima e puntata, divisa tra più conti.',
        'Controlla e premi "✓ Conferma scheda". Da quel momento le bet diventano "da fare".',
        'Usa 📱 Apri tutti per la partita (oppure 📱 sul singolo conto).',
        'Piazza solo se la quota del book è uguale o superiore alla QUOTA MINIMA.',
        'Premi ✓ e scrivi la quota reale presa. Se è sotto la minima, il sistema ti avvisa.',
        'Se non puoi piazzarla premi ✗: Lucy propone subito un altro conto per la stessa cifra.',
        'Gli esiti (vinta, persa, nulla) arrivano da soli dopo la partita.',
      ] },
      { nota: { tipo: 'attenzione', testo: 'Una bet non piazzata prima del fischio d\'inizio non entra nel piano: non è un problema, ma non va piazzata dopo.' } },
    ] },
  { id: 'live', titolo: 'Casinò live: Tabella Live e Sessioni live',
    blocchi: [
      { titolo: 'Tabella Live (gruppi proposti da Lucy)', punti: [
        'Ogni gruppo ha 6 conti che insieme coprono tutta la roulette (0-36).',
        '"📱 gruppo" apre tutti i book del gruppo; 📱 sulla riga apre solo quel conto.',
        'Si gioca per il numero di giri indicato con gli importi indicati.',
        'Alla fine premi "✓ Giocata" e scrivi quanti giri avete fatto davvero.',
      ] },
      { titolo: 'Sessioni live (scegli tu i conti)', passi: [
        'Apri la sezione 🎰 Sessioni live e scegli 🎡 Roulette o 🃏 Baccarat.',
        'Cerca e aggiungi i conti. Quelli già usati oggi appaiono sbiaditi con "già S1".',
        'Roulette: in "Quanti numeri" puoi fissare i numeri di un conto, il resto si divide da solo; in "€ a numero" l\'importo di quel conto. Lottomatica e GoldBet hanno la sestina.',
        'Baccarat: scegli Spot o Campionato; per ogni conto Banco o Giocatore e l\'importo a mano.',
        'Controlla la riga verde: tutti i 37 numeri coperti (roulette) o entrambi i lati coperti (baccarat), con il costo medio.',
        '📱 Apri tutti, giocate, poi "✓ Sessione giocata" con il numero di giri o mani.',
      ] },
      { nota: { tipo: 'consiglio', testo: 'I numeri non cambiano mentre lavori: cambiano solo se premi 🔀 Rimescola. Puoi comunicarli ai collaboratori con tranquillità.' } },
    ] },
  { id: 'mirate', titolo: 'Profilazioni mirate',
    blocchi: [
      { passi: [
        'Apri la sezione 🎯 Profilazioni mirate: ogni gruppo mostra i conti, l\'ultima volta e la prossima ("da fare oggi" in rosso).',
        'Premi 🎰 Numeri: si apre la tabella della sessione già compilata con i conti del gruppo.',
        'Imposta roulette o baccarat, numeri e importi come nelle Sessioni live; 📱 Apri tutti.',
        'Gioca, poi "✓ Sessione giocata": il sistema ti chiede anche di segnare il gruppo come ✅ Fatta.',
        'Scrivi la data della prossima (gg/mm) oppure lascia vuoto per la cadenza automatica. Con 📅 puoi cambiarla quando vuoi.',
      ] },
      { nota: { tipo: 'consiglio', testo: 'Se premi direttamente ✅ Fatta (senza 🎰 Numeri) il sistema chiede quanto ha giocato ogni conto: scrivilo sempre, serve all\'archivio.' } },
    ] },
  { id: 'avvisi', titolo: 'Avvisi e chat con l\'assistenza',
    blocchi: [
      { testo: 'La sezione ⚠️ Avvisi raccoglie tutto quello che va fatto a mano, raggruppato per tipo. Ogni avviso ha Fatto (con una conferma) e Rimanda. Un avviso non sparisce finché non viene segnato.' },
      { titolo: 'Le chat con l\'assistenza', passi: [
        'Apri la chat del book dal telefono del cliente (📱).',
        'Segui il motivo scritto nell\'avviso (es. chiedere la rivalutazione del conto, lo sblocco di un metodo di prelievo).',
        'Annota subito l\'esito: Risolto, In attesa di risposta oppure Rifiutato.',
        'Lucy programma da sola il passo successivo (un ricontrollo dopo qualche giorno, un nuovo tentativo dopo 30 giorni).',
      ] },
      { titolo: 'Le giocate a mano', testo: 'Slot, virtuali e giochi offline dei conti in recupero compaiono qui (le giocate sport invece le colloca Lucy negli incroci). Le sessioni casinò del mantenimento sono nell\'Agenda di oggi.' },
    ] },
  { id: 'note', titolo: 'Le note dei conti e le 6 parole chiave',
    intro: 'Nella nota di un conto (scheda Books) alcune parole fanno partire in automatico gli avvisi giusti. Scrivile esattamente così.',
    blocchi: [
      { tabella: [
        ['Parola chiave', 'Cosa succede'],
        ['limitato bonus', 'Il conto entra nel recupero, con il protocollo del suo bookmaker'],
        ['limitato sport', 'Il conto entra nel recupero sport (puntate minime) e Lucy ricontrolla periodicamente se la limitazione è stata tolta'],
        ['sentire assistenza', 'Avviso di chat con il motivo scritto nella nota (scrivi il perché!)'],
        ['chiudere e riaprire', 'Avviso di login, poi riapertura o chiusura e riapertura (massimo 2 conti a settimana)'],
        ['inviare documento', 'Avviso per l\'invio dei documenti'],
        ['riconoscimento live', 'Avviso per la verifica tramite riconoscimento'],
      ] },
      { nota: { tipo: 'attenzione', testo: 'Se cancelli una parola chiave da una nota, gli avvisi già creati NON si annullano da soli: serve la conferma dell\'amministratore. Non togliere parole chiave per "far sparire" un avviso: segnalo come fatto.' } },
    ] },
  { id: 'recuperi', titolo: 'Il recupero dei conti limitati',
    blocchi: [
      { punti: [
        'Al massimo 20 conti sono in recupero "attivo" contemporaneamente; gli altri aspettano in coda e entrano da soli quando si libera un posto.',
        'Un conto in recupero fa volume da giocatore normale (sport, slot, virtuali, giochi offline) secondo il protocollo del suo bookmaker.',
        'Dopo circa 14 giorni di volume arriva l\'avviso per contattare l\'assistenza e chiedere la rivalutazione del conto. Se rifiutano, il tentativo successivo è dopo 30 giorni.',
        'Bet365, una volta limitato, non si recupera.',
        'Il Masaniello pilota usa tutti i conti limitati (anche quelli in coda e i dormienti) per dare volume con piccole puntate.',
      ] },
    ] },
  { id: 'mantenimento', titolo: 'Le regole di mantenimento',
    blocchi: [
      { testo: 'Si aprono con "ℹ️ regole mantenimento" nella barra dei comandi. C\'è una regola per tutti i book e, se serve, una regola diversa per un singolo bookmaker (i campi lasciati vuoti seguono quella generale).' },
      { tabella: [
        ['Regola', 'Valore di partenza'],
        ['Ogni quanti giorni il conto va mosso', '60'],
        ['Quanti giorni prima torna in agenda', '15 (cioè dal 45° giorno)'],
        ['Puntata minima e massima', '5 - 30 €'],
        ['Bet per movimentazione', '1'],
        ['Riposo tra due coperture con lo stesso conto', '28 giorni'],
        ['Cosa giocare', 'sport (casinò per i book solo-casinò)'],
      ] },
      { nota: { tipo: 'attenzione', testo: 'Le regole valgono per tutti e cambiano subito il lavoro di Lucy: modificarle spetta all\'amministratore.' } },
    ] },
  { id: 'registro', titolo: 'Registro manuale, Pausa e Impostazioni',
    blocchi: [
      { titolo: '✍️ Registro manuale', testo: 'Se fai un\'operazione di profilazione di tua iniziativa (fuori da Lucy), registrala qui: cerchi il conto (es. "eurobet ivan"), indichi cosa hai fatto. Il conto passa in Profilazione ed entra nel giro, e Lucy non ti ripropone doppioni.' },
      { titolo: '⏸ Pausa', testo: 'Ferma la profilazione per un periodo: "sport" (slot e casinò continuano) oppure "totale". Si può indicare la data di ripresa automatica; altrimenti si riprende con il pulsante Riprendi.' },
      { titolo: '⚙️ Impostazioni di Lucy', punti: [
        '💰 Costo massimo oggi: la perdita massima teorica accettata per gli incroci del giorno; oltre, Lucy rinvia.',
        '🛡️ Copertura minima: quanto Lucy può ridurre la copertura quando PronoX è molto sicuro (100 = mai).',
        'Aggiorna quote: chiede quote nuove ignorando la memoria di 15 minuti (consuma crediti del servizio quote).',
        'Azzera la memoria di oggi: cancella le bet confermate oggi dalla memoria operativa. Da usare solo se richiesto.',
      ] },
    ] },
  { id: 'archivio', titolo: 'L\'Archivio operazioni',
    blocchi: [
      { punti: [
        'Una riga per ogni operazione: data, ora, tipo, cliente, book, evento, giocata, importo, quota, stato, esito, guadagno/perdita e note.',
        'Contiene: bet Sport Lucy (confermate, saltate e rimandate), Masaniello, casinò live (sessioni libere, mirate e di Lucy), profilazioni mirate.',
        'Filtri: periodo, tipo di operazione, stato e ricerca libera (cliente, book, partita).',
        '"⬇️ Excel (CSV)" scarica esattamente quello che stai vedendo.',
        'In alto: totale giocato e guadagno/perdita conosciuto.',
      ] },
      { nota: { tipo: 'consiglio', testo: 'A fine giornata filtra "Oggi" e confronta con quello che hai fatto davvero: è il modo più veloce per accorgerti di una conferma dimenticata.' } },
    ] },
  { id: 'lucymail', titolo: 'Lucy Mail: email e SMS dei bookmaker',
    intro: 'Tutte le email dei conti arrivano in una casella centrale e gli SMS dai telefoni; Lucy li legge e li classifica. La pagina è /profit-tracker/archivio-lucy.',
    blocchi: [
      { tabella: [
        ['Riquadro', 'Significato'],
        ['🔥 Opportunità', 'Bonus e promozioni con un valore economico: vanno lavorate'],
        ['⚠️ Da valutare', 'Informazioni o richieste da guardare (alcune richiedono un\'azione)'],
        ['🚨 Problemi', 'Limitazioni, sospensioni, documenti richiesti, prelievi bloccati'],
        ['⚪ Ignora', 'Pubblicità e comunicazioni senza valore'],
        ['⏳ Da analizzare', 'In coda: Lucy le analizza entro pochi minuti'],
        ['📦 Archiviate', 'Già gestite'],
      ] },
      { punti: [
        'Filtri: testo, cliente, mittente (scrivi qualche lettera e scegli dai suggerimenti), periodo, email/SMS, giudizio, categoria, priorità.',
        'Per ogni comunicazione: valore, scadenza (in giallo), analisi di Lucy e "⚡ Richiede azione" quando serve fare qualcosa.',
        '"Apri email" mostra il testo originale: in caso di dubbio controlla sempre lì (date e importi).',
        '"✓ Archivia" quando l\'hai gestita.',
        'I pollici 👍/👎 per ora registrano solo il tuo giudizio.',
      ] },
    ] },
  { id: 'telefoni', titolo: 'I telefoni e il pulsante 📱',
    blocchi: [
      { punti: [
        'Ogni cliente ha un telefono dedicato nella farm. Il pulsante 📱 manda un comando al PC dei telefoni, che apre il sito del book in Chrome sul telefono giusto.',
        '"Apri tutti" fa la stessa cosa per tutti i conti di un incrocio, di un gruppo o di una sessione, con una sola conferma.',
        'Dopo qualche secondo un messaggio dice quali telefoni si sono aperti e quali no.',
      ] },
      { nota: { tipo: 'attenzione', testo: 'Se compare "Nessuna risposta dal PC dei telefoni": lo script sul PC (book_lavorati) è spento. Avvisa l\'amministratore; nel frattempo apri il book a mano sul telefono del cliente.' } },
    ] },
] },
// ─────────────────────────────────────────────────────────────────────
{ id: 'p3', titolo: 'Parte 3 · Regole d\'oro e problemi', sottotitolo: 'Quello che non si deve mai sbagliare e cosa fare quando qualcosa non va', sezioni: [
  { id: 'regole', titolo: 'Le regole d\'oro',
    blocchi: [
      { punti: [
        'Segna tutto subito: CONFERMA, Rimanda, Salta, Fatto, ✓ Giocata. Quello che non è segnato, per Lucy non è successo.',
        'Mai operazioni su Bet365 di domenica.',
        'I conti dormienti non si usano (eccezione: i limitati in recupero, quando li propone Lucy).',
        'Sulla stessa partita, lo stesso bookmaker su un solo esito.',
        'Piazza esattamente importo ed esito indicati; se la quota è diversa, inseriscila prima di confermare.',
        'Una bet del Masaniello si piazza solo con quota uguale o superiore alla quota minima, e solo prima del fischio d\'inizio.',
        'Nelle note usa le 6 parole chiave esatte e scrivi sempre il motivo.',
        'Non cancellare parole chiave o avvisi per "fare ordine": segnali come fatti.',
        'Le credenziali sono cifrate: non copiarle fuori dal Profit Tracker.',
        'Nel dubbio, Rimanda e chiedi: una bet rimandata non è persa.',
      ] },
    ] },
  { id: 'faq', titolo: 'Cosa faccio se…',
    blocchi: [
      { tabella: [
        ['Situazione', 'Cosa fare'],
        ['La quota sul book è diversa da quella in tabella', 'Inseriscila nella riga prima di confermare: Lucy ricalcola le coperture'],
        ['Fascia rossa COPERTURA MANCANTE', 'Leggi il valore atteso: se è negativo copri a mano o salta le bet base'],
        ['Bet in "Da completare"', 'Niente: verranno collocate nei prossimi giorni quando ci saranno partite compatibili'],
        ['Il book non mi fa piazzare (limite, errore, quota sparita)', '🔁 Rimanda o ⏭ Salta con il motivo; se è una limitazione, scrivi "limitato bonus/sport" nella nota del conto'],
        ['Quota del Masaniello sotto la minima', 'Non piazzare: ✗ e Lucy propone un altro conto'],
        ['📱 non apre il telefono', 'Script del PC spento: avvisa l\'amministratore e apri a mano'],
        ['Ho confermato per sbaglio', 'Clicca su "✓ FATTA" per annullare la conferma; per Salta/Rimanda usa ↩'],
        ['Una chat è rimasta in sospeso', 'Annota "In attesa di risposta": Lucy ti ricorda di ricontrollare'],
        ['Una comunicazione di Lucy Mail sembra sbagliata', 'Apri l\'email originale e fidati del testo; segnala il caso'],
        ['Il pulsante di una sezione non apre nulla', 'Ricarica la pagina con Ctrl+F5'],
      ] },
    ] },
] },
// ─────────────────────────────────────────────────────────────────────
{ id: 'p4', titolo: 'Parte 4 · Moduli dell\'amministratore', sottotitolo: 'Per sapere cosa c\'è dietro: non servono al lavoro di tutti i giorni', sezioni: [
  { id: 'pronox', titolo: 'PronoX e la Pagella',
    blocchi: [
      { punti: [
        'PronoX stima la probabilità degli esiti (calcio e tennis). Per il calcio usa un modello statistico sui gol (Poisson con correzione Dixon-Coles) da cui ricava 80 esiti: 1X2, doppia chance, over/under, multigol, combo.',
        'La pagina /oggi mostra i pronostici del giorno; ogni mattina una procedura automatica "fotografa" i pronostici delle partite del giorno dopo, così non si possono riscrivere dopo il risultato.',
        'Ogni 6 ore un\'altra procedura scrive gli esiti delle partite finite.',
        'La Pagella confronta le fotografie con gli esiti: quando PronoX dice 70%, succede davvero 7 volte su 10? E fa meglio di un pronostico "ingenuo"? Giudizi: 🟢 affidabile, 🔴 troppo ottimista, 🟡 troppo prudente, ⚪ non aggiunge nulla, ⏳ pochi dati.',
      ] },
    ] },
  { id: 'piano-masaniello', titolo: 'Il piano Masaniello pilota',
    blocchi: [
      { punti: [
        'Capitale 500 €, obiettivo 133 vincite su 200 eventi, quota di riferimento 1,45; massimo 5 partite al giorno con quota giusta tra 1,40 e 1,60.',
        'Se si resta indietro, Lucy propone di allungare il piano (fino a 400 eventi): puntate e obiettivo si abbassano.',
        'Avviso rosso e stop delle nuove bet quando la perdita arriva a 200 €.',
        'Divisione tra i conti: pezzi da 3-8 € sui limitati bonus, 2 € sui limitati sport, massimo 25 € a settimana per conto, massimo 2 conti dello stesso book per partita.',
      ] },
    ] },
  { id: 'prop', titolo: 'Prop Hedge e Market Engine',
    blocchi: [
      { punti: [
        'Prop Hedge gestisce le challenge dei conti prop e la copertura speculare sul broker (per una Prop BUY il broker è SELL; TP broker = SL prop e viceversa), con rischio, drawdown, lotti, margine e payout.',
        'Il Market Engine produce un\'analisi direzionale (BUY, SELL o attesa), con storico e laboratorio di validazione dei segnali; XAUUSD è l\'asset principale.',
        'I bridge MT5 (MarketFeedBridge e PropHedgeBridge) portano i dati reali dal terminale; un controllo automatico segnala quando il trend iniziale non è più confermato (è un invito al controllo, non una chiusura automatica).',
        'Le stime di prezzo sono sperimentali: non sono prezzi garantiti.',
      ] },
    ] },
  { id: 'dati', titolo: 'Dati e sicurezza',
    blocchi: [
      { punti: [
        'Tutti i dati stanno in un database centrale (Supabase), che gestisce anche l\'accesso con login.',
        'Le credenziali dei conti sono cifrate; le pagine del Profit Tracker sono riservate agli utenti autorizzati.',
        'Alcune funzioni richiedono tabelle create dall\'amministratore: se manca qualcosa, il messaggio di errore lo dice esplicitamente.',
      ] },
    ] },
] },
]
