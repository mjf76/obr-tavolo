/**
 * Assegnazione token ↔ giocatore.
 * Il legame è salvato nei metadata del token (id + nome del giocatore):
 * l'id è la chiave principale, il nome serve da paracadute se l'id cambia
 * (es. giocatore ospite che riapre il browser).
 */
import OBR, { type Item, type Player } from "@owlbear-rodeo/sdk";
import { KEYS } from "./keys";

export interface PcLink {
  playerId: string;
  playerName: string;
}

const norm = (s: string) => s.trim().toLocaleLowerCase("it-IT");

export function getLink(item: Item): PcLink | undefined {
  const raw = item.metadata[KEYS.pcLink] as Partial<PcLink> | undefined;
  if (!raw || typeof raw.playerId !== "string") return undefined;
  return { playerId: raw.playerId, playerName: String(raw.playerName ?? "") };
}

/** Token assegnati a un giocatore: prima per id, poi (paracadute) per nome. */
export function tokensOf(items: Item[], player: { id: string; name: string }): Item[] {
  const byId = items.filter((i) => getLink(i)?.playerId === player.id);
  if (byId.length) return byId;
  return items.filter((i) => {
    const l = getLink(i);
    return l && norm(l.playerName) === norm(player.name);
  });
}

/** Assegna (o rimuove, con player = null) i token indicati. */
export async function assign(itemIds: string[], player: Pick<Player, "id" | "name"> | null) {
  await OBR.scene.items.updateItems(itemIds, (items) => {
    for (const item of items) {
      if (player) item.metadata[KEYS.pcLink] = { playerId: player.id, playerName: player.name };
      else delete item.metadata[KEYS.pcLink];
    }
  });
}

/**
 * SPIKE Step 1: prova a rendere il giocatore "proprietario" del token,
 * così funziona anche con il permesso stanza "solo proprietario".
 * Restituisce true se OBR ha accettato la modifica.
 */
export async function transferOwnership(itemId: string, playerId: string): Promise<boolean> {
  await OBR.scene.items.updateItems([itemId], (items) => {
    for (const item of items) item.createdUserId = playerId;
  });
  const [after] = await OBR.scene.items.getItems([itemId]);
  return after?.createdUserId === playerId;
}

/**
 * Lato GM: se un token punta a un id non più presente ma c'è un giocatore
 * connesso con lo stesso nome, aggiorna l'id. Evita riassegnazioni manuali.
 */
export async function rebindByName(items: Item[], party: Player[]) {
  const onlineIds = new Set(party.map((p) => p.id));
  const updates: { id: string; player: Player }[] = [];
  for (const item of items) {
    const link = getLink(item);
    if (!link || onlineIds.has(link.playerId)) continue;
    const match = party.find((p) => norm(p.name) === norm(link.playerName));
    if (match) updates.push({ id: item.id, player: match });
  }
  for (const u of updates) await assign([u.id], u.player);
  return updates.length;
}

/** I token che contano come "personaggi": livello CHARACTER, non allegati ad altri oggetti. */
export const isCharacter = (i: Item) => i.layer === "CHARACTER" && !i.attachedTo;
