/**
 * Tiri di dado condivisi: il risultato appare sul telefono di chi tira,
 * sul tablet del master e sullo schermo TAVOLO (notifica Owlbear).
 * I tiri pubblici del master (mostri) arrivano anche ai telefoni dei giocatori.
 */
import OBR from "@owlbear-rodeo/sdk";
import { NS } from "../shared/keys";
import { d20, doubleDice, roll, type Mode, type RollResult } from "./dice";

export const ROLL_CHANNEL = `${NS}/roll`;

export interface RollMessage {
  byId: string;
  byName: string;
  char: string;
  label: string;
  total: number;
  detail: string;
  crit?: boolean;
  fumble?: boolean;
  /** visibile solo a chi tira e al master */
  secret?: boolean;
  /** tirato dal master (mostri/PNG) */
  gm?: boolean;
  /** riga aggiuntiva (es. danni dopo il colpo) */
  extra?: string;
}

type Listener = (m: RollMessage) => void;
const listeners = new Set<Listener>();
export function onLocalRoll(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export async function share(msg: Omit<RollMessage, "byId" | "byName">) {
  const [byId, byName, role] = await Promise.all([OBR.player.getId(), OBR.player.getName(), OBR.player.getRole()]);
  const full: RollMessage = { ...msg, byId, byName, gm: role === "GM" };
  listeners.forEach((l) => l(full));
  try {
    // ALL: anche il master vede i propri tiri (i giocatori li vedono già nell app)
    await OBR.broadcast.sendMessage(ROLL_CHANNEL, full, { destination: "ALL" });
  } catch {
    /* fuori da OBR (simulatore) */
  }
  return full;
}

export async function rollAndShare(
  char: string,
  label: string,
  expr: string,
  mode: Mode = "normale",
  opts: { secret?: boolean } = {},
): Promise<RollResult | null> {
  const r = roll(expr, mode);
  if (!r) {
    await OBR.notification.show(`Espressione di dadi non valida: ${expr}`, "ERROR");
    return null;
  }
  const modeTag = mode === "vantaggio" ? " (vantaggio)" : mode === "svantaggio" ? " (svantaggio)" : "";
  await share({ char, label: label + modeTag, total: r.total, detail: r.detail, crit: r.crit, fumble: r.fumble, secret: opts.secret });
  return r;
}

/** Tiro per colpire + danni insieme (i dadi dei danni raddoppiano col 20 naturale). */
export async function attackAndShare(
  char: string,
  label: string,
  toHit: number,
  damage: { expr: string; tipo: string }[],
  mode: Mode = "normale",
  critMin = 20,
) {
  const hit = roll(d20(toHit), mode)!;
  if (hit.natural !== undefined && hit.natural >= critMin) hit.crit = true;
  const parts = damage
    .map((d) => {
      const r = roll(hit.crit ? doubleDice(d.expr) : d.expr);
      return r ? `${r.total} ${d.tipo}`.trim() : "";
    })
    .filter(Boolean);
  const modeTag = mode === "vantaggio" ? " (vantaggio)" : mode === "svantaggio" ? " (svantaggio)" : "";
  return share({
    char,
    label: `${label}${modeTag}`,
    total: hit.total,
    detail: hit.detail,
    crit: hit.crit,
    fumble: hit.fumble,
    extra: hit.fumble
      ? "mancato automaticamente"
      : parts.length
        ? `se colpisce: ${parts.join(" + ")}${hit.crit ? " (dadi raddoppiati)" : ""}`
        : undefined,
  });
}

/** Testo della notifica Owlbear. */
export function rollText(m: RollMessage): string {
  const flag = m.crit ? " ✨CRITICO" : m.fumble ? " 💀1 naturale" : "";
  const extra = m.extra ? ` · ${m.extra}` : "";
  return `🎲 ${m.char} — ${m.label}: ${m.total}${flag} (${m.detail})${extra}`;
}
