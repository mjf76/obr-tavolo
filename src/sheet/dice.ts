/** Lancio dei dadi: espressioni tipo "1d20+5", "2d6 + 3", "1d8+1d6+2". Logica pura, testabile. */

export interface DieResult {
  sides: number;
  value: number;
  kept: boolean;
}

export interface RollResult {
  expr: string;
  total: number;
  dice: DieResult[];
  modifier: number;
  /** per i d20 singoli: 20 naturale / 1 naturale */
  natural?: number;
  crit?: boolean;
  fumble?: boolean;
  /** testo leggibile es. "[14] + 5 = 19" */
  detail: string;
}

export type Mode = "normale" | "vantaggio" | "svantaggio";

type Rng = () => number;
const defaultRng: Rng = () => {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] / 2 ** 32;
  }
  return Math.random();
};

const roll1 = (sides: number, rng: Rng) => 1 + Math.floor(rng() * sides);

interface Term {
  sign: 1 | -1;
  count?: number;
  sides?: number;
  value?: number;
}

export function parse(expr: string): Term[] | null {
  const clean = expr.replace(/\s+/g, "").toLowerCase();
  if (!clean || !/^[+-]?(\d*d\d+|\d+)([+-](\d*d\d+|\d+))*$/.test(clean)) return null;
  const terms: Term[] = [];
  for (const m of clean.matchAll(/([+-]?)(\d*d\d+|\d+)/g)) {
    const sign = m[1] === "-" ? -1 : 1;
    const t = m[2];
    if (t.includes("d")) {
      const [c, s] = t.split("d");
      const count = c === "" ? 1 : parseInt(c, 10);
      const sides = parseInt(s, 10);
      if (count < 1 || count > 100 || sides < 2 || sides > 1000) return null;
      terms.push({ sign, count, sides });
    } else terms.push({ sign, value: parseInt(t, 10) });
  }
  return terms;
}

/** Raddoppia i dadi (colpo critico): "1d8+3" → "2d8+3". */
export function doubleDice(expr: string): string {
  return expr.replace(/(\d*)d(\d+)/gi, (_, c: string, s: string) => `${(c === "" ? 1 : parseInt(c, 10)) * 2}d${s}`);
}

const signed = (n: number) => (n >= 0 ? `+ ${n}` : `− ${Math.abs(n)}`);

export function roll(expr: string, mode: Mode = "normale", rng: Rng = defaultRng): RollResult | null {
  const terms = parse(expr);
  if (!terms) return null;
  const dice: DieResult[] = [];
  let total = 0;
  let modifier = 0;
  const parts: string[] = [];
  const singleD20 = terms.filter((t) => t.sides).length === 1 && terms.some((t) => t.sides === 20 && t.count === 1);
  let natural: number | undefined;

  for (const t of terms) {
    if (t.value !== undefined) {
      modifier += t.sign * t.value;
      continue;
    }
    const sides = t.sides!;
    if (sides === 20 && t.count === 1 && mode !== "normale") {
      const a = roll1(20, rng);
      const b = roll1(20, rng);
      const keep = mode === "vantaggio" ? Math.max(a, b) : Math.min(a, b);
      const keptIdx = (mode === "vantaggio" ? a >= b : a <= b) ? 0 : 1;
      dice.push({ sides, value: a, kept: keptIdx === 0 }, { sides, value: b, kept: keptIdx === 1 });
      total += t.sign * keep;
      natural = keep;
      parts.push(`[${keep}] (scartato ${keptIdx === 0 ? b : a})`);
    } else {
      const vals: number[] = [];
      for (let i = 0; i < t.count!; i++) {
        const v = roll1(sides, rng);
        vals.push(v);
        dice.push({ sides, value: v, kept: true });
        total += t.sign * v;
      }
      if (singleD20 && sides === 20) natural = vals[0];
      parts.push(`${t.sign < 0 ? "− " : parts.length ? "+ " : ""}[${vals.join(", ")}]`);
    }
  }
  total += modifier;
  const detail = `${parts.join(" ")}${modifier ? ` ${signed(modifier)}` : ""} = ${total}`;
  return {
    expr,
    total,
    dice,
    modifier,
    natural,
    crit: natural === 20,
    fumble: natural === 1,
    detail,
  };
}

/** "+5" / "−1" */
export const fmtMod = (n: number) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);
/** Espressione d20 con modificatore: "1d20+5" */
export const d20 = (mod: number) => (mod >= 0 ? `1d20+${mod}` : `1d20-${Math.abs(mod)}`);
