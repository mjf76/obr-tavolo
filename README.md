# OBR Tavolo

Estensione per **Owlbear Rodeo** che porta il gioco in presenza sul telefono: ogni giocatore muove il proprio personaggio (e in seguito gestisce la scheda D&D 5.5) dal telefono, la mappa sta sul TV, il master lavora dal tablet.

Stato: **v0.3.0**: assegnazione dei PG, app del giocatore, **schede 5.5 da JSON**, bestiario del master e tiri condivisi.

---

## Cosa fa adesso

| Chi | Cosa vede |
|---|---|
| **Master** (ruolo GM in OBR) | Stato della griglia (con pulsante "Imposta 5-10-5"), permessi della stanza, elenco dei personaggi con assegnazione a giocatore, giocatori connessi, avviso se lo schermo TAVOLO è entrato come GM |
| **Giocatore** | Il proprio personaggio e il pulsante **Apri il mio personaggio**, che apre l'app a schermo intero (vedi sotto) |
| **TAVOLO** (giocatore chiamato `TAVOLO`, o forzato in "Questo dispositivo") | Vista fissa su **tutta la mappa**, riadattata quando cambia la mappa o la finestra; il master può reinquadrarla dalla scheda Partita. Riceve le notifiche dei tiri |

**App del giocatore** (schermo intero sul telefono): home con ritratto del PG, PF (con barra), CA e condizioni; in basso quattro pulsanti che aprono un popup chiudibile con la X:

- **Movimento** — la pulsantiera (vedi sotto); la mappa resta visibile
- **Combattimento** — *Stato*: danno/cura/PF temporanei (i temporanei assorbono per primi), CA, condizioni 5.5, Indebolimento 0-6, concentrazione, tiri salvezza contro la morte a 0 PF; *Azioni*: azione / azione bonus / reazione del turno (armi e incantesimi dalla scheda, in arrivo); scorciatoia al Movimento
- **Esplorazione** — riposo lungo (PF al massimo, Indebolimento −1), pulizia condizioni; riposo breve, rituali e prove in arrivo
- **Scheda** — segnaposto della scheda completa in stile D&D Beyond (Step 5)

PF e CA sono scritti sul token con le chiavi di *Stat Bubbles for D&D*: se l'estensione è attiva, le barre sul TV si aggiornano da sole.

**Pulsantiera di movimento**: croce direzionale a 8 direzioni, contatore del movimento in piedi e metri con la regola **5-10-5** (letta dalla griglia della scena), suggerimento sul costo della prossima diagonale, annulla ultimo passo, azzera, vista che segue il token. Da PC funzionano anche le frecce, il tastierino numerico e Q/E/Z/C per le diagonali.

**Assegnazione**: dal pannello del master oppure dal menu del token ("Assegna a giocatore", visibile solo al master). Il legame è salvato nel token con id e nome del giocatore: se un giocatore rientra con un id diverso ma lo stesso nome, viene ricollegato in automatico.

---

## Schede e mostri (v0.3)

### Preparazione, prima della sessione (sul tablet del master)
1. **Preparazione → 📂 Importa JSON** e seleziona i file:
   - le schede dei PG;
   - il bestiario `dati/bestiario-mm2024-ita.json` (590 mostri del Manuale dei Mostri 2024 in italiano, con il testo inglese dove manca la traduzione).

   L'archivio resta sul tablet (IndexedDB): basta importarlo una volta.
2. Dai ai token in Owlbear lo stesso nome della scheda o del mostro (es. `Goblin guerriero`, `Goblin guerriero 2`, oppure il nome inglese).
3. **🔗 Abbina per nome**:
   - i token assegnati a un giocatore ricevono la scheda PG;
   - gli altri ricevono il mostro, con PF pieni, CA e statistiche nascoste ai giocatori.

   In alternativa: seleziona uno o più token, cerca il mostro e premi **Collega**.

### In sessione
- **Master, scheda Partita**: tocca un token per vederne il blocco statistiche. I tiri per colpire e i danni sono pulsanti; c'è il riquadro Danno/Cura e l'elenco di tutti i PF in scena. I tiri dei mostri sono segreti, salvo l'opzione "visibili anche sul TV".
- **Giocatore**:
  - **Scheda**: caratteristiche, tiri salvezza, abilità, attacchi, incantesimi, inventario, privilegi; si tira con un tocco, scegliendo prima Vantaggio o Svantaggio.
  - **Combattimento → Azioni**: attacchi, incantesimi preparati con consumo degli slot, risorse.
  - **Esplorazione**: riposo breve con Dadi Vita, riposo lungo completo, prove e incantesimi rituali.
- **Tiri**: il risultato compare grande sul telefono di chi tira e come notifica sul tablet del master e sullo schermo TAVOLO.

### Movimento
- La vista resta sempre centrata sul token, con lo zoom regolato sulla velocità del PG (30 ft = 6 caselle per lato).
- Il contatore diventa rosso oltre la velocità.
- Il pulsante centrale **Azzera** riporta il contatore a zero.

Formato dei file e campi: **docs/FORMATO-SCHEDE.md**. Esempi: `examples/`. Conversione da CSV: `tools/bestiario-da-csv.py`.

---

## Incontro e iniziativa (v0.4)

- **Master → ⚔️ Incontro**:
  - **Mostri in scena**: ogni mostro ha il suo pulsante visibile/nascosto; ci sono anche **Rivela tutti** e **Nascondi tutti**. I mostri nascosti non si vedono sui telefoni né sul TV.
  - **Avvia combattimento**: PG e mostri entrano in un unico elenco ordinato per iniziativa.
    - I giocatori trovano nella home il pulsante **🎲 Tira l'iniziativa** con il loro bonus.
    - **Tira per i mostri** usa d20 + Destrezza, con tiro segreto.
    - Ogni valore si può correggere o scrivere a mano.
  - **Aggiorna partecipanti** aggiunge i token nuovi e toglie quelli rimossi; **Termina combattimento** chiude l'elenco.
  - L'avanzamento dei turni resta al tavolo.
  - **Tocca un partecipante** (nei mostri o nell'elenco iniziativa): sotto la riga si apre la sua scheda con PF ±, Muovi, Nascondi/Rivela e tiri. Sulla mappa del master compare un cerchio dorato tratteggiato attorno all'esemplare; solo il master lo vede. **📍 Mostrami dov'è** centra la mappa su quell'esemplare.
  - **🔢 Numera doppioni**: rinomina i mostri dello stesso tipo in "Goblin 1, 2, 3…", dall'alto in basso e da sinistra a destra. Le schede restano collegate. I numeri compaiono anche nell'etichetta del token visibile ai giocatori.
- **Master → Partita, token selezionato**:
  - **🧭 Muovi** apre la pulsantiera anche per i mostri;
  - **Nascondi/Rivela**;
  - **−1 / +1** PF e Danno/Cura;
  - blocco statistiche con tiri cliccabili.
- **Giocatore → Combattimento → Stato**: pulsanti **−** e **+** accanto ai PF. Il − scala prima i PF temporanei.

---

## Installazione in Owlbear Rodeo

1. Pubblica il sito (vedi *Pubblicazione*), poi in Owlbear Rodeo: **Profilo → Extensions → Add Custom Extension**
2. Incolla `https://mjf76.github.io/obr-tavolo/manifest.json`
3. Nella stanza: menu stanza → **Extensions** → attiva *OBR Tavolo*

## Sviluppo

Serve Node.js 22 o superiore.

```bash
npm install
npm run dev        # estensione su http://localhost:5173 → in OBR aggiungi http://localhost:5173/manifest.json
npm test           # test della logica di movimento (5-10-5, conversione ft/m)
npm run build      # controllo dei tipi + build in dist/
```

**Prova senza Owlbear** (interfaccia con dati finti):

```bash
npx vite -c tests/mock/vite.mock.config.ts
# http://localhost:5174/index.html?role=GM   pannello master
# http://localhost:5174/index.html            giocatore "Anna"
# http://localhost:5174/controller.html       controller
```

## Pubblicazione (GitHub Pages, automatica)

Ogni push sul ramo `main` di `mjf76/obr-tavolo` avvia `.github/workflows/deploy.yml`: test, build e pubblicazione su `https://mjf76.github.io/obr-tavolo/`.
Una sola volta: su GitHub → Settings → Pages → Source: **GitHub Actions**.

---

## Prova al tavolo — Step 0 e 1

Servono 3 dispositivi: il **tablet o PC del master**, un **telefono** e il **dispositivo collegato al TV**.

| # | Prova | Risultato atteso |
|---|---|---|
| 1 | Il master apre l'estensione | Badge "Master", sezione Scena con la griglia |
| 2 | Griglia non impostata su 5-10-5 → **Imposta 5-10-5** | La riga diventa "5-10-5 (diagonali alternate)" |
| 3 | Il telefono entra con il nome del PG del giocatore (es. "Anna") | Compare tra i connessi nel pannello del master |
| 4 | Il master assegna un token dal menu a tendina **e** da tasto destro sul token | Il giocatore vede il suo personaggio |
| 5 | Il giocatore preme **Apri controller** e si muove (3 diagonali + 1 dritto) | Token sul TV spostato; contatore **25 ft · 7,5 m** |
| 6 | Il giocatore chiude il browser e rientra con lo stesso nome | Personaggio ricollegato da solo (notifica al master) |
| 7 | Il TV entra con il nome `TAVOLO` | Badge "Schermo tavolo"; nel pannello master compare come "schermo" |
| 8 | **Prova permessi**: menu stanza → Permissions → Character → attiva *Owner only* | Il master vede "Rendi proprietario" sui PG assegnati |
| 9 | Il master preme **Rendi proprietario**, il giocatore riprova a muovere | Da annotare: OBR accetta o rifiuta il cambio di proprietario? |
| 10 | Il dispositivo Android TV (Chromecast/Fire Stick) apre la stanza | Da annotare: fluidità della mappa e del movimento |

Gli esiti delle prove 9 e 10 decidono come proseguire: la 9 stabilisce se il controllo "solo il proprio PG" è garantito da Owlbear o solo dall'app; la 10 se lo stick TV basta o se serve un PC collegato al TV.

---

## Struttura

```
index.html / controller.html / assign.html / background.html   pagine dell'estensione
src/entries/      punti d'ingresso (background.ts = menu del token + ricollegamento automatico)
src/views/        App, GmHome, PlayerHome, TableHome, Controller, AssignEmbed
src/shared/       keys (prefissi), movement (logica pura 5-10-5), assignment, device, hooks OBR
tests/            test della logica + OBR finto per provare l'interfaccia
vite.config.ts    build a più pagine + generazione di manifest.json con URL assoluti
```

Tutti i dati dell'estensione stanno sotto il prefisso `it.mjf.obr-tavolo/` per non scontrarsi con altre estensioni.

## Prossimi step

2. Controller v2: velocità dalla scheda, tocco sulla casella, scatto/disimpegno, quota
3. Modalità TV
4. Iniziativa e turni (PF/CA compatibili con Stat Bubbles)
5. Scheda PG 5.5 · 6. Azioni in combattimento (tiri con Dice+) · 7. Fuori combattimento · 8. Pannello master · 9. Rifinitura

Piano completo in `../PIANO.md` (cartella superiore).
