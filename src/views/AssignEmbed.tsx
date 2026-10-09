import { useEffect, useState } from "react";
import OBR, { type Item } from "@owlbear-rodeo/sdk";
import { assign, getLink } from "../shared/assignment";
import { isTableName } from "../shared/device";
import { useObrReady, useParty } from "../shared/hooks";

/** Pagina incorporata nel menu contestuale del token (solo GM): scegli il giocatore. */
export function AssignEmbed() {
  const ready = useObrReady();
  const party = useParty(ready);
  const [selected, setSelected] = useState<Item[]>([]);

  useEffect(() => {
    if (!ready) return;
    const load = async () => {
      const ids = (await OBR.player.getSelection()) ?? [];
      setSelected(ids.length ? await OBR.scene.items.getItems(ids) : []);
    };
    load();
    return OBR.scene.items.onChange(() => void load());
  }, [ready]);

  if (!ready) return null;
  const players = party.filter((p) => p.role === "PLAYER" && !isTableName(p.name));
  const ids = selected.map((i) => i.id);
  const current = selected.length === 1 ? getLink(selected[0])?.playerId : undefined;

  return (
    <div className="assign">
      {players.length === 0 && <span className="muted" style={{ padding: 6 }}>Nessun giocatore connesso</span>}
      {players.map((p) => (
        <button key={p.connectionId} className={current === p.id ? "on" : ""} onClick={() => assign(ids, p)}>
          <span className="dot" style={{ background: p.color }} />
          {p.name}
        </button>
      ))}
      {selected.some((i) => getLink(i)) && (
        <button onClick={() => assign(ids, null)}>
          <span className="muted">✕ Rimuovi assegnazione</span>
        </button>
      )}
    </div>
  );
}
