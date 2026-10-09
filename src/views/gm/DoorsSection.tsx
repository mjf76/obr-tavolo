/** Master: porte numerate (il numero compare anche sulla mappa del master). Tocca il numero per aprire/chiudere. */
import { useItems } from "../../shared/hooks";
import { closeAll, hasDoors, listDoors, setDoorOpen } from "../../shared/doors";

export function DoorsSection({ sceneReady }: { sceneReady: boolean }) {
  const doorItems = useItems(sceneReady, hasDoors);
  if (!doorItems.length) return null;
  const doors = listDoors(doorItems);
  const openCount = doors.filter((d) => d.open).length;
  return (
    <div className="section">
      <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="grow">Porte</span>
        {openCount > 0 && (
          <button className="small" onClick={() => closeAll(doorItems)}>
            Chiudi tutte
          </button>
        )}
      </h2>
      <div className="door-grid">
        {doors.map((d) => (
          <button
            key={d.key}
            className={`door-num ${d.open ? "open" : "closed"}`}
            onClick={() => setDoorOpen(d.itemId, d.index, !d.open)}
            title={d.open ? "Aperta: tocca per chiudere" : "Chiusa: tocca per aprire"}
          >
            {d.n}
          </button>
        ))}
      </div>
    </div>
  );
}
