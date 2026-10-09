import type { Item } from "@owlbear-rodeo/sdk";
import { Popup } from "./PlayerApp";

/** Segnaposto della scheda completa (Step 5), con le sezioni previste in stile D&D Beyond. */
export function SheetPanel({ item, onClose }: { item: Item; onClose: () => void }) {
  const sections = [
    ["🧬", "Caratteristiche", "FOR DES COS INT SAG CAR con modificatori e tiri salvezza"],
    ["🎯", "Abilità", "18 abilità, competenze e maestrie"],
    ["⚔️", "Azioni", "Attacchi, maestrie delle armi, azioni bonus e reazioni"],
    ["✨", "Incantesimi", "Slot per livello, preparati, rituali, CD e attacco"],
    ["🎒", "Equipaggiamento", "Inventario, monete, sintonia con oggetti magici"],
    ["🏅", "Privilegi e tratti", "Classe, sottoclasse, specie, background, talenti"],
    ["📝", "Note", "Appunti, legami, ideali"],
  ];
  return (
    <Popup title={`Scheda · ${item.name}`} onClose={onClose}>
      <div className="stack">
        <p className="muted">La scheda completa arriva con lo Step 5. Sezioni previste:</p>
        {sections.map(([icon, t, d]) => (
          <div className="card action-card placeholder" key={t}>
            <span className="action-icon">{icon}</span>
            <div className="grow">
              <b>{t}</b>
              <div className="muted">{d}</div>
            </div>
          </div>
        ))}
      </div>
    </Popup>
  );
}
