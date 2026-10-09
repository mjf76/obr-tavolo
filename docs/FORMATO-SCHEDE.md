# Formato delle schede (JSON, versione 1)

Un file `.json` può contenere **una scheda**, un **array di schede** oppure un **bestiario** `{ "tipo": "bestiario", "mostri": [ ... ] }`. Si importano dal pannello del master: **Preparazione → Importa JSON**. Puoi selezionare più file insieme.

Gli esempi completi sono in `examples/` (`pg-esempio-guerriero.json`, `pg-esempio-mago.json`).

## Personaggio (`"tipo": "pg"`)

| Campo | Obbl. | Note |
|---|---|---|
| `tipo`, `versione` | ✔ | `"pg"`, `1` |
| `id` | ✔ | identificativo unico (es. `"roh-musk"`); reimportare con lo stesso id aggiorna la scheda |
| `nome` | ✔ | nome del personaggio |
| `token` | | nome del token in Owlbear, se diverso da `nome` (serve a **Abbina per nome**) |
| `ritratto` | | URL di un'immagine; se manca si usa quella del token |
| `specie`, `background` | ✔ | testo |
| `classi` | ✔ | `[{ "classe": "Guerriero", "sottoclasse": "Campione", "livello": 3, "dadoVita": 10 }]`; con più classi c'è un elemento per classe |
| `caratteristiche` | ✔ | `{ "for": 16, "des": 14, "cos": 14, "int": 10, "sag": 12, "car": 8 }` (punteggi, non modificatori) |
| `tiriSalvezza` | ✔ | caratteristiche con competenza: `["for", "cos"]` |
| `abilita` | ✔ | `{ "atletica": 1, "furtivita": 2 }`, dove 1 = competenza e 2 = maestria. Chiavi: acrobazia, addestrare_animali, arcano, atletica, furtivita, indagare, inganno, intimidire, intrattenere, intuizione, medicina, natura, percezione, persuasione, rapidita_di_mano, religione, sopravvivenza, storia |
| `pf`, `ca` | ✔ | PF massimi e Classe Armatura |
| `velocita` | ✔ | in piedi: `{ "camminare": 30, "volare": 0 }`; decide anche lo zoom del popup Movimento |
| `critico` | | 19 con Critico Migliorato (default 20) |
| `iniziativa` | | bonus extra oltre alla Destrezza (es. talento Allerta) |
| `attacchi` | ✔ | vedi sotto (può essere `[]`) |
| `incantesimi` | | vedi sotto |
| `risorse` | | `[{ "id": "ira", "nome": "Ira", "max": 3, "ricarica": "lungo", "perBreve": 1 }]`. `perBreve` indica quanti usi tornano con un riposo breve |
| `privilegi` | | `[{ "nome": "...", "fonte": "Guerriero 2", "sintesi": "..." }]` |
| `inventario` | | `[{ "nome": "Corda", "qta": 1, "equip": false, "sintonia": false }]` |
| `monete` | | `{ "mr": 0, "ma": 0, "me": 0, "mo": 10, "mp": 0 }` |
| `sensi`, `linguaggi` | | array di testo; da `sensi` si legge la scurovisione per la nebbia dinamica ("Scurovisione 18 m" oppure "Darkvision 60 ft") |
| `competenze` | | `{ "armature": [], "armi": [], "strumenti": [] }` |
| `note` | | testo libero |

Bonus di competenza, modificatori, tiri salvezza, abilità, iniziativa, Percezione passiva, CD e attacco con incantesimi **si calcolano da soli**.

### Attacco

```json
{ "nome": "Spada Lunga", "tipo": "mischia", "car": "for",
  "danni": [{ "dadi": "1d8", "tipo": "Tagliente" }],
  "padronanza": "Fiaccare", "proprieta": "Versatile (1d10)", "bonusColpire": 1 }
```

- Bonus per colpire = modificatore di `car` + competenza (se `"competente": false`, niente competenza) + `bonusColpire`.
- Danni: il modificatore si somma al primo danno. Per gli altri danni si può forzare con `"aggiungiMod": true`.
- Con un 20 naturale (o con il valore di `critico`) i dadi dei danni raddoppiano.

### Incantesimi

```json
"incantesimi": {
  "car": "int",
  "slot": [4, 2],
  "patto": { "livello": 2, "slot": 2 },
  "lista": [
    { "nome": "Dardo di Fuoco", "livello": 0, "tempo": "Azione", "gittata": "36 m", "attacco": true, "danni": "1d10", "tipoDanni": "Fuoco" },
    { "nome": "Sonno", "livello": 1, "preparato": true, "concentrazione": true, "ts": "sag" },
    { "nome": "Individua Magie", "livello": 1, "rituale": true, "concentrazione": true }
  ]
}
```

- `slot`: numero di slot per livello (indice 0 = 1° livello). `patto` serve solo al warlock.
- **Lancia** spende lo slot più basso disponibile, tira attacco e danni oppure mostra la CD del tiro salvezza, e attiva la concentrazione se serve.
- **Rituale** non consuma slot.

## Mostro (`"tipo": "mostro"`)

I mostri si generano dal bestiario CSV con lo script:

```bash
python3 tools/bestiario-da-csv.py Bestiario_MM_5.5_ITA.csv bestiario.json
python3 tools/bestiario-da-csv.py Bestiario_MM_5.5_ITA.csv incontro.json --solo "Goblin guerriero,Goblin capo"
```

Campi principali: `id`, `nome`, `nomeOriginale` (inglese, usato anche per l'abbinamento), `ca`, `pf`, `pfFormula`, `velocita`, `caratteristiche`, `ts`, `abilita`, `resistenze`, `immunita`, `sensi`, `linguaggi`, `gs`, `sezioni` (`[{ "titolo": "Azioni", "voci": [{ "nome": "Scimitarra", "testo": "..." }] }]`).

Nel blocco statistiche del master i valori `Tiro per colpire: +4` e `(1d6 + 2)` diventano pulsanti per tirare.

⚠️ I testi del Manuale dei Mostri sono protetti: tieni i JSON dei mostri nella cartella privata `dati/`, **mai** nel repository pubblico.
