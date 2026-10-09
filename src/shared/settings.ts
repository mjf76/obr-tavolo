/**
 * Impostazioni della stanza (valgono per tutte le scene), salvate nei metadata della stanza.
 * Qui finisce tutto ciò che non è il comportamento predefinito.
 */
import { useEffect, useState } from "react";
import OBR from "@owlbear-rodeo/sdk";
import { NS } from "./keys";
import type { Measurement } from "./movement";

export const SETTINGS_KEY = `${NS}/settings`;

export interface RoomSettings {
  /** regola per le diagonali, imposta su ogni scena (predefinita 5-10-5) */
  misura: Measurement;
}
export const DEFAULT_SETTINGS: RoomSettings = { misura: "ALTERNATING" };

export const readSettings = (meta: Record<string, unknown>): RoomSettings => ({
  ...DEFAULT_SETTINGS,
  ...((meta[SETTINGS_KEY] as Partial<RoomSettings>) ?? {}),
});

export async function setSettings(patch: Partial<RoomSettings>) {
  const meta = await OBR.room.getMetadata();
  await OBR.room.setMetadata({ [SETTINGS_KEY]: { ...readSettings(meta), ...patch } });
}

export function useRoomSettings(): RoomSettings {
  const [s, setS] = useState<RoomSettings>(DEFAULT_SETTINGS);
  useEffect(() => {
    OBR.room.getMetadata().then((m) => setS(readSettings(m)));
    return OBR.room.onMetadataChange((m) => setS(readSettings(m)));
  }, []);
  return s;
}

/** Master: applica la regola delle diagonali alla scena aperta, se diversa. */
export async function enforceMeasurement() {
  if (!(await OBR.scene.isReady())) return;
  const s = readSettings(await OBR.room.getMetadata());
  if ((await OBR.scene.grid.getMeasurement()) !== s.misura) await OBR.scene.grid.setMeasurement(s.misura);
}
