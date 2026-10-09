/**
 * Formato JSON delle schede (versione 1).
 * Un file può contenere: una scheda, un array di schede, oppure un bestiario
 * { "tipo": "bestiario", "mostri": [...] }.
 * Riferimento completo: docs/FORMATO-SCHEDE.md
 */

export type Ability = "for" | "des" | "cos" | "int" | "sag" | "car";
export const ABILITIES: Ability[] = ["for", "des", "cos", "int", "sag", "car"];
export const ABILITY_LABEL: Record<Ability, string> = {
  for: "Forza",
  des: "Destrezza",
  cos: "Costituzione",
  int: "Intelligenza",
  sag: "Saggezza",
  car: "Carisma",
};
export const ABILITY_SHORT: Record<Ability, string> = {
  for: "FOR",
  des: "DES",
  cos: "COS",
  int: "INT",
  sag: "SAG",
  car: "CAR",
};

export type SkillId =
  | "acrobazia" | "addestrare_animali" | "arcano" | "atletica" | "furtivita" | "indagare"
  | "inganno" | "intimidire" | "intrattenere" | "intuizione" | "medicina" | "natura"
  | "percezione" | "persuasione" | "rapidita_di_mano" | "religione" | "sopravvivenza" | "storia";

export const SKILLS: { id: SkillId; label: string; car: Ability }[] = [
  { id: "acrobazia", label: "Acrobazia", car: "des" },
  { id: "addestrare_animali", label: "Addestrare Animali", car: "sag" },
  { id: "arcano", label: "Arcano", car: "int" },
  { id: "atletica", label: "Atletica", car: "for" },
  { id: "furtivita", label: "Furtività", car: "des" },
  { id: "indagare", label: "Indagare", car: "int" },
  { id: "inganno", label: "Inganno", car: "car" },
  { id: "intimidire", label: "Intimidire", car: "car" },
  { id: "intrattenere", label: "Intrattenere", car: "car" },
  { id: "intuizione", label: "Intuizione", car: "sag" },
  { id: "medicina", label: "Medicina", car: "sag" },
  { id: "natura", label: "Natura", car: "int" },
  { id: "percezione", label: "Percezione", car: "sag" },
  { id: "persuasione", label: "Persuasione", car: "car" },
  { id: "rapidita_di_mano", label: "Rapidità di Mano", car: "des" },
  { id: "religione", label: "Religione", car: "int" },
  { id: "sopravvivenza", label: "Sopravvivenza", car: "sag" },
  { id: "storia", label: "Storia", car: "int" },
];

export interface Damage {
  /** es. "1d8", "2d6", "1d4+1" */
  dadi: string;
  /** es. "Tagliente" */
  tipo: string;
  /** somma il modificatore di caratteristica (default: true sul primo danno, false sugli altri) */
  aggiungiMod?: boolean;
}

export interface Attack {
  nome: string;
  tipo: "mischia" | "distanza" | "incantesimo";
  car: Ability;
  /** competenza nell'arma (default true) */
  competente?: boolean;
  /** bonus magici o altri bonus al tiro per colpire */
  bonusColpire?: number;
  danni: Damage[];
  gittata?: string;
  padronanza?: string;
  proprieta?: string;
  note?: string;
}

export interface Spell {
  nome: string;
  /** 0 = trucchetto */
  livello: number;
  preparato?: boolean;
  rituale?: boolean;
  concentrazione?: boolean;
  tempo?: string; // "Azione", "Azione bonus", "Reazione", "1 minuto"
  gittata?: string;
  durata?: string;
  componenti?: string;
  /** l'incantesimo richiede un tiro per colpire con incantesimo */
  attacco?: boolean;
  /** tiro salvezza richiesto al bersaglio */
  ts?: Ability;
  danni?: string; // es. "1d10" o "3d6"
  tipoDanni?: string;
  sintesi?: string;
  /** id di una risorsa: il lancio consuma un suo uso invece di uno slot (es. Nemico prescelto) */
  risorsa?: string;
}

export interface Resource {
  id: string;
  nome: string;
  max: number;
  ricarica: "breve" | "lungo";
  /** con ricarica "lungo": quanti usi tornano con un riposo breve (es. Recuperare Energie: 1) */
  perBreve?: number;
}

export interface PgSheet {
  tipo: "pg";
  versione: 1;
  id: string;
  nome: string;
  /** nome del token in Owlbear, se diverso da `nome` (serve per l'abbinamento automatico) */
  token?: string;
  giocatore?: string;
  ritratto?: string;
  specie: string;
  background: string;
  allineamento?: string;
  classi: { classe: string; sottoclasse?: string; livello: number; dadoVita: 6 | 8 | 10 | 12 }[];
  caratteristiche: Record<Ability, number>;
  tiriSalvezza: Ability[];
  /** 1 = competenza, 2 = maestria */
  abilita: Partial<Record<SkillId, 1 | 2>>;
  pf: number;
  ca: number;
  velocita: { camminare: number; volare?: number; nuotare?: number; scalare?: number; scavare?: number };
  /** valore minimo del d20 per il critico con le armi (es. 19 per Critico Migliorato); default 20 */
  critico?: number;
  /** bonus extra all'iniziativa oltre alla Destrezza (es. talento Allerta) */
  iniziativa?: number;
  sensi?: string[];
  linguaggi?: string[];
  competenze?: { armature?: string[]; armi?: string[]; strumenti?: string[] };
  attacchi: Attack[];
  incantesimi?: {
    car: Ability;
    /** slot per livello: indice 0 = 1° livello */
    slot: number[];
    patto?: { livello: number; slot: number };
    lista: Spell[];
  };
  risorse?: Resource[];
  privilegi?: { nome: string; fonte?: string; sintesi: string }[];
  inventario?: { nome: string; qta?: number; equip?: boolean; sintonia?: boolean; note?: string }[];
  monete?: { mr?: number; ma?: number; me?: number; mo?: number; mp?: number };
  note?: string;
}

export interface MonsterEntry {
  nome: string;
  testo: string;
}

export interface Monster {
  tipo: "mostro";
  versione: 1;
  id: string;
  nome: string;
  /** nome inglese, usato anche per l'abbinamento automatico ai token */
  nomeOriginale?: string;
  fonte?: string;
  taglia?: string;
  tipoCreatura?: string;
  allineamento?: string;
  ca: number;
  caNote?: string;
  pf: number;
  pfFormula?: string;
  velocita?: string;
  caratteristiche: Record<Ability, number>;
  ts?: string;
  abilita?: string;
  vulnerabilita?: string;
  resistenze?: string;
  immunita?: string;
  immunitaCondizioni?: string;
  sensi?: string;
  linguaggi?: string;
  gs?: string;
  sezioni: { titolo: string; voci: MonsterEntry[] }[];
}

export type Sheet = PgSheet | Monster;

export interface Bestiary {
  tipo: "bestiario";
  versione: 1;
  nome?: string;
  mostri: Monster[];
}
