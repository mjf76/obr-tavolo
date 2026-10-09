/** Hook React che espongono lo stato OBR in tempo reale. */
import { useEffect, useState } from "react";
import OBR, { type Item, type Permission, type Player } from "@owlbear-rodeo/sdk";
import { parseScale, type Measurement, type Scale } from "./movement";

/** true quando l'SDK è pronto (o false per sempre se la pagina non è dentro OBR). */
export function useObrReady(): boolean {
  const [ready, setReady] = useState(OBR.isReady);
  useEffect(() => {
    if (OBR.isAvailable && !OBR.isReady) OBR.onReady(() => setReady(true));
  }, []);
  return ready;
}

export function useSceneReady(ready: boolean): boolean {
  const [sceneReady, setSceneReady] = useState(false);
  useEffect(() => {
    if (!ready) return;
    OBR.scene.isReady().then(setSceneReady);
    return OBR.scene.onReadyChange(setSceneReady);
  }, [ready]);
  return sceneReady;
}

export interface Me {
  id: string;
  name: string;
  role: "GM" | "PLAYER";
  color: string;
}

export function useMe(ready: boolean): Me | null {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    if (!ready) return;
    Promise.all([OBR.player.getId(), OBR.player.getName(), OBR.player.getRole(), OBR.player.getColor()]).then(
      ([id, name, role, color]) => setMe({ id, name, role, color }),
    );
    return OBR.player.onChange((p) => setMe({ id: p.id, name: p.name, role: p.role, color: p.color }));
  }, [ready]);
  return me;
}

/** Gli altri giocatori connessi (OBR esclude sé stessi). */
export function useParty(ready: boolean): Player[] {
  const [party, setParty] = useState<Player[]>([]);
  useEffect(() => {
    if (!ready) return;
    OBR.party.getPlayers().then(setParty);
    return OBR.party.onChange(setParty);
  }, [ready]);
  return party;
}

export function useItems(sceneReady: boolean, filter: (i: Item) => boolean): Item[] {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    if (!sceneReady) {
      setItems([]);
      return;
    }
    OBR.scene.items.getItems().then((all) => setItems(all.filter(filter)));
    return OBR.scene.items.onChange((all) => setItems(all.filter(filter)));
    // il filtro deve essere stabile (definito fuori dal componente)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneReady]);
  return items;
}

export interface GridInfo {
  dpi: number;
  measurement: Measurement;
  scale: Scale;
  type: string;
}

export function useGrid(sceneReady: boolean): GridInfo | null {
  const [grid, setGrid] = useState<GridInfo | null>(null);
  useEffect(() => {
    if (!sceneReady) {
      setGrid(null);
      return;
    }
    const load = async () => {
      const [dpi, measurement, scale, type] = await Promise.all([
        OBR.scene.grid.getDpi(),
        OBR.scene.grid.getMeasurement(),
        OBR.scene.grid.getScale(),
        OBR.scene.grid.getType(),
      ]);
      setGrid({ dpi, measurement, scale: scale.parsed ?? parseScale(scale.raw), type });
    };
    load();
    return OBR.scene.grid.onChange(() => void load());
  }, [sceneReady]);
  return grid;
}

export function useRoomPermissions(ready: boolean): Permission[] {
  const [perms, setPerms] = useState<Permission[]>([]);
  useEffect(() => {
    if (!ready) return;
    OBR.room.getPermissions().then(setPerms);
    return OBR.room.onPermissionsChange(setPerms);
  }, [ready]);
  return perms;
}

/** Immagine del token, se è un'immagine. */
export function itemImage(item: Item): string | undefined {
  const img = (item as Item & { image?: { url?: string } }).image;
  return img?.url;
}
