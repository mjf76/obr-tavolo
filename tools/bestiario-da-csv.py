#!/usr/bin/env python3
"""
Converte un bestiario CSV (formato 5etools, colonne inglesi o italiane)
nel bestiario JSON importabile in OBR Tavolo.

Uso:
  python3 tools/bestiario-da-csv.py Bestiario_MM_5.5_ITA.csv dati/bestiario.json [--solo "Goblin guerriero,Goblin capo"]

Il JSON prodotto contiene testi del manuale: tenerlo privato (cartella locale / Drive),
NON nel repository pubblico.
"""
import csv
import json
import re
import sys
import unicodedata

# colonne: chiave interna -> possibili intestazioni
COLS = {
    "nome": ["Nome", "Name"],
    "nome_en": ["Nome EN"],
    "fonte": ["Fonte", "Source"],
    "taglia": ["Taglia", "Size"],
    "tipo": ["Tipo", "Type"],
    "allineamento": ["Allineamento", "Alignment"],
    "ca": ["CA", "AC"],
    "pf": ["PF", "HP"],
    "velocita": ["Velocità", "Speed"],
    "for": ["Forza", "Strength"],
    "des": ["Destrezza", "Dexterity"],
    "cos": ["Costituzione", "Constitution"],
    "int": ["Intelligenza", "Intelligence"],
    "sag": ["Saggezza", "Wisdom"],
    "car": ["Carisma", "Charisma"],
    "ts": ["Tiri Salvezza", "Saving Throws"],
    "abilita": ["Abilità", "Skills"],
    "vulnerabilita": ["Vulnerabilità ai Danni", "Damage Vulnerabilities"],
    "resistenze": ["Resistenze ai Danni", "Damage Resistances"],
    "immunita": ["Immunità ai Danni", "Damage Immunities"],
    "immunitaCondizioni": ["Immunità alle Condizioni", "Condition Immunities"],
    "sensi": ["Sensi", "Senses"],
    "linguaggi": ["Lingue", "Languages"],
    "gs": ["GS", "CR"],
}
SEZIONI = [
    ("Tratti", ["Tratti", "Traits"]),
    ("Azioni", ["Azioni", "Actions"]),
    ("Azioni bonus", ["Azioni Bonus", "Bonus Actions"]),
    ("Reazioni", ["Reazioni", "Reactions"]),
    ("Azioni leggendarie", ["Azioni Leggendarie", "Legendary Actions"]),
    ("Azioni mitiche", ["Azioni Mitiche", "Mythic Actions"]),
    ("Azioni del covo", ["Azioni Covo", "Lair Actions"]),
    ("Effetti regionali", ["Effetti Regionali", "Regional Effects"]),
]


def col(row, key_list):
    for k in key_list:
        if k in row and row[k] is not None:
            return row[k].strip()
    return ""


def slug(s):
    s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def first_int(s, default=0):
    m = re.search(r"\d+", s or "")
    return int(m.group()) if m else default


def entries(text):
    """'Nome. testo' per riga; le righe senza nome restano come testo libero."""
    out = []
    for line in (text or "").split("\n"):
        line = line.strip()
        if not line:
            continue
        m = re.match(r"^([^.]{1,70}?)\.\s+(.*)$", line)
        if m and m.group(1)[:1].isupper():
            out.append({"nome": m.group(1).strip(), "testo": m.group(2).strip()})
        else:
            out.append({"nome": "", "testo": line})
    return out


def convert(row):
    nome = re.sub(r"\s*\[[^\]]*\]\s*$", "", col(row, COLS["nome"]))
    nome_en = col(row, COLS["nome_en"]) or None
    ca_raw = col(row, COLS["ca"])
    pf_raw = col(row, COLS["pf"])
    m = re.search(r"\(([^)]*)\)", pf_raw)
    ca_note = re.sub(r"^\d+\s*", "", ca_raw).strip(" ()") or None
    mostro = {
        "tipo": "mostro",
        "versione": 1,
        "id": slug(nome_en or nome),
        "nome": nome,
        "nomeOriginale": nome_en if nome_en and nome_en != nome else None,
        "fonte": col(row, COLS["fonte"]) or None,
        "taglia": col(row, COLS["taglia"]) or None,
        "tipoCreatura": col(row, COLS["tipo"]) or None,
        "allineamento": col(row, COLS["allineamento"]) or None,
        "ca": first_int(ca_raw, 10),
        "caNote": ca_note,
        "pf": first_int(pf_raw, 1),
        "pfFormula": m.group(1) if m else None,
        "velocita": col(row, COLS["velocita"]) or None,
        "caratteristiche": {k: first_int(col(row, COLS[k]), 10) for k in ["for", "des", "cos", "int", "sag", "car"]},
        "ts": col(row, COLS["ts"]) or None,
        "abilita": col(row, COLS["abilita"]) or None,
        "vulnerabilita": col(row, COLS["vulnerabilita"]) or None,
        "resistenze": col(row, COLS["resistenze"]) or None,
        "immunita": col(row, COLS["immunita"]) or None,
        "immunitaCondizioni": col(row, COLS["immunitaCondizioni"]) or None,
        "sensi": col(row, COLS["sensi"]) or None,
        "linguaggi": col(row, COLS["linguaggi"]) or None,
        "gs": col(row, COLS["gs"]) or None,
        "sezioni": [],
    }
    for titolo, keys in SEZIONI:
        voci = entries(col(row, keys))
        if voci:
            mostro["sezioni"].append({"titolo": titolo, "voci": voci})
    return {k: v for k, v in mostro.items() if v is not None}


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    src, dst = sys.argv[1], sys.argv[2]
    only = None
    if "--solo" in sys.argv:
        only = {s.strip().lower() for s in sys.argv[sys.argv.index("--solo") + 1].split(",")}
    with open(src, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    mostri = []
    seen = set()
    for r in rows:
        m = convert(r)
        if only and m["nome"].lower() not in only and m.get("nomeOriginale", "").lower() not in only:
            continue
        if m["id"] in seen:
            m["id"] = f'{m["id"]}-{len(seen)}'
        seen.add(m["id"])
        mostri.append(m)
    out = {"tipo": "bestiario", "versione": 1, "nome": src.rsplit("/", 1)[-1], "mostri": mostri}
    with open(dst, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{len(mostri)} mostri scritti in {dst}")


if __name__ == "__main__":
    main()
