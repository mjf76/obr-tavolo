/** Master: porte numerate (il numero compare sulla mappa, solo sul dispositivo del master). */
import { useState } from "react";
import { useItems } from "../../shared/hooks";
import { closeAll, doorNumbersOn, hasDoors, listDoors, setDoorNumbers, setDoorOpen } from "../../shared/doors";
import { centerOnPoint } from "../../shared/focus";

export function DoorsSection({ sceneReady }: { sceneReady: boolean }) {
  const doorItems = useItems(sceneReady, hasDoors);
  const [numbers, setNumbers] = useState(doorNumbersOn);
  if (!doorItems.length) return null;
  const doors = listDoors(doorItems);
  const openCount = doors.filter((d) => d.open).length;

  return (
    <div className="section">
      <h2>
        Porte ({openCount} aperte su {doors.length})
      </h2>
      <div className="door-grid">
        {doors.map((d) => (
          <div key={d.key} className={`door-cell ${d.open ? "open" : "closed"}`}>
            <button className="door-num" onClick={() => centerOnPoint(d.center, 9)} title="Mostra sulla mappa">
              {d.n}
            </button>
            <button className="small" onClick={() => setDoorOpen(d.itemId, d.index, !d.open)}>
              {d.open ? "Chiudi" : "Apri"}
            </button>
          </div>
        ))}
      </div>
      <div className="row-btns" style={{ marginTop: 8 }}>
        <label className="toggle small">
          <input
            type="checkbox"
            checked={numbers}
            onChange={(e) => {
              setNumbers(e.target.checked);
              setDoorNumbers(e.target.checked);
            }}
          />{" "}
          Numeri sulla mappa (solo tu)
        </label>
        <button className="small" onClick={() => closeAll(doorItems)} disabled={!openCount}>
          Chiudi tutte
        </button>
      </div>
      <p className="muted small">Verde = aperta, rosso = chiusa. Tocca il numero per vedere la porta sulla mappa.</p>
    </div>
  );
}
