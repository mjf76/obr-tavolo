/**
 * Visione dei PG con la nebbia dinamica di Owlbear ("Dynamic Fog").
 *
 * L'estensione Dynamic Fog legge su ogni token la chiave `rodeo.owlbear.dynamic-fog/light`
 * e su OGNI dispositivo crea la luce corrispondente: quindi TV e telefoni vedono l'unione
 * di ciò che vedono i PG, senza aprire la nostra estensione.
 *
 * Regole (D&D 5.5):
 * - Mappa illuminata: il PG vede lontano; decidono muri e porte.
 * - Mappa buia: il PG vede fin dove arriva la scurovisione o la luce che porta, la maggiore delle due.
 *   Le luci della mappa (torce, bracieri) vanno impostate come "secondarie": si vedono
 *   quando un PG ha la linea di vista verso di loro.
 */
import OBR, { type Item } from "@owlbear-rodeo/sdk";
import { NS } from "./keys";
import { readSheet } from "../sheet/store";
import { readState } from "./vitals";
import { LUCI, lightFor, parseDarkvisionFt, type Ambiente, type FogLight } from "./visionRules";
export { LUCI, type Ambiente, type FogLight };

export const FOG_LIGHT_KEY = "rodeo.owlbear.dynamic-fog/light";
export const VISION_KEY = `${NS}/visione`;

export interface VisionSettings {
  /** l'app imposta da sola la visione dei PG */
  auto: boolean;
  ambiente: Ambiente;
}
export const DEFAULT_VISION: VisionSettings = { auto: true, ambiente: "buio" };

/** Scurovisione in piedi, dai sensi della scheda. */
export function darkvisionFt(item: Item): number {
  const s = readSheet(item);
  if (!s) return 0;
  return parseDarkvisionFt(Array.isArray(s.sensi) ? s.sensi.join(", ") : (s.sensi ?? ""));
}

export function readVisionSettings(meta: Record<string, unknown>): VisionSettings {
  const v = meta[VISION_KEY] as Partial<VisionSettings> | undefined;
  return { ...DEFAULT_VISION, ...(v ?? {}) };
}

export async function setVisionSettings(patch: Partial<VisionSettings>) {
  const meta = await OBR.scene.getMetadata();
  await OBR.scene.setMetadata({ [VISION_KEY]: { ...readVisionSettings(meta), ...patch } });
}

/** Luce portata, salvata nello stato del PG (la sceglie il giocatore dal telefono). */
export const carriedLight = (item: Item) => LUCI.find((l) => l.id === (readState(item).luce ?? "")) ?? LUCI[0];

/** Luce di visione di un PG. `gridFt` = piedi per casella (5 di norma), `dpi` = pixel per casella. */
export function pcLight(item: Item, settings: VisionSettings, dpi: number, gridFt = 5): FogLight {
  return lightFor(darkvisionFt(item), carriedLight(item).id, settings.ambiente, dpi, gridFt);
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Allinea la visione di tutti i PG (eseguito dal master in background).
 * Scrive solo dove serve, quindi si può chiamare a ogni cambio di scena.
 */
export async function syncVision(pcs: Item[]): Promise<number> {
  const meta = await OBR.scene.getMetadata();
  const settings = readVisionSettings(meta);
  if (!settings.auto || pcs.length === 0) return 0;
  const [dpi, scale] = await Promise.all([OBR.scene.grid.getDpi(), OBR.scene.grid.getScale()]);
  const unit = scale.parsed.unit.toLowerCase();
  const gridFt = unit.startsWith("m") ? scale.parsed.multiplier / 0.3 : scale.parsed.multiplier || 5;
  const wanted = new Map<string, FogLight>();
  for (const p of pcs) {
    const l = pcLight(p, settings, dpi, gridFt);
    if (!same(p.metadata[FOG_LIGHT_KEY], l)) wanted.set(p.id, l);
  }
  if (!wanted.size) return 0;
  await OBR.scene.items.updateItems([...wanted.keys()], (items) => {
    for (const i of items) i.metadata[FOG_LIGHT_KEY] = wanted.get(i.id);
  });
  return wanted.size;
}

/** Mostri con una luce "primaria": rivelerebbero ai giocatori ciò che vede il mostro. */
export const monstersWithPrimaryLight = (monsters: Item[]) =>
  monsters.filter((m) => {
    const l = m.metadata[FOG_LIGHT_KEY] as { lightType?: string } | undefined;
    return l && (l.lightType === undefined || l.lightType === "PRIMARY");
  });

export async function makeSecondary(ids: string[]) {
  await OBR.scene.items.updateItems(ids, (items) => {
    for (const i of items) {
      const l = i.metadata[FOG_LIGHT_KEY] as Record<string, unknown> | undefined;
      if (l) i.metadata[FOG_LIGHT_KEY] = { ...l, lightType: "SECONDARY" };
    }
  });
}

/** Testo per l'interfaccia: "Scurovisione 18 m · Torcia". */
export function visionSummary(item: Item, settings: VisionSettings): string {
  if (settings.ambiente === "luce") return "mappa illuminata";
  const dv = darkvisionFt(item);
  const l = carriedLight(item);
  const parts = [dv ? `scurovisione ${Math.round(dv * 0.3 * 10) / 10} m` : "niente scurovisione"];
  if (l.ft) parts.push(l.label.toLowerCase());
  return parts.join(" · ");
}
