/** Regole pure su PF e CA (nessuna dipendenza: testabili con `npm test`). */

export interface Vitals {
  hp: number;
  maxHp: number;
  tempHp: number;
  ac: number;
}


/** Danno: prima si consumano i PF temporanei, poi i PF (minimo 0). */
export function applyDamage(v: Vitals, amount: number): Vitals {
  const dmg = Math.max(0, Math.floor(amount));
  const fromTemp = Math.min(v.tempHp, dmg);
  return { ...v, tempHp: v.tempHp - fromTemp, hp: Math.max(0, v.hp - (dmg - fromTemp)) };
}

/** Cura: i PF non superano il massimo; i PF temporanei non si curano. */
export function applyHeal(v: Vitals, amount: number): Vitals {
  return { ...v, hp: Math.min(v.maxHp || Infinity, v.hp + Math.max(0, Math.floor(amount))) };
}

/** PF temporanei: non si sommano, si tiene il valore più alto. */
export function applyTempHp(v: Vitals, amount: number): Vitals {
  return { ...v, tempHp: Math.max(v.tempHp, Math.max(0, Math.floor(amount))) };
}
