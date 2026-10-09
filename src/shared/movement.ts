/**
 * Logica pura del movimento a caselle (nessuna dipendenza da OBR: testabile).
 *
 * Regola di default del progetto: ALTERNATING = 5-10-5
 * (ogni seconda diagonale costa il doppio), coincidente con l'opzione
 * "Alternating" della griglia di Owlbear Rodeo.
 */

export type Measurement = "CHEBYSHEV" | "ALTERNATING" | "EUCLIDEAN" | "MANHATTAN";
export type Dir = -1 | 0 | 1;
export interface Step {
  dx: Dir;
  dy: Dir;
}

export const isDiagonal = (s: Step) => s.dx !== 0 && s.dy !== 0;

/** Costo in caselle di un singolo passo, dato quante diagonali sono già state fatte nel percorso. */
export function stepCost(step: Step, diagonalsSoFar: number, m: Measurement): number {
  if (!isDiagonal(step)) return 1;
  switch (m) {
    case "ALTERNATING":
      return diagonalsSoFar % 2 === 0 ? 1 : 2;
    case "CHEBYSHEV":
      return 1;
    case "MANHATTAN":
      return 2;
    case "EUCLIDEAN":
      return Math.SQRT2;
  }
}

/** Costo totale (in caselle) di un percorso fatto di passi. Il movimento speso si accumula anche tornando indietro. */
export function pathCost(steps: Step[], m: Measurement): number {
  let diagonals = 0;
  let total = 0;
  for (const s of steps) {
    total += stepCost(s, diagonals, m);
    if (isDiagonal(s)) diagonals++;
  }
  return total;
}

/** Costo della prossima diagonale (per il suggerimento "prossima diagonale: 10 ft"). */
export function nextDiagonalCost(steps: Step[], m: Measurement): number {
  const diagonals = steps.filter(isDiagonal).length;
  return stepCost({ dx: 1, dy: 1 }, diagonals, m);
}

export interface Scale {
  multiplier: number; // es. 5
  unit: string; // es. "ft"
  digits: number;
}

const FT_TO_M = 0.3; // convenzione D&D: 5 ft = 1,5 m

/** "15 ft · 4,5 m" — mostra sempre piedi e metri quando l'unità è ft o m. */
export function formatDistance(cells: number, scale: Scale): string {
  const value = cells * scale.multiplier;
  const unit = scale.unit.trim().toLowerCase();
  const fmt = (n: number) =>
    n.toLocaleString("it-IT", { maximumFractionDigits: 1, minimumFractionDigits: 0 });
  if (unit === "ft") return `${fmt(value)} ft · ${fmt(value * FT_TO_M)} m`;
  if (unit === "m") return `${fmt(value / FT_TO_M)} ft · ${fmt(value)} m`;
  return `${fmt(value)} ${scale.unit}`.trim();
}

/** Interpreta la scala OBR ("5ft", "1.5m", "1") quando serve fuori da OBR. */
export function parseScale(raw: string): Scale {
  const m = raw.trim().match(/^([\d.,]+)\s*(.*)$/);
  if (!m) return { multiplier: 1, unit: "", digits: 0 };
  return { multiplier: parseFloat(m[1].replace(",", ".")), unit: m[2], digits: 0 };
}

export const MEASUREMENT_LABEL: Record<Measurement, string> = {
  ALTERNATING: "5-10-5 (diagonali alternate)",
  CHEBYSHEV: "Diagonale = 1 casella",
  EUCLIDEAN: "Euclidea (distanza reale)",
  MANHATTAN: "Manhattan (diagonale = 2 caselle)",
};

/** Punto/segmento in coordinate di mappa (pixel). */
export interface P {
  x: number;
  y: number;
}

const cross = (o: P, a: P, b: P) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
const onSeg = (p: P, a: P, b: P) =>
  Math.min(a.x, b.x) - 1e-6 <= p.x && p.x <= Math.max(a.x, b.x) + 1e-6 && Math.min(a.y, b.y) - 1e-6 <= p.y && p.y <= Math.max(a.y, b.y) + 1e-6;

/** I segmenti ab e cd si toccano o si incrociano (anche solo in un estremo: niente "angoli tagliati"). */
export function segmentsTouch(a: P, b: P, c: P, d: P): boolean {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  const eps = 1e-6;
  return (
    (Math.abs(d1) < eps && onSeg(a, c, d)) ||
    (Math.abs(d2) < eps && onSeg(b, c, d)) ||
    (Math.abs(d3) < eps && onSeg(c, a, b)) ||
    (Math.abs(d4) < eps && onSeg(d, a, b))
  );
}

/** Il passo da `from` a `to` attraversa una delle polilinee (muri)? */
export function crossesWall(from: P, to: P, walls: P[][]): boolean {
  for (const w of walls) for (let i = 1; i < w.length; i++) if (segmentsTouch(from, to, w[i - 1], w[i])) return true;
  return false;
}

/**
 * Centro corretto sulla griglia: token di 1, 3… caselle al centro della casella,
 * token di 2, 4… caselle sull'incrocio delle linee.
 */
export function snapToGrid(p: P, dpi: number, sizeCells: number): P {
  const off = sizeCells % 2 === 1 ? dpi / 2 : 0;
  const s = (v: number) => Math.round((v - off) / dpi) * dpi + off;
  return { x: s(p.x), y: s(p.y) };
}
