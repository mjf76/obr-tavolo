/**
 * Valori "vitali" del personaggio salvati sul token, visibili a tutti sul TV.
 * PF, PF max, PF temporanei e CA usano le stesse chiavi di "Stat Bubbles for D&D":
 * se quell'estensione è attiva, le barre sul token si aggiornano da sole.
 */
import OBR, { type Item } from "@owlbear-rodeo/sdk";
import { NS } from "./keys";
import type { Vitals } from "./hp";

export * from "./hp";

export const BUBBLES_KEY = "com.owlbear-rodeo-bubbles-extension/metadata";
export const STATE_KEY = `${NS}/state`;



export interface CharState {
  conditions: string[]; // id delle condizioni (vedi CONDITIONS)
  exhaustion: number; // 0-6
  concentration: string | null; // nome dell'incantesimo, se in concentrazione
  deathSaves: { ok: number; ko: number };
}

export const EMPTY_STATE: CharState = { conditions: [], exhaustion: 0, concentration: null, deathSaves: { ok: 0, ko: 0 } };

/** Condizioni D&D 5.5 (2024), nomi della SRD 5.2.1 italiana. */
export const CONDITIONS: { id: string; label: string; icon: string }[] = [
  { id: "blinded", label: "Accecato", icon: "🙈" },
  { id: "charmed", label: "Affascinato", icon: "💗" },
  { id: "deafened", label: "Assordato", icon: "🔇" },
  { id: "frightened", label: "Spaventato", icon: "😱" },
  { id: "grappled", label: "Afferrato", icon: "✊" },
  { id: "incapacitated", label: "Incapacitato", icon: "💫" },
  { id: "invisible", label: "Invisibile", icon: "👻" },
  { id: "paralyzed", label: "Paralizzato", icon: "⚡" },
  { id: "petrified", label: "Pietrificato", icon: "🗿" },
  { id: "poisoned", label: "Avvelenato", icon: "🤢" },
  { id: "prone", label: "Prono", icon: "🛌" },
  { id: "restrained", label: "Trattenuto", icon: "⛓️" },
  { id: "stunned", label: "Stordito", icon: "😵" },
  { id: "unconscious", label: "Privo di sensi", icon: "💤" },
];

const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);

export function readVitals(item: Item): Vitals {
  const b = (item.metadata[BUBBLES_KEY] ?? {}) as Record<string, unknown>;
  return { hp: num(b["health"]), maxHp: num(b["max health"]), tempHp: num(b["temporary health"]), ac: num(b["armor class"]) };
}

export function readState(item: Item): CharState {
  const s = (item.metadata[STATE_KEY] ?? {}) as Partial<CharState>;
  return {
    conditions: Array.isArray(s.conditions) ? s.conditions.filter((c) => typeof c === "string") : [],
    exhaustion: Math.min(6, Math.max(0, num(s.exhaustion))),
    concentration: typeof s.concentration === "string" ? s.concentration : null,
    deathSaves: { ok: num(s.deathSaves?.ok), ko: num(s.deathSaves?.ko) },
  };
}

/* ---------- scrittura sul token ---------- */

export async function writeVitals(itemId: string, v: Vitals) {
  await OBR.scene.items.updateItems([itemId], (items) => {
    for (const i of items) {
      const prev = (i.metadata[BUBBLES_KEY] ?? {}) as Record<string, unknown>;
      i.metadata[BUBBLES_KEY] = {
        ...prev,
        health: v.hp,
        "max health": v.maxHp,
        "temporary health": v.tempHp,
        "armor class": v.ac,
      };
    }
  });
}

export async function writeState(itemId: string, s: CharState) {
  await OBR.scene.items.updateItems([itemId], (items) => {
    for (const i of items) i.metadata[STATE_KEY] = s;
  });
}
