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
      "È il tuo punto di partenza: un colpo d'occhio su come stai andando e cosa fare adesso.",
    sections: [
      {
        heading: "Cosa trovi qui",
        points: [
          "Le tue statistiche principali e l'andamento recente.",
          "Scorciatoie rapide per registrare una partita o aprire un torneo.",
          "Eventuali risultati in attesa di conferma da parte tua.",
        ],
      },
      {
        heading: "Da dove iniziare",
        points: [
          "Tocca «Nuova partita» per registrare un risultato in pochi secondi.",
          "Apri la Classifica per vedere la tua posizione.",
          "Completa il profilo per sbloccare badge ed esperienza (XP).",
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
        heading: "Generale, Singolo, Doppio e Team",
        points: [
          "Quattro schede: «Generale» unisce tutto, poi Singolo (1v1), Doppio (2v2) e Team.",
          "La scheda «Team» mostra l'Elo delle coppie registrate.",
          "Solo le partite «Classificate» 🏆 muovono l'Elo: le «Amichevoli» 🤝 danno solo XP.",
          "Il picco (peak) è l'Elo più alto che hai mai raggiunto.",
        ],
      },
    ],
  },

  partite: {
    title: "Le Partite",
    emoji: "🎾",
    intro:
      "Qui trovi lo storico delle partite e registri i nuovi risultati.",
    sections: [
      {
        heading: "Registrare e confermare",
        points: [
          "Tocca «Nuova partita» per inserire un risultato (1v1 o 2v2).",
          "Quando proponi un risultato, l'avversario riceve una notifica e deve confermarlo.",
          "Se non conferma entro 24 ore, il risultato viene confermato automaticamente e ricevi una notifica.",
        ],
      },
      {
        heading: "Stati di una partita",
        points: [
          "⏳ In attesa: proposta inserita, manca la conferma.",
          "✓ Confermata: conteggiata in classifica (se «Classificata»).",
          "Puoi rifiutare una proposta sbagliata prima che venga confermata.",
        ],
      },
      {
        heading: "Cercare e filtrare",
        points: [
          "Filtra per tipo: Tutte, 1 vs 1 o 2 vs 2.",
          "Cerca per nome di un giocatore o di un team.",
          "Restringi per data con i campi «Dal» e «Al».",
          "Tocca «Azzera filtri» per tornare all'elenco completo.",
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
          "Scegli «Classificata» 🏆 (muove l'Elo) o «Amichevole» 🤝 (solo XP).",
          "Seleziona i giocatori e imposta i punteggi (puoi digitarli o usare + / −).",
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
          "Nel doppio scegli i singoli giocatori: niente team da preimpostare.",
          "Il punteggio non può finire in parità.",
          "Se non sei admin, il risultato va confermato dall'avversario.",
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
          "🏆 Campionato: tutti contro tutti, classifica a punti.",
          "🔄 Girone all'italiana: round robin a girone unico.",
          "⚔️ Eliminazione diretta: tabellone a eliminazione.",
          "🌍 Gironi + eliminazione: gironi e poi fase finale.",
          "🇨🇭 Svizzero: accoppiamenti per punteggio, turno dopo turno.",
          "🟡 Americano: coppie a rotazione, classifica individuale a punti (min. 4 giocatori).",
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
    ],
  },

  "nuovo-torneo": {
    title: "Creare un torneo",
    emoji: "🆕",
    intro: "Imposta formato, disciplina e partecipanti.",
    sections: [
      {
        heading: "Le scelte principali",
        points: [
          "Formato: campionato, eliminazione, gironi o svizzero.",
          "Disciplina: Singolo (1v1) o Doppio (2v2). Nel doppio formi le coppie al volo.",
          "Classificato 🏆 muove l'Elo, Amichevole 🤝 dà solo XP.",
        ],
      },
      {
        heading: "Partecipanti",
        points: [
          "Nel singolo selezioni i giocatori: l'ordine di scelta dà le teste di serie.",
          "Nel doppio tocchi due giocatori per formare una coppia.",
          "Se crei un torneo aperto, ricevi un link/QR da condividere per le iscrizioni.",
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
          "Vedi Elo, statistiche, stile di gioco e badge.",
          "Dal profilo di un altro giocatore, tocca «Testa a testa» per vedere il vostro storico di sfide dirette.",
          "Aggiungi un giocatore agli amici per seguirlo più da vicino.",
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
        ],
      },
      {
        heading: "Account e notifiche",
        points: [
          "Cambia la password dalla sezione Sicurezza.",
          "Attiva le notifiche push per ricevere avvisi su conferme, amici e inviti — anche con l'app chiusa.",
          "Su iPhone, installa prima l'app dalla schermata Home, poi attiva le notifiche.",
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
          "Gli amici si possono invitare direttamente ai tornei privati.",
        ],
      },
    ],
  },
};
