// OBR finto per provare l'interfaccia nel browser senza Owlbear (solo sviluppo: `npx vite -c tests/mock/vite.mock.config.ts`)
const q = new URLSearchParams(location.search);
const role = (q.get("role") ?? "PLAYER") as "GM" | "PLAYER";
const name = q.get("name") ?? (role === "GM" ? "Master" : "Anna");
const tok = (id: string, n: string, x: number, link?: [string, string]) => ({
  id, name: n, type: "IMAGE", layer: "CHARACTER", visible: true, locked: false, createdUserId: "gm", zIndex: 1,
  lastModified: "", lastModifiedUserId: "", position: { x, y: 300 }, rotation: 0, scale: { x: 1, y: 1 },
  metadata: link ? { "it.mjf.obr-tavolo/pc": { playerId: link[0], playerName: link[1] } } : {},
  image: { url: "" },
});
const k: any = tok("t1", "Kitiara", 150, ["p-anna", "Anna"]);
k.metadata["com.owlbear-rodeo-bubbles-extension/metadata"] = { health: 12, "max health": 27, "temporary health": 5, "armor class": 16 };
k.metadata["it.mjf.obr-tavolo/state"] = { conditions: ["poisoned", "prone"], exhaustion: 1, concentration: null, deathSaves: { ok: 0, ko: 0 } };
import bran from "../../examples/pg-esempio-guerriero.json";
import ilsa from "../../examples/pg-esempio-mago.json";
if (q.get("sheet") !== "no") k.metadata["it.mjf.obr-tavolo/sheet"] = q.get("pg") === "mago" ? ilsa : bran;
const gob: any = tok("t4", "Goblin guerriero 2", 600); gob.visible = false;
gob.metadata["it.mjf.obr-tavolo/sheet"] = { tipo: "mostro", versione: 1, id: "goblin-warrior", nome: "Goblin guerriero", ca: 15, pf: 10, velocita: "9 m", caratteristiche: { for: 8, des: 15, cos: 10, int: 10, sag: 8, car: 8 }, sezioni: [] };
const gob2: any = structuredClone(gob); gob2.id = "t5"; gob2.name = "Goblin guerriero"; gob2.position = { x: 750, y: 300 };
let items: any[] = [k, gob, gob2, tok("t2", "Roh Musk", 300), tok("t3", "Lupo di Anna", 450, ["p-anna", "Anna"])];
const subs: ((i: any[]) => void)[] = [];
const msubs: ((m: any) => void)[] = [];
let meta: any = q.get("combat") ? { "it.mjf.obr-tavolo/combat": { active: true, entries: [
  { id: "t1", name: "Kitiara", kind: "pg", bonus: 5, init: null },
  { id: "t4", name: "Goblin guerriero 2", kind: "mostro", bonus: 2, init: 14, detail: "[12] + 2 = 14" } ] } } : {};
const noop = () => () => {};
const ok = async () => {};
const OBR: any = {
  isAvailable: true, isReady: true, onReady: (cb: () => void) => cb(),
  player: { getId: async () => (role === "GM" ? "gm" : "p-anna"), getName: async () => name, getRole: async () => role,
    getColor: async () => "#e8c36a", onChange: noop, deselect: ok, getSelection: async () => [q.get("sel") ?? "t1"] },
  party: { getPlayers: async () => [
    { id: "p-anna", connectionId: "c1", role: "PLAYER", name: "Anna", color: "#6fcf97", metadata: {} },
    { id: "p-bob", connectionId: "c2", role: "PLAYER", name: "Bruno", color: "#8fd3f2", metadata: {} },
    { id: "p-tv", connectionId: "c3", role: "PLAYER", name: "TAVOLO", color: "#aaa", metadata: {} },
  ], onChange: noop },
  scene: { isReady: async () => true, onReadyChange: noop,
    getMetadata: async () => meta, setMetadata: async (u: any) => { meta = { ...meta, ...u }; msubs.forEach((f) => f(meta)); },
    onMetadataChange: (cb: any) => { msubs.push(cb); return () => {}; },
    items: { getItems: async (ids?: any) => (Array.isArray(ids) ? items.filter((i) => ids.includes(i.id)) : items), getItemBounds: async () => ({ center: { x: 0, y: 0 }, width: 150, height: 150, min: { x: 0, y: 0 }, max: { x: 0, y: 0 } }),
      onChange: (cb: any) => { subs.push(cb); return () => {}; },
      updateItems: async (ids: string[], fn: (d: any[]) => void) => { const d = structuredClone(items.filter((i) => ids.includes(i.id))); fn(d);
        items = items.map((i) => d.find((x) => x.id === i.id) ?? i); subs.forEach((s) => s(items)); } },
    grid: { getDpi: async () => 150, getMeasurement: async () => q.get("meas") ?? "ALTERNATING",
      getScale: async () => ({ raw: "5ft", parsed: { multiplier: 5, unit: "ft", digits: 0 } }), getType: async () => "SQUARE",
      onChange: noop, setMeasurement: ok },
    local: { addItems: ok, deleteItems: ok } },
  room: { getPermissions: async () => (q.get("perms") ?? "CHARACTER_UPDATE").split(","), onPermissionsChange: noop },
  broadcast: { sendMessage: ok, onMessage: noop },
  modal: { open: async (m: any) => { location.href = m.url; }, close: ok },
  action: { close: ok }, popover: { open: ok, close: ok, setHeight: ok }, notification: { show: async (m: string) => console.log("NOTIFICA", m) },
  viewport: { getScale: async () => 1, getWidth: async () => 400, getHeight: async () => 800, animateTo: ok },
  contextMenu: { create: ok },
};
export default OBR;
/** Builder finto: ogni metodo restituisce sé stesso, build() un oggetto vuoto. */
export const buildShape = () => {
  const b: any = new Proxy({}, { get: (_t, k) => (k === "build" ? () => ({}) : () => b) });
  return b;
};
