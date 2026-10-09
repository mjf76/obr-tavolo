/**
 * Combattimento: elenco unico PG + mostri ordinato per iniziativa.
 * Lo stato sta nei metadata della scena (scritti solo dal master);
 * i giocatori inviano il proprio tiro con un messaggio broadcast.
 */
import { useEffect, useState } from "react";
import OBR, { type Item, type Metadata } from "@owlbear-rodeo/sdk";
import { NS } from "./keys";
import { getLink } from "./assignment";
import { readSheet } from "../sheet/store";
import { initiative, mod } from "../sheet/derive";

export const COMBAT_KEY = `${NS}/combat`;
export const INIT_CHANNEL = `${NS}/init`;

export interface CombatEntry {
  id: string; // id del token
  name: string;
  kind: "pg" | "mostro";
  bonus: number;
  init: number | null;
  detail?: string;
}

export interface CombatState {
  active: boolean;
  entries: CombatEntry[];
}

export const NO_COMBAT: CombatState = { active: false, entries: [] };

export function readCombat(meta: Metadata): CombatState {
  const c = meta[COMBAT_KEY] as Partial<CombatState> | undefined;
  if (!c || !Array.isArray(c.entries)) return NO_COMBAT;
  return { active: c.active === true, entries: c.entries as CombatEntry[] };
}

/** Modifica atomica lato master. */
export async function updateCombat(fn: (c: CombatState) => CombatState) {
  const cur = readCombat(await OBR.scene.getMetadata());
  await OBR.scene.setMetadata({ [COMBAT_KEY]: fn(cur) });
}

export function useCombat(sceneReady: boolean): CombatState {
  const [c, setC] = useState<CombatState>(NO_COMBAT);
  useEffect(() => {
    if (!sceneReady) {
      setC(NO_COMBAT);
      return;
    }
    OBR.scene.getMetadata().then((m) => setC(readCombat(m)));
    return OBR.scene.onMetadataChange((m) => setC(readCombat(m)));
  }, [sceneReady]);
  return c;
}

/** Ordine: iniziativa decrescente (vuote in fondo), poi bonus, poi nome. */
export function sortEntries(entries: CombatEntry[]): CombatEntry[] {
  return [...entries].sort((a, b) => {
    if (a.init === null && b.init !== null) return 1;
    if (b.init === null && a.init !== null) return -1;
    if (a.init !== b.init) return (b.init ?? 0) - (a.init ?? 0);
    if (a.bonus !== b.bonus) return b.bonus - a.bonus;
    return a.name.localeCompare(b.name);
  });
}

export const isPcToken = (i: Item) => !!getLink(i) || readSheet(i)?.tipo === "pg";

/** Bonus di iniziativa: dalla scheda PG, oppure Destrezza del mostro. */
export function initBonus(i: Item): number {
  const s = readSheet(i);
  if (s?.tipo === "pg") return initiative(s);
  if (s?.tipo === "mostro") return mod(s.caratteristiche.des);
  return 0;
}

export function entryFor(i: Item): CombatEntry {
  const s = readSheet(i);
  return {
    id: i.id,
    name: s?.tipo === "pg" ? s.nome : i.name,
    kind: isPcToken(i) ? "pg" : "mostro",
    bonus: initBonus(i),
    init: null,
  };
}

/** Messaggio del giocatore al master. */
export interface InitMessage {
  itemId: string;
  value: number;
  detail: string;
}
export const sendInitiative = (m: InitMessage) => OBR.broadcast.sendMessage(INIT_CHANNEL, m, { destination: "REMOTE" });
