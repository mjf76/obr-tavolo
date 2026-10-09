/** Master: porte della scena, dalla più vicina al token selezionato (o al gruppo dei PG). */
import { useState } from "react";
import type { Item } from "@owlbear-rodeo/sdk";
import { useItems } from "../../shared/hooks";
import { closeAll, hasDoors, listDoors, setDoorOpen } from "../../shared/doors";
import { describeFrom } from "../../shared/doorGeom";
import { centerOnPoint } from "../../shared/focus";
import { isPcToken } from "../../shared/combat";

const SHOWN = 5;

export function DoorsSection({ sceneReady, characters, selection, dpi }: { sceneReady: boolean; characters: Item[]; selection: Item[]; dpi: number }) {
  const doorItems = useItems(sceneReady, hasDoors);
  const [all, setAll] = useState(false);
  if (!doorItems.length) return null;

  // riferimento: il token selezionato, altrimenti il centro del gruppo dei PG
  const pcs = characters.filter(isPcToken);
  const ref =
    selection.length === 1
      ? selection[0].position
      : pcs.length
        ? { x: pcs.reduce((a, p) => a + p.position.x, 0) / pcs.length, y: pcs.reduce((a, p) => a + p.position.y, 0) / pcs.length }
        : null;
  const refName = selection.length === 1 ? selection[0].name : "gruppo";
  const doors = listDoors(doorItems);
  if (ref) doors.sort((a, b) => Math.hypot(a.center.x - ref.x, a.center.y - ref.y) - Math.hypot(b.center.x - ref.x, b.center.y - ref.y));
  const shown = all ? doors : doors.slice(0, SHOWN);
  const openCount = doors.filter((d) => d.open).length;

  return (
    <div className="section">
      <h2>
        Porte ({openCount} aperte su {doors.length})
      </h2>
      {ref && <p className="muted small">Dalla più vicina a: {refName}</p>}
      {shown.map((d) => (
        <div key={d.key} className="row">
          <span style={{ fontSize: 20 }}>{d.open ? "🟩" : "🟥"}</span>
          <div className="grow" onClick={() => centerOnPoint(d.center, 9)} style={{ cursor: "pointer" }}>
            <div className="name">Porta {d.open ? "aperta" : "chiusa"}</div>
            <div className="muted small">{ref ? describeFrom(ref, d.center, dpi) : "tocca per vederla"} · 📍</div>
          </div>
          <button className={d.open ? "small" : "small primary"} onClick={() => setDoorOpen(d.itemId, d.index, !d.open)}>
            {d.open ? "🚪 Chiudi" : "🚪 Apri"}
          </button>
        </div>
      ))}
      <div className="row-btns" style={{ marginTop: 6 }}>
        {doors.length > SHOWN && (
          <button className="small" onClick={() => setAll(!all)}>
            {all ? "Solo le più vicine" : `Mostra tutte (${doors.length})`}
          </button>
        )}
        <button className="small" onClick={() => closeAll(doorItems)} disabled={!openCount}>
          Chiudi tutte
        </button>
      </div>
    </div>
  );
}
