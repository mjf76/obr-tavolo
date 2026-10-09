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

  // Tiri dei giocatori: notifica sul tablet del master e sullo schermo TAVOLO.
  OBR.broadcast.onMessage(ROLL_CHANNEL, async ({ data }) => {
    const m = data as RollMessage;
    const [role, name] = await Promise.all([OBR.player.getRole(), OBR.player.getName()]);
    const app = effectiveRole(role, name, loadDeviceMode());
    if (app === "PLAYER") return;
    if (m.secret && app !== "GM") return;
    await OBR.notification.show(rollText(m), m.crit ? "SUCCESS" : m.fumble ? "WARNING" : "DEFAULT");
  });

  // Schermo TAVOLO: vista fissa su tutta la mappa.
  {
    const [role, name] = await Promise.all([OBR.player.getRole(), OBR.player.getName()]);
    if (effectiveRole(role, name, loadDeviceMode()) === "TAVOLO") startTvMode();
  }

  if ((await OBR.player.getRole()) !== "GM") return;

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

  OBR.party.onChange((p) => {
    party = p;
    void sync();
  });
  OBR.scene.onReadyChange((r) => r && void sync());
  void sync();
});
