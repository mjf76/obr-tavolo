/** Geometria pura delle porte (senza SDK, testabile con node). */
export interface P {
  x: number;
  y: number;
}

/** Comandi di un Path Owlbear → contorni (polilinee). Le curve sono approssimate col punto finale. */
export function contoursFromCommands(commands: number[][]): P[][] {
  const out: P[][] = [];
  let cur: P[] = [];
  for (const c of commands) {
    switch (c[0]) {
      case 0: // MOVE
        if (cur.length) out.push(cur);
        cur = [{ x: c[1], y: c[2] }];
        break;
      case 1: // LINE
        cur.push({ x: c[1], y: c[2] });
        break;
      case 2: // QUAD
      case 3: // CONIC
        cur.push({ x: c[3], y: c[4] });
        break;
      case 4: // CUBIC
        cur.push({ x: c[5], y: c[6] });
        break;
      case 5: // CLOSE
        if (cur.length) cur.push({ ...cur[0] });
        break;
    }
  }
  if (cur.length) out.push(cur);
  return out;
}

/** Punto a distanza `d` lungo la polilinea. */
export function pointAlong(line: P[], d: number): P {
  if (!line.length) return { x: 0, y: 0 };
  let left = Math.max(0, d);
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (left <= len) {
      const t = len ? left / len : 0;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    left -= len;
  }
  return line[line.length - 1];
}

/** Da coordinate locali dell'oggetto a coordinate di mappa. */
export function toWorld(p: P, pos: P, rotationDeg: number, scale: P): P {
  const r = (rotationDeg * Math.PI) / 180;
  const x = p.x * scale.x;
  const y = p.y * scale.y;
  return { x: pos.x + x * Math.cos(r) - y * Math.sin(r), y: pos.y + x * Math.sin(r) + y * Math.cos(r) };
}

const DIRS = ["est", "sud-est", "sud", "sud-ovest", "ovest", "nord-ovest", "nord", "nord-est"];

/** "3 caselle a nord-est" (la y della mappa cresce verso il basso). */
export function describeFrom(from: P, to: P, dpi: number): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const cells = Math.max(Math.abs(dx), Math.abs(dy)) / dpi;
  if (cells < 0.75) return "qui accanto";
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  const dir = DIRS[((Math.round(ang / 45) % 8) + 8) % 8];
  const n = Math.round(cells);
  return `${n} ${n === 1 ? "casella" : "caselle"} a ${dir}`;
}
