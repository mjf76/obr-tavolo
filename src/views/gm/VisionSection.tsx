/** Master: visione dei PG per la nebbia dinamica (ambiente buio/illuminato, luci dei mostri). */
import { useEffect, useState } from "react";
import OBR, { type Item } from "@owlbear-rodeo/sdk";
import { isPcToken } from "../../shared/combat";
import {
  DEFAULT_VISION,
  makeSecondary,
  monstersWithPrimaryLight,
  readVisionSettings,
  setVisionSettings,
  visionSummary,
  type VisionSettings,
} from "../../shared/vision";

export function useVisionSettings(sceneReady: boolean): VisionSettings {
  const [v, setV] = useState<VisionSettings>(DEFAULT_VISION);
  useEffect(() => {
    if (!sceneReady) return;
    OBR.scene.getMetadata().then((m) => setV(readVisionSettings(m)));
    return OBR.scene.onMetadataChange((m) => setV(readVisionSettings(m)));
  }, [sceneReady]);
  return v;
}

/** Interruttore rapido (scheda Partita): si entra in una caverna, si esce al sole. */
export function AmbientSwitch({ settings }: { settings: VisionSettings }) {
  if (!settings.auto) return null;
  return (
    <div className="seg" style={{ margin: "8px 0" }}>
      <button className={settings.ambiente === "buio" ? "on" : ""} onClick={() => setVisionSettings({ ambiente: "buio" })}>
        🌑 Mappa buia
      </button>
      <button className={settings.ambiente === "luce" ? "on" : ""} onClick={() => setVisionSettings({ ambiente: "luce" })}>
        ☀️ Mappa illuminata
      </button>
    </div>
  );
}

export function VisionSection({ characters, settings }: { characters: Item[]; settings: VisionSettings }) {
  const pcs = characters.filter(isPcToken);
  const lit = monstersWithPrimaryLight(characters.filter((c) => !isPcToken(c)));
  return (
    <div className="section">
      <h2>Visione dei PG (nebbia dinamica)</h2>
      <label className="toggle">
        <input type="checkbox" checked={settings.auto} onChange={(e) => setVisionSettings({ auto: e.target.checked })} /> Imposta
        da sola la visione dei PG
      </label>
      {settings.auto ? (
        <>
          <AmbientSwitch settings={settings} />
          <p className="muted small">
            Buia: ogni PG vede fin dove arriva la sua scurovisione (dalla scheda) o la luce che porta (la sceglie il
            giocatore in Esplorazione). Torce e bracieri della mappa vanno come luci <b>secondarie</b>: si vedono quando un
            PG li ha in vista.
          </p>
          {pcs.map((p) => (
            <div key={p.id} className="row">
              <div className="grow">
                <div className="name">{p.name}</div>
                <div className="muted small">{visionSummary(p, settings)}</div>
              </div>
            </div>
          ))}
          {pcs.length === 0 && <p className="muted">Nessun PG in scena.</p>}
        </>
      ) : (
        <p className="muted small">Visione manuale: le luci dei token si impostano con l'estensione Dynamic Fog.</p>
      )}
      {lit.length > 0 && (
        <div className="notice err" style={{ marginTop: 8 }}>
          {lit.length === 1 ? "Un mostro ha" : `${lit.length} mostri hanno`} una luce primaria: i giocatori vedrebbero ciò che vede
          il mostro ({lit.map((m) => m.name).join(", ")}).{" "}
          <button className="small" onClick={() => makeSecondary(lit.map((m) => m.id))}>
            Rendile secondarie
          </button>
        </div>
      )}
    </div>
  );
}
