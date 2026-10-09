/**
 * Muri della nebbia dinamica: l'estensione Dynamic Fog li crea come oggetti locali (WALL)
 * su ogni dispositivo, con le porte aperte già "ritagliate". Se un token li attraversa,
 * Owlbear lo respinge di mezza casella: per questo il controller li controlla prima di muovere.
 */
import OBR, { isWall, type Wall } from "@owlbear-rodeo/sdk";
import { snapToGrid, type P } from "./movement";

function toWorld(w: Wall): P[] {
  const r = (w.rotation * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return w.points.map((p) => {
    const x = p.x * w.scale.x;
    const y = p.y * w.scale.y;
    return { x: w.position.x + x * cos - y * sin, y: w.position.y + x * sin + y * cos };
  });
}

export async function getWalls(): Promise<P[][]> {
  try {
    const walls = await OBR.scene.local.getItems(isWall);
    return walls.filter((w) => w.blocking !== false).map(toWorld);
  } catch {
    return [];
  }
}

/** Riporta i token al centro delle loro caselle (dopo un urto contro un muro o un trascinamento storto). */
export async function realign(items: { id: string; position: P }[]): Promise<number> {
  if (!items.length) return 0;
  const dpi = await OBR.scene.grid.getDpi();
  const targets = new Map<string, P>();
  for (const it of items) {
    const b = await OBR.scene.items.getItemBounds([it.id]).catch(() => null);
    const size = b ? Math.max(1, Math.round(Math.min(b.width, b.height) / dpi)) : 1;
    const t = snapToGrid(it.position, dpi, size);
    if (Math.abs(t.x - it.position.x) > 0.5 || Math.abs(t.y - it.position.y) > 0.5) targets.set(it.id, t);
  }
  if (!targets.size) return 0;
  await OBR.scene.items.updateItems([...targets.keys()], (list) => {
    for (const i of list) i.position = targets.get(i.id) ?? i.position;
  });
  return targets.size;
}
