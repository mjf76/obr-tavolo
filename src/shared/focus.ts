/**
 * Token "in primo piano" nel pannello del master.
 * Non usa la selezione di Owlbear quando non serve: i giocatori vedono le selezioni
 * altrui (con il nome di chi seleziona) anche sui token nascosti.
 */
import { useEffect, useState } from "react";
import OBR, { buildShape, type Item } from "@owlbear-rodeo/sdk";
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

/* ---------- evidenziazione locale (solo sullo schermo del master) ---------- */


const HIGHLIGHT_ID = `${NS}/focus-ring`;

/**
 * Cerchio dorato attorno al token in primo piano. È un oggetto *locale*:
 * esiste solo sul dispositivo del master, quindi giocatori e TV non lo vedono
 * (nemmeno sui token nascosti).
 */
export function useFocusHighlight(focus: Item[]) {
  const id = focus.length === 1 ? focus[0].id : null;
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      await OBR.scene.local.deleteItems([HIGHLIGHT_ID]).catch(() => undefined);
      if (!id || cancelled) return;
      const b = await OBR.scene.items.getItemBounds([id]);
      const size = Math.max(b.width, b.height) * 1.3;
      const ring = buildShape()
        .id(HIGHLIGHT_ID)
        .shapeType("CIRCLE")
        .width(size)
        .height(size)
        .position(b.center)
        .fillOpacity(0)
        .strokeColor("#e8c36a")
        .strokeWidth(Math.max(6, size * 0.06))
        .strokeDash([size * 0.12, size * 0.08])
        .attachedTo(id)
        .locked(true)
        .disableHit(true)
        .layer("ATTACHMENT")
        .build();
      if (!cancelled) await OBR.scene.local.addItems([ring]);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [id]);
}

/**
 * Centra e ingrandisce la mappa sull'esemplare: circa 11 caselle (5 per lato) nel lato corto
 * della parte di mappa visibile. Nel pannello a metà schermo conta solo la parte sopra il pannello.
 */
export async function centerViewOn(itemId: string, cells = 11) {
  const b = await OBR.scene.items.getItemBounds([itemId]);
  await centerOnPoint(b.center, cells);
}

/** Centra e ingrandisce la mappa su un punto (circa `cells` caselle nel lato corto visibile). */
export async function centerOnPoint(p: { x: number; y: number }, cells = 11) {
  const [dpi, w, h] = await Promise.all([OBR.scene.grid.getDpi(), OBR.viewport.getWidth(), OBR.viewport.getHeight()]);
  const inBottomPanel = location.pathname.endsWith("gm.html");
  const visibleH = inBottomPanel ? Math.max(h - window.innerHeight, h * 0.25) : h;
  const scale = Math.min(w, visibleH) / (cells * dpi);
  await OBR.viewport.animateTo({ position: { x: w / 2 - p.x * scale, y: visibleH / 2 - p.y * scale }, scale });
}
