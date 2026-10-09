/**
 * Ruolo effettivo di questo dispositivo.
 * - GM: chi ha il ruolo GM in OBR (tablet del DM)
 * - TAVOLO: il client collegato al TV (nome "TAVOLO" oppure forzato nelle impostazioni)
 * - PLAYER: telefono di un giocatore
 */
import { NS, TABLE_PLAYER_NAME } from "./keys";

export type DeviceMode = "auto" | "tavolo" | "giocatore";
export type AppRole = "GM" | "TAVOLO" | "PLAYER";

const STORAGE_KEY = `${NS}/device-mode`;

export function loadDeviceMode(): DeviceMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "tavolo" || v === "giocatore") return v;
  } catch {
    /* storage non disponibile: si usa auto */
  }
  return "auto";
}

export function saveDeviceMode(mode: DeviceMode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignorato */
  }
}

export function effectiveRole(obrRole: "GM" | "PLAYER", name: string, mode: DeviceMode): AppRole {
  if (obrRole === "GM") return "GM"; // il TV non deve mai essere GM: vedrebbe sotto la nebbia
  if (mode === "tavolo") return "TAVOLO";
  if (mode === "giocatore") return "PLAYER";
  return name.trim().toUpperCase() === TABLE_PLAYER_NAME ? "TAVOLO" : "PLAYER";
}

export const isTableName = (name: string) => name.trim().toUpperCase() === TABLE_PLAYER_NAME;
