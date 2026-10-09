/** Master, scheda Partita: nebbia compatta — luce/buio della mappa e porte numerate. */
import type { VisionSettings } from "../../shared/vision";
import { setVisionSettings } from "../../shared/vision";
import { useItems } from "../../shared/hooks";
import { closeAll, hasDoors, listDoors, setDoorOpen } from "../../shared/doors";
import { makeSecondary, monstersWithPrimaryLight } from "../../shared/vision";
import { isPcToken } from "../../shared/combat";
import type { Item } from "@owlbear-rodeo/sdk";

export function FogSection({ sceneReady, settings, characters }: { sceneReady: boolean; settings: VisionSettings; characters: Item[] }) {
  const doorItems = useItems(sceneReady, hasDoors);
  const doors = listDoors(doorItems);
  if (!settings.auto && !doors.length) return null;
  const dark = settings.ambiente === "buio";
  const openCount = doors.filter((d) => d.open).length;
  const lit = monstersWithPrimaryLight(characters.filter((c) => !isPcToken(c)));
  return (
    <div className="section fog-section">
      <div className="sec-head">
        <h2 className="grow">Nebbia</h2>
        {settings.auto && (
          <button
            className="small"
            onClick={() => setVisionSettings({ ambiente: dark ? "luce" : "buio" })}
            title="Tocca per cambiare"
          >
            {dark ? "🌑 Buia" : "☀️ Illuminata"}
          </button>
        )}
      </div>
      {doors.length > 0 && (
        <div className="door-line">
          <span className="muted small">Porte</span>
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
          {openCount > 0 && (
            <button className="small" onClick={() => closeAll(doorItems)} title="Chiudi tutte le porte">
              ✕ tutte
            </button>
          )}
        </div>
      )}
      {lit.length > 0 && (
        <div className="notice err" style={{ marginTop: 6 }}>
          Luce primaria su {lit.map((m) => m.name).join(", ")}: i giocatori vedrebbero ciò che vede.{" "}
          <button className="small" onClick={() => makeSecondary(lit.map((m) => m.id))}>
            Rendila secondaria
          </button>
        </div>
      )}
    </div>
  );
}
