# 🏖️ sTablo

Il campo digitale del **tavolino di Rimini** — il gioco che fonde calcio, ping pong e
footvolley/teqball. Segna le partite, scala la classifica **Elo**, sblocca livelli e
caratteristiche stile carta FIFA, organizza **tornei** in ogni formato.

PWA mobile-first, tema chiaro/scuro, animazioni. Costruita per girare su **Vercel**
con **Vercel Postgres** (Neon) — niente Supabase.

---

## ✨ Funzionalità

- **Account self-service** + ruolo **admin** (inserisce risultati, crea tornei, gestisce rosa).
- **Partite** 1v1 e 2v2, con team (coppie con alias) e punteggio esatto.
  - Ogni partita/torneo è **🏆 Classificata** (muove l'Elo) o **🤝 Amichevole** (solo XP).
- **Classifiche** Elo separate: singolo, doppio, team — più punti e % vittorie.
- **Profilo gamificato**: livello/XP, 5 caratteristiche (Potenza, Tecnica, Costanza,
  Difesa, Clutch), 10 stili di gioco, piede preferito, **mossa speciale**, card collezionabile.
  - **Privacy**: ogni utente sceglie se rendere pubbliche le stats di gamification
    (classifica e risultati restano sempre pubblici).
- **Tornei**: Campionato (Serie A, calendario a giornate, andata/ritorno), Girone
  all'italiana, Eliminazione diretta, Gironi + eliminazione, Sistema Svizzero.
- **Amici**: richieste con notifica da accettare + **QR / link** per aggiungersi al volo.

---

## 🧱 Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · Drizzle ORM · Vercel Postgres
(Neon) · Auth.js v5 · Framer Motion · Recharts · PWA.

---

## 🚀 Setup su Vercel (consigliato)

1. **Importa il repo** su [vercel.com](https://vercel.com) → New Project.
2. **Crea il database**: nel progetto → tab **Storage** → **Create Database** →
   **Postgres** → **Connect**. Vercel inietta automaticamente `POSTGRES_URL`.
3. **Variabili d'ambiente** (Settings → Environment Variables):
   - `AUTH_SECRET` — genera con `npx auth secret` (o `openssl rand -base64 32`).
   - `ADMIN_EMAIL` *(opzionale)* — la prima registrazione con questa email diventa admin.
4. **Crea le tabelle**: da locale, con `POSTGRES_URL` nel `.env`, esegui:
   ```bash
   npm run db:push       # crea lo schema sul database
   npm run db:seed       # (opzionale) 7 giocatori + superadmin + partite demo
   ```
5. **Deploy**. Fatto. 🎉

> Il **primo utente** che si registra diventa automaticamente **admin** (oppure imposta
> `ADMIN_EMAIL`). In alternativa il seed crea un superadmin (vedi sotto).

---

## 💻 Sviluppo locale

```bash
cp .env.example .env        # inserisci POSTGRES_URL e AUTH_SECRET
npm install
npm run db:push             # sincronizza lo schema
npm run db:seed             # dati di esempio (opzionale)
npm run dev                 # http://localhost:3000
```

### Account superadmin (dal seed)

Il seed crea un account admin:

- email: `ADMIN_EMAIL` (default `admin@stablo.app`)
- password: `ADMIN_PASSWORD` (default `tavolino2026`) — **cambiala!**

I 7 giocatori iniziali: mesh, bernu, edo, toro, dadda, pau, jaco.

---

## 📜 Script

| Comando | Cosa fa |
|---|---|
| `npm run dev` | Sviluppo locale |
| `npm run build` | Build di produzione |
| `npm run db:generate` | Genera le migrazioni SQL dallo schema |
| `npm run db:push` | Applica lo schema al database |
| `npm run db:migrate` | Esegue le migrazioni |
| `npm run db:studio` | Drizzle Studio (GUI del DB) |
| `npm run db:seed` | Popola giocatori, admin e partite demo |

---

## 🧮 Come funziona l'Elo

Rating tipo scacchi con moltiplicatore **margine di vittoria** (un 15-2 pesa più di un
15-13). Singolo e doppio hanno rating separati; i team hanno il proprio Elo. Le partite
**amichevoli** danno solo XP e non toccano l'Elo. Dopo modifiche/eliminazioni il sistema
**ricalcola** tutti i rating rigiocando lo storico, così niente drift.

## 🏓 Il gioco

Disciplina nata a Rimini, parente di footvolley/teqball: palla colpita con qualsiasi
parte del corpo tranne mani/braccia, servizio di testa con rimbalzo sul tavolo. **Si
vince arrivando a 18 punti** (con scarto, ai vantaggi).
