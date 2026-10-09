/** Regole pure della visione (senza SDK, testabili con node). */

export type Ambiente = "buio" | "luce";

export interface FogLight {
  attenuationRadius: number;
  sourceRadius: number;
  falloff: number;
  innerAngle: number;
  outerAngle: number;
  lightType: "PRIMARY";
}

/** Fonti di luce portate dal PG (regole 2024: luce intensa + luce fioca, in piedi). */
export const LUCI: { id: string; label: string; ft: number; cono?: boolean }[] = [
  { id: "", label: "Nessuna", ft: 0 },
  { id: "candela", label: "Candela", ft: 10 },
  { id: "torcia", label: "Torcia", ft: 40 },
  { id: "luce", label: "Incantesimo Luce", ft: 40 },
  { id: "lanterna", label: "Lanterna schermata", ft: 60 },
  { id: "occhiodibue", label: "Lanterna a occhio di bue (cono)", ft: 120, cono: true },
];

/** Raggio con mappa illuminata, in caselle. */
export const LUCE_CASELLE = 120;

/** "Scurovisione 18 m", "Darkvision 60 ft", "Nessuna scurovisione" → piedi. */
export function parseDarkvisionFt(sensi: string): number {
  const m = /(?:scurovisione|darkvision)\s*(\d+(?:[.,]\d+)?)\s*(m\b|metri|ft|piedi)?/i.exec(sensi);
  if (!m) return 0;
  const n = parseFloat(m[1].replace(",", "."));
  const unit = (m[2] ?? "ft").toLowerCase();
  return unit.startsWith("m") ? Math.round(n / 0.3) : n;
}

/**
 * Luce di visione per la nebbia dinamica.
 * Buio: la maggiore tra scurovisione e luce portata (minimo una casella).
 * Illuminata: LUCE_CASELLE; decidono muri e porte.
 */
export function lightFor(dvFt: number, luceId: string, ambiente: Ambiente, dpi: number, gridFt = 5): FogLight {
  const luce = LUCI.find((l) => l.id === luceId) ?? LUCI[0];
  let cells = LUCE_CASELLE;
  let cone = false;
  if (ambiente === "buio") {
    const ft = Math.max(dvFt, luce.ft);
    cone = !!luce.cono && luce.ft > dvFt;
    cells = Math.max(ft / gridFt, 1);
  }
  return {
    attenuationRadius: Math.round(cells * dpi + dpi / 2),
    sourceRadius: 25,
    falloff: 0.2,
    innerAngle: cone ? 45 : 360,
    outerAngle: cone ? 60 : 360,
    lightType: "PRIMARY",
  };
}
