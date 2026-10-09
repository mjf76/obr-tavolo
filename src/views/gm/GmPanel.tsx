/**
 * Pannello del master "a metà schermo" (telefono/tablet): popover ancorato in basso,
 * la parte alta resta mappa interattiva (si possono toccare i token).
 */
import { useState } from "react";
import OBR from "@owlbear-rodeo/sdk";
import { useObrReady } from "../../shared/hooks";
import { IDS, pageUrl } from "../../shared/keys";
import { GmHome } from "../GmHome";

const FRACTION_KEY = "obr-tavolo-gm-fraction";
/** Ultima altezza scelta per il pannello (⅖ ½ ¾), ricordata su questo dispositivo. */
export function loadGmFraction(): number {
  try {
    const f = parseFloat(localStorage.getItem(FRACTION_KEY) ?? "");
    return [0.4, 0.5, 0.75].includes(f) ? f : 0.5;
  } catch {
    return 0.5;
  }
}

export async function openGmPanel(fraction = loadGmFraction()) {
  const [w, h] = await Promise.all([OBR.viewport.getWidth(), OBR.viewport.getHeight()]);
  await OBR.popover.open({
    id: IDS.popoverGm,
    url: pageUrl("gm.html", { f: String(fraction) }),
    width: Math.round(w),
    height: Math.round(h * fraction),
    anchorReference: "POSITION",
    anchorPosition: { left: 0, top: Math.round(h) },
    anchorOrigin: { horizontal: "LEFT", vertical: "BOTTOM" },
    transformOrigin: { horizontal: "LEFT", vertical: "BOTTOM" },
    disableClickAway: true,
    marginThreshold: 0,
  });
  await OBR.action.close();
}

export function GmPanel() {
  const ready = useObrReady();
  const [fraction, setFraction] = useState(() => parseFloat(new URLSearchParams(location.search).get("f") ?? "0.5"));
  if (!ready) return <div className="app muted">Connessione…</div>;

  const resize = async (f: number) => {
    const h = await OBR.viewport.getHeight();
    await OBR.popover.setHeight(IDS.popoverGm, Math.round(h * f));
    setFraction(f);
    try {
      localStorage.setItem(FRACTION_KEY, String(f));
    } catch {
      /* ignorato */
    }
  };

  return (
    <div className="app gm-panel">
      <div className="gm-bar">
        <b className="grow">OBR Tavolo · Master</b>
        {[0.4, 0.5, 0.75].map((f) => (
          <button key={f} className={`small ${Math.abs(f - fraction) < 0.01 ? "primary" : ""}`} onClick={() => resize(f)}>
            {f === 0.4 ? "⅖" : f === 0.5 ? "½" : "¾"}
          </button>
        ))}
        <button className="small" onClick={() => OBR.popover.close(IDS.popoverGm)} aria-label="chiudi pannello">
          ▾
        </button>
      </div>
      <GmHome />
    </div>
  );
}
