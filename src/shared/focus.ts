/**
 * Token "in primo piano" nel pannello del master.
 * Non usa la selezione di Owlbear quando non serve: i giocatori vedono le selezioni
 * altrui (con il nome di chi seleziona) anche sui token nascosti.
 */
import { useEffect, useState } from "react";
import OBR, { type Item } from "@owlbear-rodeo/sdk";
import { NS } from "./keys";

let focusIds: string[] = [];
const subs = new Set<(ids: string[]) => void>();

export function setFocus(ids: string[]) {
  focusIds = ids;
  subs.forEach((f) => f(ids));
}

const PROTECT_KEY = `${NS}/protect-hidden`;
export function loadProtectHidden(): boolean {
  try {
    return localStorage.getItem(PROTECT_KEY) !== "off";
  } catch {
    return true;
  }
}
export function saveProtectHidden(on: boolean) {
  try {
    localStorage.setItem(PROTECT_KEY, on ? "on" : "off");
  } catch {
    /* ignorato */
  }
}

/**
 * Token in primo piano: segue la selezione di Owlbear, ma se il master seleziona
 * un token nascosto lo tiene in primo piano e annulla subito la selezione
 * (così sugli schermi dei giocatori non compare l'etichetta "GM").
 */
export function useFocus(sceneReady: boolean, all: Item[]): Item[] {
  const [ids, setIds] = useState<string[]>(focusIds);
  useEffect(() => {
    subs.add(setIds);
    return () => {
      subs.delete(setIds);
    };
  }, []);
  useEffect(() => {
    const onSel = async (sel: string[] | undefined) => {
      if (!sel?.length) return;
      setFocus(sel);
      if (!loadProtectHidden()) return;
      const items = await OBR.scene.items.getItems(sel);
      if (items.some((i) => !i.visible)) await OBR.player.deselect();
    };
    OBR.player.getSelection().then(onSel);
    return OBR.player.onChange((p) => void onSel(p.selection));
  }, []);
  return sceneReady ? all.filter((i) => ids.includes(i.id)) : [];
}
