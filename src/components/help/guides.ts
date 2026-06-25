/**
 * Per-page help content shown by <HelpButton topic="..." />.
 * Plain data so it stays easy to edit. Keep it short, friendly, in Italian.
 */
export type GuideSection = { heading: string; points: string[] };
export type Guide = {
  title: string;
  emoji: string;
  intro?: string;
  sections: GuideSection[];
};

export const GUIDES: Record<string, Guide> = {
  home: {
    title: "La tua Home",
    emoji: "🏠",
    intro:
      "Il punto di partenza: il podio, le ultime partite e le scorciatoie per giocare.",
    sections: [
      {
        heading: "Cosa trovi qui",
        points: [
          "Il podio con i primi tre della classifica generale.",
          "Le ultime partite giocate da tutta la community.",
          "I numeri d'insieme: giocatori, partite e tornei.",
        ],
      },
      {
        heading: "Da dove iniziare",
        points: [
          "Tocca «Nuova partita» per registrare un risultato in pochi secondi.",
          "Apri la Classifica per vedere la tua posizione.",
          "Gioca e vinci per guadagnare XP, salire di livello e sbloccare i trofei.",
        ],
      },
    ],
  },

  classifica: {
    title: "Come funziona la Classifica",
    emoji: "🏆",
    intro:
      "La classifica ordina i giocatori in base all'Elo: più vinci contro avversari forti, più sali.",
    sections: [
      {
        heading: "Elo, in breve",
        points: [
          "Ogni giocatore parte da 1000 punti.",
          "Vincere fa salire l'Elo, perdere lo fa scendere.",
          "Battere un avversario più forte vale più punti; perdere contro uno più debole ne toglie di più.",
        ],
      },
      {
        heading: "Stagione, Generale, Singolo e Doppio",
        points: [
          "Quattro schede: «Stagione» è il mese in corso, poi «Generale» (tutto), Singolo (1v1) e Doppio (2v2).",
          "Solo le partite «Classificate» 🏆 muovono l'Elo: le «Amichevoli» 🤝 danno solo XP.",
          "Il picco (peak) è l'Elo più alto che hai mai raggiunto.",
        ],
      },
      {
        heading: "Stagioni e MVP",
        points: [
          "Ogni mese è una stagione a sé: la scheda «Stagione» riparte da zero il primo del mese.",
          "In stagione conta chi vince di più: 3 punti a vittoria, solo partite classificate.",
          "Chi guida la stagione è l'MVP del mese, in evidenza in cima alla scheda.",
          "All'inizio di ogni mese ricevi un push con il recap e l'MVP della stagione appena chiusa.",
        ],
      },
    ],
  },

  partite: {
    title: "Le Partite",
    emoji: "🎾",
    intro:
      "Qui trovi lo storico delle partite, programmi le sfide e registri i nuovi risultati.",
    sections: [
      {
        heading: "Registrare e confermare",
        points: [
          "Tocca «Nuova partita» per inserire un risultato (1v1 o 2v2).",
          "Quando proponi un risultato, l'avversario riceve una notifica e deve confermarlo.",
          "Se non conferma entro 24 ore, il risultato viene confermato automaticamente e ricevi una notifica.",
          "Eccezione: la vostra primissima partita classificata insieme non si auto-conferma mai — serve una conferma esplicita. Così nessuno può inventarsi una partita per salire di Elo.",
        ],
      },
      {
        heading: "Contestare un risultato",
        points: [
          "Se il punteggio è sbagliato — o la partita non l'hai mai giocata — tocca «Contesta» invece di confermare.",
          "Scegli un motivo (es. «Il punteggio non è corretto» o «Non ho giocato questa partita») e invia.",
          "La partita diventa «conteso»: l'auto-conferma si ferma e chi ha proposto riceve una notifica.",
          "Un admin verifica e decide: conferma il risultato oppure annulla la partita. Finché non decide, l'Elo non si muove.",
          "Chi ha proposto può anche annullare la propria proposta e rifarla corretta.",
        ],
      },
      {
        heading: "Programmare una sfida",
        points: [
          "Tocca «Programma» per fissare una sfida futura: scegli avversario, data e ora.",
          "L'avversario riceve una notifica e la sfida compare in «Prossime sfide».",
          "Quando la sfida si avvicina (entro 24 ore) ricevi un promemoria push.",
          "Dopo aver giocato, apri la sfida e inserisci il risultato: poi segue la normale conferma.",
        ],
      },
      {
        heading: "Stati di una partita",
        points: [
          "📅 In programma: sfida fissata, ancora da giocare.",
          "⏳ Da confermare: proposta inserita, manca la conferma dell'avversario.",
          "⚠️ Conteso: l'avversario ha contestato — in attesa che un admin verifichi.",
          "✓ Confermata: conteggiata in classifica (se «Classificata») e nello storico mostra il punteggio.",
          "Puoi contestare una proposta sbagliata o annullare una sfida in programma.",
        ],
      },
      {
        heading: "La card di una partita",
        points: [
          "Ogni card mostra data e ora, il nome e lo @username di chi ha giocato, se è 🏆 Classificata o 🤝 Amichevole.",
          "Se la partita fa parte di un torneo, vedi il suo nome (con ⚔️): tocchi e vai al torneo.",
          "Tocca un punto qualsiasi della card per aprire il dettaglio della partita con reazioni e commenti.",
          "Tocca invece un nome per andare al profilo di quel giocatore.",
        ],
      },
      {
        heading: "Reazioni e commenti",
        points: [
          "Apri una partita e tocca un'emoji (🔥 👏 😂 💪 🎯 😱) per reagire: ritocca per togliere la reazione.",
          "Scrivi un commento per festeggiare, sfottere l'avversario o ricordare quel punto ai vantaggi.",
          "Chi gioca la partita riceve una notifica quando arriva un nuovo commento.",
          "Puoi cancellare i tuoi commenti; l'admin può rimuoverne qualsiasi.",
        ],
      },
      {
        heading: "Cercare e filtrare",
        points: [
          "Filtra per tipo: Tutte, 1 vs 1 o 2 vs 2.",
          "Cerca per nome, soprannome, username o nome del torneo.",
          "Restringi per data con i campi «Dal» e «Al».",
          "Tocca «Azzera filtri» per tornare all'elenco completo.",
          "In fondo, «Carica altre» mostra lo storico più vecchio a blocchi.",
        ],
      },
    ],
  },

  programma: {
    title: "Programmare una sfida",
    emoji: "⚔️",
    intro:
      "Fissa una partita futura e sfida un avversario: il risultato lo registri dopo aver giocato.",
    sections: [
      {
        heading: "Come funziona",
        points: [
          "Scegli 1 vs 1 o 2 vs 2 e se la sfida sarà «Classificata» 🏆 o «Amichevole» 🤝.",
          "Indica chi sfidi (e i compagni, nel doppio): tocca la casella e cerca per nome. Poi imposta data e ora.",
          "Al volo del «Lancia la sfida», l'avversario riceve una notifica.",
          "La sfida appare in «Prossime sfide» nella pagina Partite.",
        ],
      },
      {
        heading: "Dopo aver giocato",
        points: [
          "Apri la sfida e inserisci il punteggio: diventa una proposta da confermare.",
          "Solo chi gioca la sfida (o un admin) può registrarne il risultato.",
          "Chi ha creato la sfida, un partecipante o un admin possono annullarla finché è in programma.",
          "Quando la sfida si avvicina (entro 24 ore) ricevi un promemoria push, se hai attivato le notifiche.",
        ],
      },
    ],
  },

  "nuova-partita": {
    title: "Registrare una partita",
    emoji: "➕",
    intro: "Inserisci un risultato in pochi tocchi.",
    sections: [
      {
        heading: "Passo per passo",
        points: [
          "Scegli 1 vs 1 o 2 vs 2.",
          "Scegli «Classificata» 🏆 (muove l'Elo) o «Amichevole» 🤝 (solo XP): per le partite non esiste pubblico/privato, questa è l'unica distinzione.",
          "Tocca una casella giocatore: si apre un elenco cercabile per nome o username, con foto e soprannome per scegliere la persona giusta.",
          "Imposta i punteggi (puoi digitarli o usare + / −).",
          "Data e ora si compilano da sole con l'istante del salvataggio, se le lasci vuote.",
        ],
      },
      {
        heading: "Punteggio del tavolino",
        points: [
          "Si vince arrivando a 15 punti.",
          "Sul 14-14 si va ai vantaggi: serve uno scarto di 2 punti (es. 16-14, 17-15).",
          "A 19-19 scatta il killer point: il 20° punto è decisivo (20-19).",
        ],
      },
      {
        heading: "Buono a sapersi",
        points: [
          "Nel doppio scegli i due giocatori della coppia.",
          "Lo stesso giocatore non può stare in due caselle: chi è già scelto sparisce dalle altre.",
          "Il punteggio non può finire in parità.",
          "Se non sei admin, il risultato va confermato dall'avversario.",
          "Per le classificate vedi in anteprima quanti punti Elo sposta il risultato.",
          "Subito dopo il salvataggio hai dieci minuti per annullare l'inserimento se hai sbagliato qualcosa.",
        ],
      },
    ],
  },

  tornei: {
    title: "I Tornei",
    emoji: "⚔️",
    intro:
      "Crea e segui campionati, gironi e tabelloni. Ogni torneo ha la sua classifica o il suo bracket.",
    sections: [
      {
        heading: "Formati disponibili",
        points: [
          "🏆 Campionato: tutti contro tutti, classifica a punti. Puoi giocarlo con andata e ritorno (ogni sfida due volte) o solo andata.",
          "⚔️ Eliminazione diretta: tabellone a eliminazione.",
          "🌍 Gironi + eliminazione: gironi e poi fase finale.",
          "🏔️ Svizzero: a ogni turno sei accoppiato con chi ha il tuo stesso punteggio. Il «numero turni» è quante partite gioca ciascuno; vince chi totalizza più punti (3 a vittoria, niente pareggi).",
          "🟡 Americano: coppie a rotazione (a ogni turno cambi compagno e avversari). Classifica individuale per punti totali segnati, non 3/1/0 (min. 4 giocatori).",
        ],
      },
      {
        heading: "Pubblico o privato",
        points: [
          "🌍 Pubblico: compare nella lista tornei e chiunque può vederlo e iscriversi col link.",
          "🔒 Privato: nascosto dalla lista; lo vedono ed entrano solo le persone che inviti tu o con cui condividi il link.",
          "Un torneo privato può essere solo amichevole 🤝: i tornei classificati 🏆 muovono l'Elo e la classifica generale, quindi sono sempre pubblici.",
          "Lo decidi quando crei un torneo a «invito aperto».",
        ],
      },
      {
        heading: "Stati del torneo",
        points: [
          "⏳ In attesa: aperto alle iscrizioni, non ancora avviato.",
          "In corso: il calendario è generato e si gioca.",
          "Concluso: c'è un vincitore decretato.",
        ],
      },
      {
        heading: "🏆 Albo d'oro",
        points: [
          "Dal pulsante «Albo d'oro» apri la bacheca dei trofei di sempre.",
          "Campioni dei tornei: ogni torneo concluso col suo vincitore, dal più recente.",
          "MVP delle stagioni: il numero 1 della classifica classificata di ogni mese passato (👑 sul mese più recente).",
          "Resta lì per sempre: è la memoria storica del gruppo.",
        ],
      },
    ],
  },

  "nuovo-torneo": {
    title: "Creare un torneo",
    emoji: "🆕",
    intro: "Due modi per creare: invito aperto col link, oppure scegli subito i partecipanti.",
    sections: [
      {
        heading: "Due modalità",
        points: [
          "🔗 Invito aperto: crei il torneo e ottieni un link/QR da condividere. Ognuno si iscrive da solo e parte quando lo avvii.",
          "👥 Scegli i partecipanti (admin): selezioni tu chi gioca (o le coppie) e il torneo parte subito.",
        ],
      },
      {
        heading: "Pubblico o privato (invito aperto)",
        points: [
          "🌍 Pubblico: compare nella lista tornei, chiunque può vederlo e iscriversi col link.",
          "🔒 Privato: nascosto dalla lista; lo vedono ed entrano solo le persone che inviti tu o con cui condividi il link.",
          "Un privato può essere solo amichevole 🤝: se vuoi un torneo classificato 🏆 (che muove l'Elo) dev'essere pubblico.",
        ],
      },
      {
        heading: "Formato e disciplina",
        points: [
          "Formato: campionato, eliminazione diretta, gironi + eliminazione, svizzero o americano.",
          "Nel campionato puoi attivare «Andata e ritorno» per far giocare ogni sfida due volte.",
          "Disciplina: Singolo (1v1) o Doppio (2v2). Nel doppio formi le coppie al volo.",
          "Classificato 🏆 muove l'Elo, Amichevole 🤝 dà solo XP.",
        ],
      },
      {
        heading: "Impostazioni per formato",
        points: [
          "Svizzero · «Numero turni»: quante partite gioca ciascuno (una per turno). A ogni turno vieni accoppiato con chi ha un punteggio simile; vince chi totalizza più punti (3 a vittoria, niente pareggi).",
          "Americano · «Punti per game»: a quanti punti finisce ogni mini-partita (es. 15). Non è un 3/1/0: in classifica conta la somma dei punti che segni davvero.",
          "Americano · «Turni»: quanti giri di rotazione giocare. Lascialo vuoto per il calcolo automatico in base al numero di giocatori.",
        ],
      },
      {
        heading: "Scegliere i partecipanti",
        points: [
          "Nel singolo selezioni i giocatori: l'ordine di scelta dà le teste di serie.",
          "Nel doppio tocchi un giocatore e poi il suo compagno per formare la coppia.",
          "Si apre un elenco cercabile per nome o username, con foto e soprannome: comodo quando siete in tanti.",
        ],
      },
    ],
  },

  torneo: {
    title: "Dentro al torneo",
    emoji: "📋",
    intro:
      "Da qui segui calendario, classifica o tabellone e registri i risultati.",
    sections: [
      {
        heading: "Mentre è in attesa",
        points: [
          "Condividi il link o il QR per far iscrivere i partecipanti.",
          "Servono almeno 2 iscritti per avviare.",
          "L'organizzatore (o un admin) avvia il torneo: il calendario si genera da solo.",
        ],
      },
      {
        heading: "Mentre è in corso",
        points: [
          "Inserisci i risultati delle partite in programma.",
          "Classifica e tabellone si aggiornano automaticamente.",
          "Nei gironi, la fase finale si genera quando i gironi sono completi.",
          "Nello svizzero, generi il turno successivo quando il turno è completo.",
        ],
      },
    ],
  },

  giocatori: {
    title: "I Giocatori",
    emoji: "👥",
    intro: "L'elenco di tutti i giocatori, con i numeri principali.",
    sections: [
      {
        heading: "Cosa puoi fare",
        points: [
          "Usa la barra di ricerca per trovare subito un giocatore per nome o nickname.",
          "Tocca un giocatore per aprire il suo profilo completo.",
          "Vedi Elo, statistiche, stile di gioco e i trofei sbloccati.",
          "Dal profilo di un altro giocatore, tocca «Testa a testa» per vedere il vostro storico di sfide dirette.",
          "Aggiungi un giocatore agli amici per seguirlo più da vicino.",
          "Il badge 🛡️ Admin segnala gli amministratori della community, nella lista e sul profilo.",
        ],
      },
      {
        heading: "Approfondimenti del profilo",
        points: [
          "«Forma recente» mostra l'esito delle ultime partite (V verde, S rossa), dalla più vecchia alla più recente.",
          "«La tua nemesi» 😤 è chi ti ha battuto più spesso; «Vittima preferita» 🎯 chi hai battuto di più.",
          "«Miglior compagno» 🤝 è il partner di doppio con cui vinci di più.",
          "Compaiono dopo qualche partita contro lo stesso avversario o con lo stesso compagno.",
        ],
      },
    ],
  },

  profilo: {
    title: "Il tuo Profilo",
    emoji: "🧑",
    intro:
      "Gestisci i tuoi dati, la sicurezza e come ti vedono gli altri.",
    sections: [
      {
        heading: "Personalizzazione",
        points: [
          "Carica una foto profilo: sostituisce le iniziali ovunque (viene ritagliata quadrata). Con «Rimuovi» torni alle iniziali.",
          "Imposta nickname, motto, piede preferito, stile di gioco e mossa speciale.",
          "Scegli se rendere pubbliche o private le tue statistiche di gioco.",
          "Più completi il profilo, più la tua scheda è ricca.",
          "In fondo trovi la tua bacheca trofei: si sbloccano giocando e vincendo.",
        ],
      },
      {
        heading: "Personalizza la card",
        points: [
          "Le caratteristiche (Potenza, Tecnica, Costanza, Difesa, Clutch) partono dalle tue partite, ma puoi ridistribuirle a piacere.",
          "Hai un budget di punti che cresce col livello: per alzare una stat devi abbassarne un'altra, così i giocatori dello stesso livello restano coerenti.",
          "Ogni stat ha anche un tetto massimo legato al livello: niente 99 ovunque a livello basso, te li guadagni giocando.",
          "È solo estetica: non cambia Elo né classifica. Con «Ripristina auto» torni alla card calcolata dalle tue partite.",
        ],
      },
      {
        heading: "Account e notifiche",
        points: [
          "Cambia la password dalla sezione Sicurezza.",
          "Se dimentichi la password, chiedi a un amministratore: può generarti una password temporanea da cambiare poi qui.",
          "Con «Installa l'app» aggiungi sTablo alla schermata Home (se non l'hai già fatto): si apre a tutto schermo come un'app vera. Se sei già nell'app installata, il riquadro sparisce.",
          "Le notifiche push si attivano con un tocco quando l'app te lo propone; da qui puoi gestirle o disattivarle in qualsiasi momento.",
          "Servono per avvisi su conferme, amici e inviti — anche con l'app chiusa.",
          "Su iPhone l'ordine conta: prima installa l'app dalla schermata Home, poi consenti le notifiche (le notifiche push su iPhone funzionano solo dentro l'app installata).",
        ],
      },
    ],
  },

  amici: {
    title: "Gli Amici",
    emoji: "🤝",
    intro:
      "Collega gli account per invitarvi ai tornei e restare aggiornati.",
    sections: [
      {
        heading: "Come funziona",
        points: [
          "Invia una richiesta di amicizia: l'altra persona riceve una notifica.",
          "Quando accetta, diventate amici.",
          "Dai tuoi tornei puoi invitare gli amici con un tocco, anche senza condividere il link (utile soprattutto per i tornei privati).",
        ],
      },
    ],
  },

  notifiche: {
    title: "Le Notifiche",
    emoji: "🔔",
    intro:
      "Il centro notifiche raccoglie tutto quello che ti riguarda: conferme, sfide, commenti, inviti e recap.",
    sections: [
      {
        heading: "La campanella",
        points: [
          "La campanella in alto mostra le azioni in sospeso: risultati da confermare, richieste di amicizia e inviti ai tornei.",
          "Il numero rosso conta quante azioni aspettano una tua risposta.",
          "Tocca una voce per aprirla e rispondere al volo.",
        ],
      },
      {
        heading: "Il centro notifiche",
        points: [
          "Da «Centro notifiche» trovi lo storico completo: conferme, sfide, nuovi commenti, inviti e recap di stagione.",
          "Le notifiche non ancora lette sono evidenziate; si segnano come lette appena apri la pagina.",
          "Tocca una notifica per andare dritto alla partita, al torneo o alla sezione giusta.",
        ],
      },
      {
        heading: "Anche con l'app chiusa",
        points: [
          "Se attivi le notifiche push, ricevi gli avvisi sul telefono anche senza avere l'app aperta.",
          "Le gestisci (o le disattivi) dal tuo Profilo, nella sezione «Account e notifiche».",
          "Su iPhone installa prima l'app dalla schermata Home, poi consenti le notifiche.",
        ],
      },
    ],
  },
};
