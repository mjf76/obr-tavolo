/**
 * Porte della nebbia dinamica (estensione Dynamic Fog / Scene Importer).
 * Ogni disegno nel livello FOG può avere in metadata un elenco di porte
 * `{ open, start, end }`, dove start/end sono distanze lungo un contorno del disegno.
 * Aprire o chiudere = cambiare `open`: Dynamic Fog aggiorna muri e nebbia su tutti i dispositivi.
 */
import OBR, { buildLabel, isCurve, isLine, isPath, isShape, type Item } from "@owlbear-rodeo/sdk";
import { NS } from "./keys";
import { contoursFromCommands, pointAlong, toWorld, type P } from "./doorGeom";

export const DOORS_KEY = "rodeo.owlbear.dynamic-fog/doors";

interface DoorMeta {
  open: boolean;
  start: { distance: number; index: number };
  end: { distance: number; index: number };
}

export interface DoorInfo {
  key: string;
  /** numero stabile: dall'alto in basso, da sinistra a destra */
  n: number;
  itemId: string;
  index: number;
  open: boolean;
  center: P;
}

export const hasDoors = (i: Item) => i.layer === "FOG" && Array.isArray(i.metadata[DOORS_KEY]) && (i.metadata[DOORS_KEY] as unknown[]).length > 0;

function localContours(i: Item): P[][] {
  if (isPath(i)) return contoursFromCommands(i.commands as unknown as number[][]);
  if (isCurve(i)) return [i.style.closed ? [...i.points, i.points[0]] : i.points];
  if (isLine(i)) return [[i.startPosition, i.endPosition]];
  if (isShape(i) && i.shapeType === "RECTANGLE") {
    const { width: w, height: h } = i;
    return [[{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }, { x: 0, y: 0 }]];
  }
  return [];
}

export function listDoors(items: Item[]): DoorInfo[] {
  const out: DoorInfo[] = [];
  for (const it of items) {
    const doors = it.metadata[DOORS_KEY] as DoorMeta[];
    const contours = localContours(it);
    doors.forEach((d, index) => {
      const c = contours[d.start?.index ?? 0];
      const local = c ? pointAlong(c, ((d.start?.distance ?? 0) + (d.end?.distance ?? 0)) / 2) : { x: 0, y: 0 };
      out.push({
        key: `${it.id}#${index}`,
        n: 0,
        itemId: it.id,
        index,
        open: !!d.open,
        center: toWorld(local, it.position, it.rotation, it.scale),
      });
    });
  }
  // numerazione stabile per posizione (righe di ~50 px, poi da sinistra a destra)
  out.sort((a, b) => Math.round(a.center.y / 50) - Math.round(b.center.y / 50) || a.center.x - b.center.x);
  out.forEach((d, i) => (d.n = i + 1));
  return out;
}

export async function setDoorOpen(itemId: string, index: number, open: boolean) {
  await OBR.scene.items.updateItems([itemId], (items) => {
    for (const i of items) {
      const doors = [...((i.metadata[DOORS_KEY] as DoorMeta[]) ?? [])];
      if (doors[index]) doors[index] = { ...doors[index], open };
      i.metadata[DOORS_KEY] = doors;
    }
  });
}

/** Chiude tutte le porte aperte (es. a inizio sessione). */
export async function closeAll(items: Item[]) {
  const ids = items.filter((i) => (i.metadata[DOORS_KEY] as DoorMeta[]).some((d) => d.open)).map((i) => i.id);
  if (!ids.length) return;
  await OBR.scene.items.updateItems(ids, (list) => {
    for (const i of list) i.metadata[DOORS_KEY] = (i.metadata[DOORS_KEY] as DoorMeta[]).map((d) => ({ ...d, open: false }));
  });
}

/* ---------- numeri sulla mappa, solo sul dispositivo del master ---------- */

const LABEL_KEY = `${NS}/door-label`;
export const DOOR_NUMBERS_PREF = "obr-tavolo-door-numbers";

export function doorNumbersOn(): boolean {
  try {
    return localStorage.getItem(DOOR_NUMBERS_PREF) !== "off";
  } catch {
    return true;
  }
}

export function setDoorNumbers(on: boolean) {
  try {
    localStorage.setItem(DOOR_NUMBERS_PREF, on ? "on" : "off");
  } catch {
    /* ignorato */
  }
}

let lastSig = "";
/** Etichette locali (le vede solo chi le crea: il master) con il numero di ogni porta, verde se aperta, rossa se chiusa. */
export async function syncDoorLabels(force = false) {
  const on = doorNumbersOn() && (await OBR.scene.isReady());
  const doors = on ? listDoors((await OBR.scene.items.getItems()).filter(hasDoors)) : [];
  const sig = JSON.stringify(doors.map((d) => [d.n, d.open, Math.round(d.center.x), Math.round(d.center.y)]));
  if (!force && sig === lastSig) return;
  lastSig = sig;
  const old = await OBR.scene.local.getItems((i) => LABEL_KEY in i.metadata);
  if (old.length) await OBR.scene.local.deleteItems(old.map((i) => i.id));
  if (!doors.length) return;
  await OBR.scene.local.addItems(
    doors.map((d) =>
      buildLabel()
        .plainText(String(d.n))
        .position(d.center)
        .fontSize(30)
        .fontWeight(800)
        .padding(8)
        .cornerRadius(18)
        .fillColor("#ffffff")
        .backgroundColor(d.open ? "#2e7d32" : "#c62828")
        .backgroundOpacity(0.9)
        .pointerHeight(0)
        .layer("POINTER") // sopra la nebbia, così si legge anche nelle zone non ancora viste
        .locked(true)
        .disableHit(true)
        .metadata({ [LABEL_KEY]: true })
        .build(),
    ),
  );
}
