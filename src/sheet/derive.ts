/** Valori derivati della scheda 5.5 (logica pura, testabile). */
import { ABILITIES, SKILLS, type Ability, type Attack, type PgSheet, type SkillId } from "./types.ts";

export const mod = (score: number) => Math.floor((score - 10) / 2);

export const totalLevel = (s: PgSheet) => s.classi.reduce((a, c) => a + c.livello, 0);

/** Bonus di competenza: +2 ai livelli 1-4, +3 ai 5-8, … */
export const profBonus = (level: number) => 2 + Math.floor((Math.max(1, level) - 1) / 4);

export function abilityMods(s: PgSheet): Record<Ability, number> {
  return Object.fromEntries(ABILITIES.map((a) => [a, mod(s.caratteristiche[a] ?? 10)])) as Record<Ability, number>;
}

export function saveBonus(s: PgSheet, a: Ability): number {
  const pb = profBonus(totalLevel(s));
  return mod(s.caratteristiche[a]) + (s.tiriSalvezza.includes(a) ? pb : 0);
}

export function skillBonus(s: PgSheet, id: SkillId): number {
  const pb = profBonus(totalLevel(s));
  const sk = SKILLS.find((x) => x.id === id)!;
  return mod(s.caratteristiche[sk.car]) + pb * (s.abilita[id] ?? 0);
}

export const initiative = (s: PgSheet) => mod(s.caratteristiche.des) + (s.iniziativa ?? 0);
export const passivePerception = (s: PgSheet) => 10 + skillBonus(s, "percezione");

export function spellDC(s: PgSheet): number | null {
  if (!s.incantesimi) return null;
  return 8 + profBonus(totalLevel(s)) + mod(s.caratteristiche[s.incantesimi.car]);
}
export function spellAttack(s: PgSheet): number | null {
  if (!s.incantesimi) return null;
  return profBonus(totalLevel(s)) + mod(s.caratteristiche[s.incantesimi.car]);
}

export function attackBonus(s: PgSheet, a: Attack): number {
  const pb = profBonus(totalLevel(s));
  return mod(s.caratteristiche[a.car]) + (a.competente === false ? 0 : pb) + (a.bonusColpire ?? 0);
}

/** Espressioni di danno dell'attacco, col modificatore già sommato dove previsto. */
export function attackDamage(s: PgSheet, a: Attack): { expr: string; tipo: string }[] {
  const m = mod(s.caratteristiche[a.car]);
  return a.danni.map((d, i) => {
    const add = d.aggiungiMod ?? i === 0;
    const expr = add && m !== 0 ? `${d.dadi}${m > 0 ? "+" : "-"}${Math.abs(m)}` : d.dadi;
    return { expr, tipo: d.tipo };
  });
}

/** Dadi Vita totali per taglia: { 10: 3, 8: 1 } */
export function hitDice(s: PgSheet): Record<number, number> {
  const out: Record<number, number> = {};
  for (const c of s.classi) out[c.dadoVita] = (out[c.dadoVita] ?? 0) + c.livello;
  return out;
}

/** Controllo minimo del JSON: restituisce l'elenco dei problemi (vuoto = ok). */
export function validatePg(x: unknown): string[] {
  const s = x as Partial<PgSheet>;
  const err: string[] = [];
  if (!s || typeof s !== "object") return ["non è un oggetto JSON"];
  if (s.tipo !== "pg") err.push('"tipo" deve essere "pg"');
  if (!s.nome) err.push('manca "nome"');
  if (!Array.isArray(s.classi) || s.classi.length === 0) err.push('manca "classi"');
  if (!s.caratteristiche || ABILITIES.some((a) => typeof s.caratteristiche?.[a] !== "number"))
    err.push('"caratteristiche" deve avere for, des, cos, int, sag, car');
  if (typeof s.pf !== "number") err.push('manca "pf" (PF massimi)');
  if (typeof s.ca !== "number") err.push('manca "ca"');
  if (!Array.isArray(s.attacchi)) err.push('manca "attacchi" (anche vuoto: [])');
  return err;
}
