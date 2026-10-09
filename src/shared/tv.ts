/** Schermo TAVOLO: inquadra sempre tutta la mappa della scena. */
import OBR from "@owlbear-rodeo/sdk";
import { NS } from "./keys";

export const TV_CHANNEL = `${NS}/tv`;

/** Adatta la vista a tutti gli oggetti del livello Mappa (o a tutta la scena se non ce ne sono). */
export async function fitWholeMap() {
  if (!(await OBR.scene.isReady())) return;
  let ids = (await OBR.scene.items.getItems((i) => i.layer === "MAP")).map((i) => i.id);
  if (!ids.length) ids = (await OBR.scene.items.getItems()).map((i) => i.id);
  if (!ids.length) return;
  const bounds = await OBR.scene.items.getItemBounds(ids);
  await OBR.viewport.animateToBounds(bounds);
}

/** Comando dal master: tutti gli schermi TAVOLO reinquadrano la mappa. */
export const askTvFit = () => OBR.broadcast.sendMessage(TV_CHANNEL, { cmd: "fit" }, { destination: "REMOTE" });

/** Da chiamare nel background del client TAVOLO. */
export function startTvMode() {
  let mapKey = "";
  let timer: ReturnType<typeof setTimeout> | undefined;
  const refit = () => {
    clearTimeout(timer);
    timer = setTimeout(() => void fitWholeMap(), 300);
  };
  OBR.scene.onReadyChange((ready) => {
    mapKey = "";
    if (ready) refit();
  });
  // la mappa cambia (nuova mappa, spostata, ridimensionata) → reinquadra
  OBR.scene.items.onChange((items) => {
    const key = items
      .filter((i) => i.layer === "MAP")
      .map((i) => `${i.id}:${i.position.x},${i.position.y}:${i.scale.x}`)
      .join("|");
    if (key !== mapKey) {
      mapKey = key;
      refit();
    }
  });
  window.addEventListener("resize", refit);
  OBR.broadcast.onMessage(TV_CHANNEL, ({ data }) => {
    if ((data as { cmd?: string })?.cmd === "fit") refit();
  });
  refit();
}
