/** Scheda salvata nei metadata del token: la leggono telefono del giocatore, master e TV. */
import OBR, { type Item } from "@owlbear-rodeo/sdk";
import { NS } from "../shared/keys";
import { BUBBLES_KEY, readVitals } from "../shared/vitals";
import type { Monster, PgSheet, Sheet } from "./types";

export const SHEET_KEY = `${NS}/sheet`;

export function readSheet(item: Item | undefined): Sheet | undefined {
  const s = item?.metadata[SHEET_KEY] as Sheet | undefined;
  return s && (s.tipo === "pg" || s.tipo === "mostro") ? s : undefined;
}
export const readPg = (item: Item | undefined) => {
  const s = readSheet(item);
  return s?.tipo === "pg" ? s : undefined;
};

/** Applica una scheda PG al token: PF massimi e CA dalla scheda, PF attuali conservati. */
export async function applyPg(itemId: string, sheet: PgSheet) {
  await OBR.scene.items.updateItems([itemId], (items) => {
    for (const i of items) {
      const v = readVitals(i);
      const prev = (i.metadata[BUBBLES_KEY] ?? {}) as Record<string, unknown>;
      i.metadata[SHEET_KEY] = sheet;
      i.metadata[BUBBLES_KEY] = {
        ...prev,
        health: v.maxHp ? Math.min(v.hp, sheet.pf) : sheet.pf,
        "max health": sheet.pf,
        "temporary health": v.tempHp,
        "armor class": sheet.ca,
      };
    }
  });
}

/** Collega un mostro ai token: PF pieni, CA, statistiche nascoste ai giocatori (Stat Bubbles). */
export async function bindMonster(itemIds: string[], m: Monster) {
  await OBR.scene.items.updateItems(itemIds, (items) => {
    for (const i of items) {
      const prev = (i.metadata[BUBBLES_KEY] ?? {}) as Record<string, unknown>;
      i.metadata[SHEET_KEY] = m;
      i.metadata[BUBBLES_KEY] = {
        ...prev,
        health: m.pf,
        "max health": m.pf,
        "temporary health": 0,
        "armor class": m.ca,
        hide: true,
      };
    }
  });
}

export async function unbindSheet(itemIds: string[]) {
  await OBR.scene.items.updateItems(itemIds, (items) => {
    for (const i of items) delete i.metadata[SHEET_KEY];
  });
}
