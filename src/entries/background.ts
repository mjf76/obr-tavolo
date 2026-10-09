/**
 * Script sempre attivo (manifest → background_url), uno per ogni client.
 * - registra la voce "Assegna a giocatore" nel menu del token (visibile solo al GM)
 * - lato GM: ricollega i token ai giocatori rientrati con id diverso ma stesso nome
 */
import OBR, { type Item, type Player } from "@owlbear-rodeo/sdk";
import { isCharacter, rebindByName } from "../shared/assignment";
import { IDS, KEYS, pageUrl } from "../shared/keys";
import { effectiveRole, loadDeviceMode } from "../shared/device";
import { ROLL_CHANNEL, rollText, type RollMessage } from "../sheet/rolls";
import { startTvMode } from "../shared/tv";
import { INIT_CHANNEL, isPcToken, updateCombat, type InitMessage } from "../shared/combat";
import { syncVision } from "../shared/vision";
import { enforceMeasurement } from "../shared/settings";

OBR.onReady(async () => {
  await OBR.contextMenu.create({
    id: IDS.contextAssign,
    icons: [
      {
        icon: pageUrl("icon.svg"),
        label: "Assegna a giocatore",
        filter: { roles: ["GM"], every: [{ key: "layer", value: "CHARACTER" }] },
      },
    ],
    embed: { url: pageUrl("assign.html"), height: 160 },
  });

  // Tiri: notifica sul tablet del master e sullo schermo TAVOLO;
  // ai giocatori arrivano solo i tiri pubblici del master (mostri), non quelli degli altri PG.
  OBR.broadcast.onMessage(ROLL_CHANNEL, async ({ data }) => {
    const m = data as RollMessage;
    const [role, name] = await Promise.all([OBR.player.getRole(), OBR.player.getName()]);
    const app = effectiveRole(role, name, loadDeviceMode());
    if (m.secret && app !== "GM") return;
    if (app === "PLAYER" && !m.gm) return;
    await OBR.notification.show(rollText(m), m.crit ? "SUCCESS" : m.fumble ? "WARNING" : "DEFAULT");
  });

  // Schermo TAVOLO: vista fissa su tutta la mappa.
  {
    const [role, name] = await Promise.all([OBR.player.getRole(), OBR.player.getName()]);
    if (effectiveRole(role, name, loadDeviceMode()) === "TAVOLO") startTvMode();
  }

  if ((await OBR.player.getRole()) !== "GM") return;

  // Iniziativa tirata dai giocatori → elenco del combattimento (scritto solo dal master).
  OBR.broadcast.onMessage(INIT_CHANNEL, async ({ data }) => {
    const m = data as InitMessage;
    if (typeof m?.value !== "number") return;
    await updateCombat((c) =>
      c.active
        ? { ...c, entries: c.entries.map((e) => (e.id === m.itemId ? { ...e, init: m.value, detail: m.detail } : e)) }
        : c,
    );
  });

  let party: Player[] = await OBR.party.getPlayers();
  let running = false;
  const sync = async () => {
    if (running || !(await OBR.scene.isReady())) return;
    running = true;
    try {
      const items: Item[] = (await OBR.scene.items.getItems()).filter(
        (i) => isCharacter(i) && i.metadata[KEYS.pcLink] !== undefined,
      );
      const n = await rebindByName(items, party.filter((p) => p.role === "PLAYER"));
      if (n) await OBR.notification.show(`OBR Tavolo: ricollegati ${n} personaggi ai loro giocatori`, "INFO");
    } finally {
      running = false;
    }
  };

  // Visione dei PG per la nebbia dinamica: si aggiorna da sola (scheda, luce portata, ambiente).
  let visionBusy = false;
  let visionAgain = false;
  const vision = async () => {
    if (visionBusy) return void (visionAgain = true);
    visionBusy = true;
    try {
      if (!(await OBR.scene.isReady())) return;
      const pcs = (await OBR.scene.items.getItems()).filter((i) => isCharacter(i) && isPcToken(i));
      await syncVision(pcs);
    } catch {
      /* scena chiusa nel frattempo */
    } finally {
      visionBusy = false;
      if (visionAgain) {
        visionAgain = false;
        void vision();
      }
    }
  };
  OBR.scene.items.onChange(() => void vision());
  OBR.scene.onMetadataChange(() => void vision());
  OBR.scene.grid.onChange(() => {
    void vision();
    void enforceMeasurement().catch(() => undefined);
  });
  OBR.room.onMetadataChange(() => void enforceMeasurement().catch(() => undefined));

  OBR.party.onChange((p) => {
    party = p;
    void sync();
  });
  OBR.scene.onReadyChange((r) => {
    if (!r) return;
    void sync();
    void vision();
    void enforceMeasurement().catch(() => undefined);
  });
  void enforceMeasurement().catch(() => undefined);
  void sync();
  void vision();
});
