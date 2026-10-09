/** Impostazioni di visione della scena (mappa buia/illuminata, automatica sì/no). */
import { useEffect, useState } from "react";
import OBR from "@owlbear-rodeo/sdk";
import { DEFAULT_VISION, readVisionSettings, type VisionSettings } from "../../shared/vision";

export function useVisionSettings(sceneReady: boolean): VisionSettings {
  const [v, setV] = useState<VisionSettings>(DEFAULT_VISION);
  useEffect(() => {
    if (!sceneReady) return;
    OBR.scene.getMetadata().then((m) => setV(readVisionSettings(m)));
    return OBR.scene.onMetadataChange((m) => setV(readVisionSettings(m)));
  }, [sceneReady]);
  return v;
}
