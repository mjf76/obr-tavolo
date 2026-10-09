import { useEffect, useState } from "react";
import OBR from "@owlbear-rodeo/sdk";
import { useMe, useObrReady } from "../shared/hooks";
import { effectiveRole, loadDeviceMode, saveDeviceMode, type DeviceMode } from "../shared/device";
import { GmHome } from "./GmHome";
import { openGmPanel } from "./gm/GmPanel";
import { PlayerHome } from "./PlayerHome";
import { TableHome } from "./TableHome";

export function App() {
  const ready = useObrReady();
  if (!OBR.isAvailable) return <NotInObr />;
  if (!ready) return <Connecting />;
  return <Main />;
}

function Main() {
  const me = useMe(true);
  const [mode, setMode] = useState<DeviceMode>(loadDeviceMode);
  if (!me) return <div className="app muted">Caricamento…</div>;

  const role = effectiveRole(me.role, me.name, mode);
  const change = (m: DeviceMode) => {
    saveDeviceMode(m);
    setMode(m);
  };

  return (
    <div className="app">
      <h1>
        <span style={{ flex: 1 }}>OBR Tavolo</span>
        {role === "GM" && (
          <button className="small icon-btn" onClick={() => openGmPanel(0.5)} title="Pannello a metà schermo (mappa sopra)">
            📱
          </button>
        )}
        <span className={`badge ${role === "GM" ? "gm" : role === "TAVOLO" ? "tavolo" : ""}`}>
          {role === "GM" ? "Master" : role === "TAVOLO" ? "Schermo tavolo" : "Giocatore"}
        </span>
      </h1>

      {role === "GM" && <GmLauncher />}
      {role === "GM" && <GmHome />}
      {role === "PLAYER" && <PlayerHome me={me} />}
      {role === "TAVOLO" && <TableHome />}

      {me.role !== "GM" && (
        <div className="section">
          <h2>Questo dispositivo</h2>
          <div className="seg">
            {(["auto", "giocatore", "tavolo"] as DeviceMode[]).map((m) => (
              <button key={m} className={mode === m ? "on" : ""} onClick={() => change(m)}>
                {m === "auto" ? "Automatico" : m === "giocatore" ? "Telefono" : "Schermo TV"}
              </button>
            ))}
          </div>
          <p className="muted" style={{ marginTop: 8 }}>
            Automatico: è lo schermo del tavolo se il nome in OBR è “TAVOLO”.
          </p>
        </div>
      )}
    </div>
  );
}

function NotInObr() {
  const manifest = new URL("manifest.json", window.location.href).href;
  return (
    <div className="app">
      <h1>OBR Tavolo</h1>
      <div className="section">
        <p>Questa è un'estensione per Owlbear Rodeo: va aperta dentro una stanza.</p>
        <p className="muted">
          Per installarla: Owlbear Rodeo → Profilo → Extensions → <b>Add Custom Extension</b> e incolla:
        </p>
        <p>
          <code style={{ wordBreak: "break-all" }}>{manifest}</code>
        </p>
      </div>
    </div>
  );
}

function Connecting() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 6000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="app">
      <p className="muted">Connessione a Owlbear Rodeo…</p>
      {slow && (
        <div className="notice">
          Ci sta mettendo troppo. Chiudi e riapri l'estensione; se non basta, ricarica la pagina di Owlbear.
        </div>
      )}
    </div>
  );
}

/** Su schermi stretti (telefono/tablet) il pannello del master si apre in basso, a metà schermo. */
function GmLauncher() {
  useEffect(() => {
    let auto = true;
    try {
      auto = sessionStorage.getItem("obr-tavolo-gm-auto") !== "no";
      sessionStorage.setItem("obr-tavolo-gm-auto", "no");
    } catch {
      /* ignorato */
    }
    if (!auto) return;
    OBR.viewport.getWidth().then((w) => {
      if (w < 1000) void openGmPanel(0.5);
    });
  }, []);
  return null;
}
