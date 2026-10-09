/** Master: impostazioni non predefinite (valgono per tutta la stanza) e diagnostica della scena. */
import { useEffect, useState } from "react";
import OBR, { type Item } from "@owlbear-rodeo/sdk";
import { MEASUREMENT_LABEL, type Measurement } from "../../shared/movement";
import { setSettings, useRoomSettings } from "../../shared/settings";
import { FOG_LIGHT_KEY } from "../../shared/vision";
import { DOORS_KEY } from "../../shared/doors";
import { isPcToken } from "../../shared/combat";

export function SettingsSection({ characters, dpi }: { characters: Item[]; dpi: number }) {
  const s = useRoomSettings();
  return (
    <details className="section">
      <summary>
        <h2 style={{ display: "inline" }}>⚙️ Impostazioni</h2>
      </summary>
      <p className="muted small">Qui c'è solo ciò che cambia il comportamento predefinito. Vale per tutte le scene della stanza.</p>
      <label className="small">Diagonali nel movimento</label>
      <select value={s.misura} onChange={(e) => setSettings({ misura: e.target.value as Measurement })} style={{ width: "100%" }}>
        {(Object.keys(MEASUREMENT_LABEL) as Measurement[]).map((m) => (
          <option key={m} value={m}>
            {MEASUREMENT_LABEL[m]}
            {m === "ALTERNATING" ? " — predefinita" : ""}
          </option>
        ))}
      </select>
      <Diagnostics characters={characters} dpi={dpi} />
    </details>
  );
}

/** Cosa c'è nella scena: utile se nebbia, porte o visione non si comportano come previsto. */
function Diagnostics({ characters, dpi }: { characters: Item[]; dpi: number }) {
  const [fog, setFog] = useState<Item[]>([]);
  const [scale, setScale] = useState("");
  useEffect(() => {
    const load = (all: Item[]) => setFog(all.filter((i) => i.layer === "FOG"));
    OBR.scene.items.getItems().then(load);
    OBR.scene.grid.getScale().then((g) => setScale(g.raw));
    return OBR.scene.items.onChange(load);
  }, []);
  const keys = [...new Set(fog.flatMap((i) => Object.keys(i.metadata)))];
  const doors = fog.reduce((n, i) => n + (Array.isArray(i.metadata[DOORS_KEY]) ? (i.metadata[DOORS_KEY] as unknown[]).length : 0), 0);
  const pcs = characters.filter(isPcToken);
  return (
    <details style={{ marginTop: 10 }}>
      <summary className="muted small">Diagnostica scena</summary>
      <div className="muted small" style={{ marginTop: 6, wordBreak: "break-word" }}>
        <div>
          Casella: {dpi} px = {scale}
        </div>
        <div>
          Oggetti nebbia: {fog.length} ({fog.map((i) => i.type).filter((t, k, a) => a.indexOf(t) === k).join(", ") || "—"}) · porte: {doors}
        </div>
        <div>Chiavi: {keys.join(", ") || "—"}</div>
        {pcs.map((p) => {
          const l = p.metadata[FOG_LIGHT_KEY] as { attenuationRadius?: number; lightType?: string } | undefined;
          return (
            <div key={p.id}>
              {p.name}: {l?.attenuationRadius ? `${(l.attenuationRadius / dpi).toFixed(1)} caselle (${l.lightType ?? "PRIMARY"})` : "nessuna luce"}
            </div>
          );
        })}
      </div>
    </details>
  );
}
