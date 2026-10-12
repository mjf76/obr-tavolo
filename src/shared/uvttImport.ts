/**
 * Import di mappe .dd2vtt/.uvtt (Dungeondraft, Dungeon Alchemist…) come nuove scene,
 * con muri e porte per la nebbia dinamica. Stessa struttura usata da Scene Importer:
 * percorsi nel livello FOG, porte con metadata `rodeo.owlbear.dynamic-fog/doors`.
 *
 * Uso (strumento di preparazione, solo master): la pagina di Owlbear manda al nostro
 * script di background un messaggio `{ type: "obr-tavolo/import", files: File[] }`.
 * I file .dd2vtt/.uvtt diventano scene; le immagini diventano asset personaggio.
 */
import OBR, { buildImageUpload, buildPath, buildSceneUpload, Command, type Item, type PathCommand } from "@owlbear-rodeo/sdk";
import { DOORS_KEY } from "./doors";

const SCENE_DPI = 150; // dpi della griglia di una scena nuova di Owlbear

interface Pt {
  x: number;
  y: number;
}
interface Uvtt {
  resolution: { map_origin?: Pt; map_size: Pt; pixels_per_grid: number };
  line_of_sight?: Pt[][];
  objects_line_of_sight?: Pt[][];
  portals?: { bounds: Pt[]; closed?: boolean }[];
  image?: string;
}

function mime(b64: string): string {
  if (b64.startsWith("iVBOR")) return "image/png";
  if (b64.startsWith("/9j/")) return "image/jpeg";
  if (b64.startsWith("UklGR")) return "image/webp";
  return "image/png";
}

function b64ToBlob(b64: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime(b64) });
}

export function uvttItems(u: Uvtt): Item[] {
  const sc = (p: Pt) => ({ x: p.x * SCENE_DPI, y: p.y * SCENE_DPI });
  const walls = [...(u.line_of_sight ?? []), ...(u.objects_line_of_sight ?? [])]
    .filter((l) => l.length >= 2)
    .map((l) => {
      const p = l.map(sc);
      return buildPath()
        .position({ x: 0, y: 0 })
        .commands([[Command.MOVE, p[0].x, p[0].y], ...p.slice(1).map((q): PathCommand => [Command.LINE, q.x, q.y])])
        .strokeColor("#000000")
        .strokeOpacity(1)
        .strokeWidth(2)
        .fillOpacity(0)
        .layer("FOG")
        .name("Wall")
        .build() as Item;
    });
  const doors = (u.portals ?? [])
    .filter((d) => d.bounds?.length >= 2)
    .map((d) => {
      const a = sc(d.bounds[0]);
      const b = sc(d.bounds[d.bounds.length - 1]);
      return buildPath()
        .position({ x: 0, y: 0 })
        .commands([
          [Command.MOVE, a.x, a.y],
          [Command.LINE, b.x, b.y],
        ])
        .strokeColor("#FF0000")
        .strokeOpacity(1)
        .strokeWidth(5)
        .fillOpacity(0)
        .layer("FOG")
        .name("Door")
        .metadata({
          [DOORS_KEY]: [
            { open: !(d.closed ?? true), start: { distance: 0, index: 0 }, end: { distance: Math.hypot(b.x - a.x, b.y - a.y), index: 0 } },
          ],
        })
        .build() as Item;
    });
  return [...walls, ...doors];
}

async function sceneFromUvtt(file: File) {
  const u = JSON.parse(await file.text()) as Uvtt;
  if (!u.image || !u.resolution) throw new Error(`${file.name}: file senza immagine o risoluzione`);
  const name = file.name.replace(/\.[^.]+$/, "");
  const blob = b64ToBlob(u.image);
  const map = buildImageUpload(new File([blob], `map.${blob.type.split("/")[1]}`, { type: blob.type }))
    .dpi(u.resolution.pixels_per_grid)
    .name(name)
    .build();
  const items = uvttItems(u);
  let s = buildSceneUpload().name(name).baseMap(map).gridType("SQUARE").gridScale("5ft");
  if (items.length) s = s.items(items).fogFilled(true);
  return s.build();
}

export function listenForImports() {
  window.addEventListener("message", async (e: MessageEvent) => {
    if (e.origin !== "https://www.owlbear.rodeo") return;
    const d = e.data as { type?: string; files?: File[] };
    if (d?.type !== "obr-tavolo/import" || !Array.isArray(d.files)) return;
    try {
      const maps = d.files.filter((f) => /\.(dd2vtt|uvtt|df2vtt)$/i.test(f.name));
      const imgs = d.files.filter((f) => f.type.startsWith("image/"));
      if (maps.length) {
        const scenes = [];
        for (const f of maps) scenes.push(await sceneFromUvtt(f));
        await OBR.assets.uploadScenes(scenes, true);
      }
      if (imgs.length) {
        await OBR.assets.uploadImages(
          imgs.map((f) => buildImageUpload(f).name(f.name.replace(/\.[^.]+$/, "")).build()),
          "CHARACTER",
        );
      }
      await OBR.notification.show(`Import: ${maps.length} scene, ${imgs.length} immagini`, "SUCCESS");
    } catch (err) {
      await OBR.notification.show(`Import fallito: ${(err as Error).message}`, "ERROR");
    }
  });
}
